import json
import shutil
from pathlib import Path

import pytest

from app.eval import __main__ as cli
from app.eval.metrics import Forbidden, Label, same_concept, score_profile, score_ranking
from app.eval.runner import EvalConfigError, eval_profiles, eval_ranking, load_profile_labels, save_and_diff, split_pages
from app.llm import set_provider

EXAMPLE = Path("data/eval/example")


@pytest.mark.parametrize("a,b,expected", [
    ("5G", "5G networks", True),
    ("autonomous underwater vehicle", "Autonomous Underwater Vehicles", True),
    ("radio", "radio access networks", False),          # generic single word must not match a long label
    ("machine learning", "learning", True),             # subset covering half
    ("offshore wind", "wind", True),
    ("offshore wind", "offshore oil", False),
    ("sonar", "radar", False),
    ("", "x", False),
])
def test_same_concept(a, b, expected):
    assert same_concept(a, b) is expected


def test_score_profile_arithmetic():
    labels = [Label("technology", "5G"), Label("market", "defence"), Label("geography", "Sweden"),
              Label("product", "AUV", aliases=["autonomous underwater vehicle"])]
    extracted = [("technology", "5G networks"), ("geography", "Sweden"), ("product", "autonomous underwater vehicles"),
                 ("market", "retail"), ("market", "aquaculture")]
    r = score_profile(labels, extracted, [Forbidden("aquaculture")])
    assert (r["labels"], r["found"], r["extracted"], r["correct"]) == (4, 3, 5, 3)
    assert r["recall"] == 0.75 and r["precision"] == 0.6
    assert r["missed"] == ["market: defence"]
    assert r["unmatched_extracted"] == ["market: retail", "market: aquaculture"]
    assert r["forbidden_hits"] == ["market: aquaculture"]
    assert r["recall_by_category"]["market"]["recall"] == 0.0
    assert round(r["f1"], 3) == round(2 * 0.6 * 0.75 / 1.35, 3)


def test_category_must_agree_unless_also_categories():
    assert score_profile([Label("product", "sonar")], [("technology", "sonar")], [])["found"] == 0
    assert score_profile([Label("product", "sonar", also_categories=["technology"])], [("technology", "sonar")], [])["found"] == 1


def test_score_profile_empty_extraction_is_zero_not_missing():
    r = score_profile([Label("market", "x")], [], [])
    assert r["recall"] == 0.0 and r["precision"] is None and r["f1"] == 0.0


def test_score_ranking():
    r = score_ranking([True, False, True, False, False, True], total_relevant=4, total_items=10)
    assert r["precision_at_5"] == 0.4 and r["recall_at_10"] == 0.75 and r["first_relevant_rank"] == 1
    assert r["base_rate"] == 0.4 and r["lift_over_base_rate"] == 1.0
    empty = score_ranking([], total_relevant=3, total_items=10)
    assert empty["precision_at_5"] is None and empty["recall_at_10"] == 0.0 and empty["first_relevant_rank"] is None


def test_split_pages():
    docs = split_pages("=== https://a.org/1 ===\nfoo\n=== https://a.org/2 ===\nbar\n", "eval://x")
    assert docs == [("https://a.org/1", "foo"), ("https://a.org/2", "bar")]
    assert split_pages("plain text", "eval://x") == [("eval://x", "plain text")]
    assert split_pages("   ", "eval://x") == []


def test_label_validation(tmp_path):
    def write(obj):
        p = tmp_path / "c.json"
        p.write_text(json.dumps(obj))
        return p

    for bad in ({"items": [{"category": "colour", "value": "x"}]},
                {"items": [{"category": "market", "value": "  "}]},
                {"items": [{"category": "market", "value": "x", "aliases": "nope"}]},
                {"items": [{"category": "market", "value": "x", "also_categories": ["bad"]}]},
                {"must_not": [{"value": ""}]}):
        with pytest.raises(EvalConfigError):
            load_profile_labels(write(bad))
    (tmp_path / "broken.json").write_text("{not json")
    with pytest.raises(EvalConfigError):
        load_profile_labels(tmp_path / "broken.json")


def test_shipped_example_runs_and_is_sane():
    r = eval_profiles(EXAMPLE)
    assert r["aggregate"]["companies"] == 1 and not r["skipped"]
    c = r["companies"][0]
    assert c["labels"] == 15 and 0 < c["recall"] <= 1 and c["forbidden_hits"] == []
    k = eval_ranking(EXAMPLE)
    assert k["aggregate"]["companies"] == 1 and k["companies"][0]["precision_at_5"] is not None


class _Stub:
    name = "stub"

    def __init__(self, items):
        self.items = items

    def structured(self, *, task, system, user, schema):
        return {"items": self.items}

    def chat(self, **kw):
        return ""


def _copy_example(tmp_path):
    dst = tmp_path / "eval"
    shutil.copytree(EXAMPLE, dst, ignore=shutil.ignore_patterns("results"))
    return dst


