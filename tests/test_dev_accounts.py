from sqlalchemy import select

from app import dev_accounts
from app.db import SessionLocal
from app.models import Member
from app.security import hash_password


def _by_email(db, email):
    return db.scalar(select(Member).where(Member.email == email))


def _login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_updates_existing_accounts_in_place_and_is_idempotent(client):
    with SessionLocal() as db:
        old = Member(name="Stefan Ungureanu", email="stefanu@bsp.se", is_admin=True, password_hash=hash_password("OldPassword123"))
        saab = Member(name="Saab", email="stefanu@saab.se", password_hash=hash_password("SaabPassword123"))
        db.add_all([old, saab]); db.commit()
        staff_id, staff_token, saab_id, saab_token = old.id, old.api_token, saab.id, saab.api_token
    assert dev_accounts.main(["x"]) == 0
    with SessionLocal() as db:
        s, m = _by_email(db, dev_accounts.STAFF.email), _by_email(db, dev_accounts.MEMBER.email)
        assert (s.id, s.name, s.is_admin, s.api_token) == (staff_id, "Erik Andersson", True, staff_token)   # same row and permissions
        # The member row is the COMPANY: same id and token, still named "Saab", still not an admin.
        assert (m.id, m.name, m.is_admin, m.api_token) == (saab_id, "Saab", False, saab_token)
        assert _by_email(db, "stefanu@bsp.se") is None and _by_email(db, "stefanu@saab.se") is None   # no leftovers or duplicates
        assert db.scalar(select(Member).where(Member.name == "Saab")).id == saab_id
        hashes = (s.password_hash, m.password_hash)
    r = _login(client, dev_accounts.MEMBER.email, dev_accounts.MEMBER.password)
    assert r.status_code == 200 and r.json()["member_id"] == saab_id and r.json()["name"] == "Saab"
    staff = _login(client, dev_accounts.STAFF.email, dev_accounts.STAFF.password)
    assert staff.status_code == 200 and staff.json()["member_id"] == staff_id
    # A member must not reach staff endpoints; the staff account can.
    assert client.get("/admin/scheduler", headers={"Authorization": "Bearer " + r.json()["access_token"]}).status_code == 403
    assert client.get("/admin/scheduler", headers={"Authorization": "Bearer " + staff.json()["access_token"]}).status_code in (200, 404)  # allowed (404 only because the test scheduler is off)
    assert dev_accounts.main(["x"]) == 0  # second run changes nothing, in particular no hash
    with SessionLocal() as db:
        assert (_by_email(db, dev_accounts.STAFF.email).password_hash, _by_email(db, dev_accounts.MEMBER.email).password_hash) == hashes


def test_refuses_in_production(monkeypatch):
    monkeypatch.setenv("BSP_ENVIRONMENT", "production")
    assert dev_accounts.main(["x"]) == 1
