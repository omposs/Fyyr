import hashlib
from datetime import timedelta

import pytest
from sqlalchemy import select

from app import accounts
from app import security as sec
from app.config import get_settings
from app.models import AuditLog, AuthSession, Member, utcnow
from conftest import H

PW = "correct horse battery"


def B(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_token(tokens):
    return tokens["BSP Admin"]


def _give_login(client, admin_token, member_id, email="a@example.org", password=PW):
    r = client.put(f"/admin/members/{member_id}/credentials", json={"email": email, "password": password},
                   headers=H(admin_token))
    assert r.status_code == 204, r.text


def _member_id(db, name="Nautilab AB"):
    return db.scalar(select(Member.id).where(Member.name == name))


def _login(client, email="a@example.org", password=PW):
    return client.post("/auth/login", json={"email": email, "password": password})


# ---- hashing ------------------------------------------------------------------------------------
def test_password_hash_roundtrip_and_salting():
    h1, h2 = sec.hash_password(PW), sec.hash_password(PW)
    assert h1 != h2 and PW not in h1  # salted, not stored in clear
    assert sec.verify_password(PW, h1) and sec.verify_password(PW, h2)
    assert not sec.verify_password("wrong password!", h1)


@pytest.mark.parametrize("bad", ["", "nonsense", "scrypt$1$2", "bcrypt$16384$8$1$AA==$AA==",
                                 "scrypt$999999999$8$1$AA==$AA==", "scrypt$x$8$1$AA==$AA=="])
def test_verify_rejects_malformed_or_hostile_hashes(bad):
    assert sec.verify_password(PW, bad) is False  # and does not crash or try to allocate gigabytes


def test_policy_and_email_normalisation():
    assert sec.normalise_email("  Boss@Example.ORG ") == "boss@example.org"
    for bad in ("nope", "a@b", "a b@c.de", "x" * 250 + "@a.bc"):
        with pytest.raises(ValueError):
            sec.normalise_email(bad)
    with pytest.raises(ValueError):
        sec.check_password_policy("short")
    with pytest.raises(ValueError):
        sec.check_password_policy("a@example.org", "A@example.org")
    sec.check_password_policy(PW, "a@example.org")


# ---- login flow ---------------------------------------------------------------------------------
def test_login_gives_working_bearer_token_and_stores_only_a_hash(client, db, tokens, admin_token):
    mid = _member_id(db)
    _give_login(client, admin_token, mid)
    r = _login(client, "  A@Example.org ")  # email is case/space-insensitive
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and body["member_id"] == mid and body["name"] == "Nautilab AB"
    me = client.get("/me", headers=B(body["access_token"]))
    assert me.status_code == 200 and me.json()["name"] == "Nautilab AB"
    session = db.scalar(select(AuthSession))
    assert session.token_hash == hashlib.sha256(body["access_token"].encode()).hexdigest()
    assert body["access_token"] not in session.token_hash  # the token itself is not in the database


def test_wrong_password_and_unknown_email_are_indistinguishable(client, db, admin_token, monkeypatch):
    _give_login(client, admin_token, _member_id(db))
    wrong = _login(client, password="not the password")
    unknown = _login(client, "nobody@example.org")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Invalid email or password"}
    # unknown email still pays for a password check, so timing does not reveal which emails exist
    calls = []
    real = sec.verify_password
    monkeypatch.setattr("app.api.auth.verify_password", lambda p, h: (calls.append(h), real(p, h))[1])
    _login(client, "nobody@example.org")
    assert len(calls) == 1 and calls[0] == sec.dummy_hash()


def test_member_without_password_cannot_log_in(client, db, tokens):
    assert _login(client, "x@example.org").status_code == 401


def test_throttle_blocks_after_repeated_failures_and_success_does_not_bypass(client, db, admin_token):
    _give_login(client, admin_token, _member_id(db))
    n = get_settings().login_max_failures
    for _ in range(n):
        assert _login(client, password="wrong wrong wrong").status_code == 401
    blocked = _login(client, password=PW)  # even the right password is refused while blocked
    assert blocked.status_code == 429 and int(blocked.headers["retry-after"]) > 0
    assert _login(client, "other@example.org").status_code == 401  # other emails unaffected


def test_successful_login_resets_failure_count(client, db, admin_token):
    _give_login(client, admin_token, _member_id(db))
    for _ in range(get_settings().login_max_failures - 1):
        _login(client, password="wrong wrong wrong")
    assert _login(client).status_code == 200
    for _ in range(get_settings().login_max_failures - 1):
        assert _login(client, password="wrong wrong wrong").status_code == 401  # counter started over


def test_expired_and_revoked_sessions_are_rejected(client, db, admin_token):
    _give_login(client, admin_token, _member_id(db))
    t = _login(client).json()["access_token"]
    assert client.get("/me", headers=B(t)).status_code == 200
    s = db.scalar(select(AuthSession))
    s.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get("/me", headers=B(t)).status_code == 401
    s.expires_at = utcnow() + timedelta(hours=1)
    db.commit()
    assert client.get("/me", headers=B(t)).status_code == 200
    assert client.post("/auth/logout", headers=B(t)).status_code == 204
    assert client.get("/me", headers=B(t)).status_code == 401  # logout really ends the session


def test_garbage_bearer_and_missing_credentials(client):
    assert client.get("/me", headers=B("garbage")).status_code == 401
    r = client.get("/me")
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"


# ---- API tokens ---------------------------------------------------------------------------------
def test_api_tokens_work_by_default_and_can_be_disabled(client, tokens, monkeypatch):
    t = tokens["Nautilab AB"]
    assert client.get("/me", headers=H(t)).status_code == 200
    monkeypatch.setattr(get_settings(), "allow_api_tokens", False)
    r = client.get("/me", headers=H(t))
    assert r.status_code == 401 and "disabled" in r.json()["detail"]


# ---- password change ----------------------------------------------------------------------------
def test_change_password_signs_out_other_sessions_only(client, db, admin_token):
    _give_login(client, admin_token, _member_id(db))
    t1, t2 = _login(client).json()["access_token"], _login(client).json()["access_token"]
    new = "an entirely different phrase"
    bad = client.post("/auth/change-password", json={"current_password": "wrong one here", "new_password": new}, headers=B(t1))
    assert bad.status_code == 401
    assert client.post("/auth/change-password", json={"current_password": PW, "new_password": "short"}, headers=B(t1)).status_code == 422
    assert client.post("/auth/change-password", json={"current_password": PW, "new_password": PW}, headers=B(t1)).status_code == 422
    assert client.post("/auth/change-password", json={"current_password": PW, "new_password": new}, headers=B(t1)).status_code == 204
    assert client.get("/me", headers=B(t1)).status_code == 200   # the session that changed it stays
    assert client.get("/me", headers=B(t2)).status_code == 401   # every other session is gone
    assert _login(client).status_code == 401                      # old password no longer works
    assert _login(client, password=new).status_code == 200


# ---- admin ----------------------------------------------------------------------------------------
def test_credentials_are_admin_only_unique_and_end_old_sessions(client, db, tokens, admin_token):
    a, b = _member_id(db, "Nautilab AB"), _member_id(db, "FinFeed Systems")
    body = {"email": "a@example.org", "password": PW}
    assert client.put(f"/admin/members/{a}/credentials", json=body, headers=H(tokens["FinFeed Systems"])).status_code == 403
    assert client.put(f"/admin/members/{a}/credentials", json=body).status_code == 401
    _give_login(client, admin_token, a)
    assert client.put(f"/admin/members/{b}/credentials", json=body, headers=H(admin_token)).status_code == 409
    assert client.put("/admin/members/9999/credentials", json=body, headers=H(admin_token)).status_code == 404
    old = _login(client).json()["access_token"]
    _give_login(client, admin_token, a, password="a brand new passphrase")  # admin reset
    assert client.get("/me", headers=B(old)).status_code == 401


def test_create_member_with_login_and_validation(client, admin_token):
    ok = client.post("/admin/members", json={"name": "Acme", "email": "ACME@example.org", "password": PW}, headers=H(admin_token))
    assert ok.status_code == 201
    assert _login(client, "acme@example.org").status_code == 200
    for bad in ({"name": "X1", "email": "x@example.org"},                       # email without password
                {"name": "X2", "password": PW},                                  # password without email
                {"name": "X3", "email": "x@example.org", "password": "short"},   # weak
                {"name": "X4", "email": "not-an-email", "password": PW}):
        assert client.post("/admin/members", json=bad, headers=H(admin_token)).status_code == 422
    dup = client.post("/admin/members", json={"name": "Acme2", "email": "acme@example.org", "password": PW}, headers=H(admin_token))
    assert dup.status_code == 409
    assert client.post("/admin/members", json={"name": "Plain"}, headers=H(admin_token)).status_code == 201  # login optional


def test_secrets_never_appear_in_responses_or_audit_log(client, db, admin_token):
    mid = _member_id(db)
    r = client.put(f"/admin/members/{mid}/credentials", json={"email": "a@example.org", "password": PW}, headers=H(admin_token))
    assert PW not in r.text
    login = _login(client)
    assert PW not in login.text and "password_hash" not in login.text
    _login(client, password="a wrong guess here")
    for path in ("/me",):
        assert "password" not in client.get(path, headers=B(login.json()["access_token"])).text.lower()
    log = "".join(str(a.detail) + a.action for a in db.scalars(select(AuditLog)))
    assert PW not in log and "a wrong guess here" not in log
    assert {"login", "login_failed", "credentials_set"} <= {a.action for a in db.scalars(select(AuditLog))}


# ---- docs and CORS --------------------------------------------------------------------------------
def test_openapi_has_bearer_and_token_schemes(client):
    schemes = client.get("/openapi.json").json()["components"]["securitySchemes"]
    kinds = {(s["type"], s.get("scheme") or s.get("name")) for s in schemes.values()}
    assert ("http", "bearer") in kinds and ("apiKey", "X-Member-Token") in kinds


def test_cors_preflight_allows_authorization_header(client):
    r = client.options("/auth/login", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
                                               "Access-Control-Request-Headers": "authorization,content-type"})
    assert r.status_code == 200 and "authorization" in r.headers["access-control-allow-headers"].lower()