def test_perfect_extraction_scores_one(tmp_path):
    root = _copy_example(tmp_path)
    page = (root / "pages" / "nordhav-subsea.txt").read_text()
    quote = lambda s: s if s in page else pytest.fail(s)  # noqa: E731
    labels = json.loads((root / "profiles" / "nordhav-subsea.json").read_text())["items"]
    items = [{"category": l["category"], "value": l["value"], "kind": "stated", "confidence": 0.9,
              "evidence": quote({"sonar systems": "sonar systems", "autonomous underwater vehicles": "autonomous underwater vehicles",
                                 "subsea inspection software": "inspection software", "machine learning": "machine learning",
                                 "sonar": "sonar", "offshore wind": "offshore wind", "marine research": "marine research",
                                 "ports": "ports market", "Karlskrona": "Karlskrona", "Sweden": "Sweden",
                                 "Baltic Sea": "Baltic Sea", "Denmark": "Denmark", "test sites": "test sites",
                                 "research partners": "research partners",
                                 "reduce the cost of offshore maintenance": "reduce the cost of offshore maintenance"}[l["value"]])}
             for l in labels]
    set_provider(_Stub(items))
    try:
        c = eval_profiles(root)["companies"][0]
    finally:
        set_provider(None)
    assert c["recall"] == 1.0 and c["precision"] == 1.0 and c["missed"] == [] and c["forbidden_hits"] == []


def test_invented_item_is_rejected_by_agent_but_must_not_catches_real_quote_misuse(tmp_path):
    root = _copy_example(tmp_path)
    items = [
        # invented: quote not in page -> the agent's own rule drops it; it never reaches the score
        {"category": "market", "value": "aquaculture", "kind": "stated", "evidence": "we farm salmon", "confidence": 0.9},
        # real quote, wrong conclusion: only must_not can catch this
        {"category": "market", "value": "defence", "kind": "stated", "evidence": "ports market", "confidence": 0.9},
    ]
    set_provider(_Stub(items))
    try:
        c = eval_profiles(root)["companies"][0]
    finally:
        set_provider(None)
    assert c["rejected_by_agent"] >= 1
    assert c["forbidden_hits"] == ["market: defence"] and c["extracted"] == 1 and c["precision"] == 0.0


def test_missing_labels_or_pages_are_skipped_with_reason(tmp_path):
    root = tmp_path / "e"
    (root / "profiles").mkdir(parents=True)
    (root / "profiles" / "empty.json").write_text(json.dumps({"company": "E", "items": []}))
    (root / "profiles" / "nopage.json").write_text(json.dumps({"company": "N", "items": [{"category": "market", "value": "x"}]}))
    r = eval_profiles(root)
    assert r["aggregate"]["companies"] == 0 and len(r["skipped"]) == 2
    assert "no labels" in r["skipped"][0] or "no labels" in r["skipped"][1]
    assert any("snapshot" in s for s in r["skipped"])


def test_ranking_needs_complete_labels_and_detects_bad_ordering(tmp_path):
    root = _copy_example(tmp_path)
    p = root / "ranking" / "nordhav-subsea.json"
    d = json.loads(p.read_text())
    good = eval_ranking(root)["companies"][0]["precision_at_5"]
    for it in d["items"]:
        it["relevant"] = not it["relevant"]  # invert truth: a sane ranker must now score badly
    p.write_text(json.dumps(d))
    bad = eval_ranking(root)["companies"][0]["precision_at_5"]
    assert good > bad and bad < 0.5
    d["items"][0]["relevant"] = None
    p.write_text(json.dumps(d))
    r = eval_ranking(root)
    assert r["aggregate"]["companies"] == 0 and "no true/false" in r["skipped"][0]


def test_save_and_diff(tmp_path):
    res = {"kind": "profiles", "aggregate": {"provider": "mock", "companies": 1, "recall": 0.5, "precision": 0.8}}
    assert save_and_diff(tmp_path, res) == {}
    res["aggregate"] = {"provider": "mock", "companies": 1, "recall": 0.7, "precision": 0.8}
    assert save_and_diff(tmp_path, res) == {"recall": 0.2}
    res["aggregate"]["provider"] = "other"
    assert save_and_diff(tmp_path, res) == {}  # separate history per provider


def test_cli_run_snapshot_and_labelsheet(tmp_path, tokens, monkeypatch, capsys):
    root = _copy_example(tmp_path)
    assert cli.main(["run", "--dir", str(root)]) == 0
    out = capsys.readouterr().out
    assert "recall" in out and "precision@5" in out and "OVERALL" in out

    class P:
        def __init__(self, url, text):
            self.url, self.text = url, text

    import app.sources.crawler as crawler
    monkeypatch.setattr(crawler, "crawl_site", lambda url: [P(url, "Acme builds robots in Lund. " * 30)])
    assert cli.main(["snapshot", "acme", "Acme AB", "https://acme.example", "--dir", str(root)]) == 0
    assert "=== https://acme.example ===" in (root / "pages" / "acme.txt").read_text()
    tmpl = json.loads((root / "profiles" / "acme.json").read_text())
    assert tmpl["items"] == [] and tmpl["company"] == "Acme AB"
    assert cli.main(["snapshot", "acme", "Acme AB", "https://acme.example", "--dir", str(root)]) == 0  # keeps labels
    assert "already exists" in capsys.readouterr().out

    from app.db import SessionLocal
    from app.models import MonitoredItem
    with SessionLocal() as db:
        db.query(MonitoredItem).delete()
        db.commit()
    assert cli.main(["labelsheet", "acme", "Acme AB", "--limit", "5", "--dir", str(root)]) == 1  # no news yet
    with SessionLocal() as db:
        db.add(MonitoredItem(module="news", title="T", summary="S", url="https://n/1", source_name="x"))
        db.commit()
    assert cli.main(["labelsheet", "acme", "Acme AB", "--dir", str(root)]) == 0
    sheet = json.loads((root / "ranking" / "acme.json").read_text())
    assert sheet["items"][0]["relevant"] is None
    assert cli.main(["labelsheet", "acme", "Acme AB", "--dir", str(root)]) == 2  # refuses to overwrite labels
