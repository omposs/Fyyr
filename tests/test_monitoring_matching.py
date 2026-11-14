from datetime import date, timedelta

from sqlalchemy import select

from app.matching.matcher import recompute_matches
from app.models import MonitoredItem

from conftest import H


def test_recommendations_are_ranked_explained_and_skip_expired(client, tokens):
    recs = client.get("/me/recommendations", headers=H(tokens["Nautilab AB"])).json()
    assert recs
    titles = [r["title"] for r in recs]
    assert "Old Offshore Expo" not in titles  # already happened
    assert all(r["why_it_matters"].startswith("Why this matters:") for r in recs)
    assert [r["score"] for r in recs] == sorted((r["score"] for r in recs), reverse=True)
    assert all(r["basis_item_ids"] for r in recs)  # every explanation is grounded in real profile items
    prof = client.get("/me/profile", headers=H(tokens["Nautilab AB"])).json()
    known = {i["id"] for i in prof["stated"] + prof["inferred"]}
    assert all(set(r["basis_item_ids"]) <= known for r in recs)  # ...and only the member's own items


def test_module_filter_and_validation(client, tokens):
    r = client.get("/me/recommendations?module=funding", headers=H(tokens["FinFeed Systems"]))
    assert r.status_code == 200 and {x["module"] for x in r.json()} == {"funding"}
    assert client.get("/me/recommendations?module=bogus", headers=H(tokens["FinFeed Systems"])).status_code == 422


def test_inferred_interest_is_labelled_in_explanation(client, tokens):
    labelled = 0
    for name in ("Nautilab AB", "FinFeed Systems", "HullClean Nordic"):
        prof = client.get("/me/profile", headers=H(tokens[name])).json()
        inferred_ids = {i["id"] for i in prof["inferred"]}
        for r in client.get("/me/recommendations", headers=H(tokens[name])).json():
            if set(r["basis_item_ids"]) & inferred_ids:
                assert "inferred (unconfirmed)" in r["why_it_matters"]
                labelled += 1
    assert labelled > 0  # the check above actually ran on real data


def test_matches_complementary_and_grounded(client, tokens):
    ms = client.get("/me/matches", headers=H(tokens["Nautilab AB"])).json()
    names = [m["member"]["name"] for m in ms]
    assert "HullClean Nordic" in names
    hc = next(m for m in ms if m["member"]["name"] == "HullClean Nordic")
    types = {b["type"] for b in hc["basis"]}
    assert "complementary" in types  # HullClean seeks AUV partners, Nautilab builds AUVs
    for b in hc["basis"]:
        if b["their_item"]:
            assert b["their_item_source"]  # every cited item carries its source
    # perspective flips correctly for the other side
    back = client.get("/me/matches", headers=H(tokens["HullClean Nordic"])).json()
    nb = next(m for m in back if m["member"]["name"] == "Nautilab AB")
    # HullClean asks, Nautilab offers: each side must see the same fact worded from its own perspective
    mine = [b["label"] for b in hc["basis"] if b["type"] == "complementary"]      # Nautilab's view
    theirs = [b["label"] for b in nb["basis"] if b["type"] == "complementary"]    # HullClean's view
    assert mine and all(l.startswith("Your") and "priority of theirs" in l for l in mine)
    assert theirs and all(l.startswith("Their") and "priority of yours" in l for l in theirs)


def test_matching_never_uses_unpublished_items(client, db, tokens):
    # make every Nautilab item private -> no matches may mention it
    nauti = client.get("/me/profile", headers=H(tokens["Nautilab AB"])).json()
    for it in nauti["stated"]:
        client.patch(f"/me/profile/items/{it['id']}", json={"visibility": "private"}, headers=H(tokens["Nautilab AB"]))
    recompute_matches(db)
    ms = client.get("/me/matches", headers=H(tokens["HullClean Nordic"])).json()
    assert "Nautilab AB" not in [m["member"]["name"] for m in ms]


def test_unapproved_inferred_items_never_leak_into_matches(client, db, tokens):
    nauti = client.get("/me/profile", headers=H(tokens["Nautilab AB"])).json()
    inferred_vals = {i["value"] for i in nauti["inferred"]}
    ms = client.get("/me/matches", headers=H(tokens["HullClean Nordic"])).json()
    for m in ms:
        for b in m["basis"]:
            assert b["their_item"] not in inferred_vals or b["their_item"] in {
                i["value"] for i in nauti["stated"]}


def test_expiry_logic_uses_today(db, tokens, client):
    db.add(MonitoredItem(module="events", title="Yesterday sonar event", summary="sonar", url="https://x/y",
                         source_name="t", starts_at=date.today() - timedelta(days=1), tags=["sonar"]))
    db.commit()
    recs = client.get("/me/recommendations?module=events", headers=H(tokens["Nautilab AB"])).json()
    assert "Yesterday sonar event" not in [r["title"] for r in recs]
