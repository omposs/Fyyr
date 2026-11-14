from datetime import date, timedelta

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Member, MonitoredItem
from app.security import hash_password

TODAY = date.today()


def _item(db, title, module="events", approved=None, starts=None, tags=None, summary="A public summary"):
    m = MonitoredItem(module=module, title=title, summary=summary, url="https://example.org/" + title.replace(" ", "-"), source_name="Example Org",
                      published_at=TODAY - timedelta(days=3), starts_at=starts, location="Karlskrona", tags=tags or ["maritime"])
    if approved is not None:
        m.public_approved = approved
    db.add(m); db.flush()
    return m.id


def _seed():
    with SessionLocal() as db:
        ids = {
            "ok_event": _item(db, "Approved maritime event", "events", True, TODAY + timedelta(days=5)),
            "ok_fund": _item(db, "Approved funding call", "funding", True, TODAY + timedelta(days=20), ["funding"]),
            "ok_undated": _item(db, "Approved undated news", "news", True, None, ["news"]),
            "past": _item(db, "Approved but past event", "events", True, TODAY - timedelta(days=2)),
            "unapproved": _item(db, "Secret maritime event", "events", False, TODAY + timedelta(days=5)),
            "unknown": _item(db, "Unknown visibility maritime event", "events", None, TODAY + timedelta(days=5)),
        }
        db.commit()
    return ids


def test_anonymous_listing_returns_only_approved_upcoming(client):
    ids = _seed()
    r = client.get("/public/opportunities")  # no credentials at all
    assert r.status_code == 200
    got = {i["id"] for i in r.json()["items"]}
    assert got == {ids["ok_event"], ids["ok_fund"], ids["ok_undated"]}
    assert r.json()["total"] == 3 and r.json()["counts"] == {"events": 1, "funding": 1, "testbeds": 0, "news": 1}


def test_only_whitelisted_fields_are_returned(client):
    _seed()
    item = client.get("/public/opportunities").json()["items"][0]
    assert set(item) == {"id", "module", "title", "summary", "url", "source_name", "published_at", "starts_at", "location", "tags", "closed"}


def test_search_filter_sort_never_reveal_private_records(client):
    ids = _seed()
    r = client.get("/public/opportunities", params={"q": "maritime"}).json()
    assert {i["id"] for i in r["items"]} == {ids["ok_event"]}  # 'Secret maritime event' and the NULL one never match
    assert r["counts"]["events"] == 1 and r["total"] == 1
    assert client.get("/public/opportunities", params={"q": "secret"}).json()["total"] == 0
    assert client.get("/public/opportunities", params={"module": "funding"}).json()["total"] == 1
    titles = [i["title"] for i in client.get("/public/opportunities", params={"sort": "title"}).json()["items"]]
    assert titles == sorted(titles, key=str.lower)
    soon = [i["id"] for i in client.get("/public/opportunities", params={"sort": "soon"}).json()["items"]]
    assert soon == [ids["ok_event"], ids["ok_fund"], ids["ok_undated"]]  # nearest date first, undated last
    assert client.get("/public/opportunities", params={"q": "%"}).json()["total"] == 0  # wildcard is escaped, not a match-all
    assert client.get("/public/opportunities", params={"sort": "bogus"}).status_code == 422


def test_direct_detail_enforces_the_same_rule(client):
    ids = _seed()
    assert client.get(f"/public/opportunities/{ids['ok_event']}").status_code == 200
    past = client.get(f"/public/opportunities/{ids['past']}")
    assert past.status_code == 200 and past.json()["closed"] is True  # approved, so reachable, but flagged as over
    hidden = [client.get(f"/public/opportunities/{ids[k]}") for k in ("unapproved", "unknown")]
    missing = client.get("/public/opportunities/999999")
    for h in hidden:
        assert h.status_code == 404 and h.json() == missing.json()  # indistinguishable from "does not exist"
        assert "Secret" not in h.text and "Unknown visibility" not in h.text


def test_admin_approval_requires_admin_and_changes_visibility(client):
    ids = _seed()
    with SessionLocal() as db:
        db.add(Member(name="Plain Member", email="plain@example.org", password_hash=hash_password("PlainPassw0rd!")))
        db.add(Member(name="Staff", email="staff@example.org", password_hash=hash_password("StaffPassw0rd!"), is_admin=True))
        db.commit()
    body = {"approved": True}
    assert client.put(f"/admin/items/{ids['unapproved']}/public", json=body).status_code in (401, 403)  # anonymous
    tok = lambda e, p: client.post("/auth/login", json={"email": e, "password": p}).json()["access_token"]
    member = {"Authorization": "Bearer " + tok("plain@example.org", "PlainPassw0rd!")}
    assert client.put(f"/admin/items/{ids['unapproved']}/public", json=body, headers=member).status_code == 403
    assert client.get(f"/public/opportunities/{ids['unapproved']}").status_code == 404
    staff = {"Authorization": "Bearer " + tok("staff@example.org", "StaffPassw0rd!")}
    assert client.put(f"/admin/items/{ids['unapproved']}/public", json=body, headers=staff).status_code == 204
    assert client.get(f"/public/opportunities/{ids['unapproved']}").status_code == 200
    assert client.put(f"/admin/items/{ids['unapproved']}/public", json={"approved": False}, headers=staff).status_code == 204
    assert client.get(f"/public/opportunities/{ids['unapproved']}").status_code == 404
    with SessionLocal() as db:
        assert db.scalar(select(MonitoredItem.public_approved).where(MonitoredItem.id == ids["unknown"])) is None  # ingestion default: not public
