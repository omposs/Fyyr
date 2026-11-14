from sqlalchemy import select

from app.agents.profiling import run_profiling
from app.llm import set_provider
from app.models import AuditLog, Member, ProfileItem
from app.schemas import SourceDocIn

from conftest import H


def test_every_item_has_source_and_date_and_kinds_are_separated(client, tokens):
    r = client.get("/me/profile", headers=H(tokens["Nautilab AB"]))
    assert r.status_code == 200
    body = r.json()
    assert body["stated"] and body["inferred"]
    for it in body["stated"] + body["inferred"]:
        assert it["source_url"] and it["source_date"]
    assert all(i["kind"] == "stated" for i in body["stated"])
    assert all(i["kind"] == "inferred" for i in body["inferred"])
    # inferred interests are private and unapproved until the company reviews them
    assert all(i["visibility"] == "private" and not i["approved"] for i in body["inferred"])
    # stated evidence is a real quote from the source
    assert all(i["evidence"] for i in body["stated"])


class HallucinatingProvider:
    name = "fake"

    def structured(self, **kw):
        return {"items": [
            {"category": "product", "value": "Quantum hull coating", "kind": "stated",
             "evidence": "We sell a quantum hull coating to NATO", "confidence": 0.9},
            {"category": "market", "value": "shipping", "kind": "stated",
             "evidence": "shipping markets", "confidence": 0.9},
            {"category": "bogus", "value": "x", "kind": "stated", "evidence": "x"},
            {"category": "market", "value": "ports", "kind": "inferred", "evidence": ""},
        ]}

    def chat(self, **kw):
        return ""


def test_stated_items_without_verbatim_evidence_are_rejected(db):
    set_provider(HallucinatingProvider())
    m = Member(name="Acme")
    db.add(m)
    db.commit()
    res = run_profiling(db, m, [SourceDocIn(url="https://acme.example", text="Acme works in shipping markets in Sweden.")])
    assert res.items_added == 1  # only the one backed by a real quote
    assert res.items_rejected == 3
    items = db.scalars(select(ProfileItem).where(ProfileItem.member_id == m.id)).all()
    assert [i.value for i in items] == ["shipping"]


def test_injection_in_source_is_flagged_and_items_held_back(db, tokens):
    flagged = db.scalars(select(AuditLog).where(AuditLog.action == "source_flagged_injection")).all()
    assert len(flagged) == 1  # FinFeed's hidden HTML comment
    fin = db.scalar(select(Member).where(Member.name == "FinFeed Systems"))
    items = db.scalars(select(ProfileItem).where(ProfileItem.member_id == fin.id)).all()
    assert items and all(i.visibility == "private" for i in items)


def test_company_edits_are_final(client, db, tokens):
    tok = tokens["Nautilab AB"]
    prof = client.get("/me/profile", headers=H(tok)).json()
    item = next(i for i in prof["stated"] if i["category"] == "technology")
    # edit: becomes company-authored with company-edit source
    r = client.patch(f"/me/profile/items/{item['id']}", json={"value": "ultrasonic imaging"}, headers=H(tok))
    assert r.status_code == 200 and r.json()["origin"] == "company" and r.json()["source_url"] == "company-edit"
    # delete another item, then re-run the agent on the same source: neither comes back or is overwritten
    other = next(i for i in prof["stated"] if i["category"] == "geography")
    assert client.delete(f"/me/profile/items/{other['id']}", headers=H(tok)).status_code == 204
    m = db.scalar(select(Member).where(Member.name == "Nautilab AB"))
    from app.seed import DEMO
    run_profiling(db, m, [DEMO["Nautilab AB"]])
    after = client.get("/me/profile", headers=H(tok)).json()
    vals = [i["value"] for i in after["stated"]]
    assert "ultrasonic imaging" in vals
    assert other["value"] not in vals


def test_cannot_touch_another_members_items(client, tokens):
    nauti = client.get("/me/profile", headers=H(tokens["Nautilab AB"])).json()["stated"][0]
    r = client.patch(f"/me/profile/items/{nauti['id']}", json={"value": "hacked"}, headers=H(tokens["HullClean Nordic"]))
    assert r.status_code == 404
    assert client.delete(f"/me/profile/items/{nauti['id']}", headers=H(tokens["HullClean Nordic"])).status_code == 404


def test_public_profile_hides_inferred_and_private(client, tokens):
    me = client.get("/me", headers=H(tokens["Nautilab AB"])).json()
    pub = client.get(f"/members/{me['id']}/profile", headers=H(tokens["HullClean Nordic"])).json()
    private_vals = {i["value"] for i in client.get("/me/profile", headers=H(tokens["Nautilab AB"])).json()["inferred"]}
    assert private_vals  # there are inferred items
    assert not private_vals & {i["value"] for i in pub["items"]}
    assert all(i["kind"] == "stated" for i in pub["items"])


def test_auth_required(client, tokens):
    assert client.get("/me/profile").status_code == 401
    assert client.get("/me/profile", headers=H("nope")).status_code == 401
    assert client.post("/admin/members", json={"name": "x"}, headers=H(tokens["Nautilab AB"])).status_code == 403