# ---- CLI --------------------------------------------------------------------------------------------
def test_accounts_cli(client, db, tokens, monkeypatch, capsys):
    def typing(*answers):
        it = iter(answers)
        monkeypatch.setattr(accounts.getpass, "getpass", lambda prompt="": next(it))

    typing(PW, PW)
    assert accounts.main(["x", "set-password", "Nautilab AB", "Cli@Example.org"]) == 0
    assert _login(client, "cli@example.org").status_code == 200
    typing()  # no prompts allowed: an unknown member must be reported BEFORE asking for a password
    assert accounts.main(["x", "set-password", "No Such Co", "z@example.org"]) == 1
    assert "No member named" in capsys.readouterr().out
    assert accounts.main(["x", "set-password", "FinFeed Systems", "cli@example.org"]) == 1  # email taken, no prompt
    assert "already used" in capsys.readouterr().out
    assert accounts.main(["x", "create-admin", "Nautilab AB", "n@example.org"]) == 1  # name exists, no prompt
    typing("one long password", "another long password")
    assert accounts.main(["x", "set-password", "Nautilab AB", "cli@example.org"]) == 1  # mismatch
    assert "do not match" in capsys.readouterr().out
    typing("short", "short")
    assert accounts.main(["x", "set-password", "Nautilab AB", "cli@example.org"]) == 1  # too weak
    typing(PW, PW)
    assert accounts.main(["x", "create-admin", "Boss", "boss@example.org"]) == 0
    boss = _login(client, "boss@example.org").json()["access_token"]
    assert client.post("/admin/matches/recompute", headers=B(boss)).status_code == 200
    assert accounts.main(["x", "list"]) == 0
    assert "cli@example.org" in capsys.readouterr().out
