"""Measure quality against hand-made labels.

    python -m app.eval run                      # profiles + ranking, using data/eval
    python -m app.eval run --only profiles
    python -m app.eval run --dir data/eval/example     # the shipped fictional example
    python -m app.eval snapshot ericsson "Ericsson" https://www.ericsson.com/en/about-us
    python -m app.eval labelsheet ericsson "Ericsson" --limit 40

Uses whichever LLM provider BSP_LLM_PROVIDER selects, so the same labels compare mock, Ollama and Claude.
Run `snapshot` and `labelsheet` on your own machine (network / your database).
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from app.config import get_settings
from app.eval.runner import EvalConfigError, eval_profiles, eval_ranking, save_and_diff


def _fmt(v) -> str:
    return "n/a" if v is None else (f"{v:.2f}" if isinstance(v, float) else str(v))


def _print_profiles(r: dict) -> None:
    for c in r["companies"]:
        print(f"\n{c['company']}: recall {_fmt(c['recall'])} ({c['found']}/{c['labels']} labelled items found), "
              f"precision vs labels {_fmt(c['precision'])} ({c['correct']}/{c['extracted']} stated items match a label)")
        print("  recall by category: " + ", ".join(f"{k} {_fmt(v['recall'])}" for k, v in c["recall_by_category"].items()))
        print(f"  inferred items (not scored): {c['inferred_unscored']}; rejected by the agent's own checks: {c['rejected_by_agent']}")
        if c["sources_failed"]:
            print(f"  SOURCES FAILED (scores below are meaningless): {c['sources_failed']}")
        if c["forbidden_hits"]:
            print(f"  HALLUCINATION: extracted things marked must_not: {c['forbidden_hits']}")
        for title, key in (("missed (in your labels, not extracted)", "missed"),
                           ("extracted but not in your labels (wrong, or your labels are incomplete: check each)", "unmatched_extracted")):
            if c[key]:
                print(f"  {title}:")
                for x in c[key][:15]:
                    print(f"    - {x}")
                if len(c[key]) > 15:
                    print(f"    ... and {len(c[key]) - 15} more")


def _print_ranking(r: dict) -> None:
    for c in r["companies"]:
        print(f"\n{c['company']}: precision@5 {_fmt(c['precision_at_5'])} over {c['shown']} shown "
              f"(base rate {_fmt(c['base_rate'])}, lift x{_fmt(c['lift_over_base_rate'])}), "
              f"recall@10 {_fmt(c['recall_at_10'])}, first relevant at rank {_fmt(c['first_relevant_rank'])}")
        if c["irrelevant_in_top"]:
            print("  irrelevant items in the top 5:")
            for t in c["irrelevant_in_top"]:
                print(f"    - {t}")
        if c["relevant_not_shown"]:
            print("  relevant items the system did not show at all:")
            for t in c["relevant_not_shown"]:
                print(f"    - {t}")


def cmd_run(args) -> int:
    root = Path(args.dir or get_settings().eval_dir)
    if not root.exists():
        print(f"{root} does not exist.")
        return 2
    results = []
    try:
        if args.only in (None, "profiles"):
            results.append(eval_profiles(root))
        if args.only in (None, "ranking"):
            results.append(eval_ranking(root))
    except EvalConfigError as e:
        print(f"Label file problem: {e}")
        return 2
    for r in results:
        a = r["aggregate"]
        print(f"\n===== {r['kind']} | provider: {a['provider']} | companies scored: {a['companies']} =====")
        (_print_profiles if r["kind"] == "profiles" else _print_ranking)(r)
        for s in r["skipped"]:
            print(f"  skipped {s}")
        if a["companies"]:
            summary = ", ".join(f"{k} {_fmt(v)}" for k, v in a.items() if k not in ("companies", "provider"))
            print(f"\n  OVERALL: {summary}")
            delta = save_and_diff(root, r)
            print("  change since last run with this provider: " + (", ".join(f"{k} {v:+}" for k, v in delta.items()) or "none"))
        else:
            print("  Nothing scored yet.")
    print("\nNote: precision only counts what your labels list. Check the 'extracted but not in your labels' lines "
          "and add anything that is actually correct to the label file, otherwise precision is understated.")
    return 0


def cmd_snapshot(args) -> int:
    from app.sources.crawler import crawl_site

    root = Path(args.dir or get_settings().eval_dir)
    try:
        pages = crawl_site(args.url)
    except Exception as e:
        print(f"Crawl failed: {type(e).__name__}: {e}")
        return 1
    (root / "pages").mkdir(parents=True, exist_ok=True)
    (root / "profiles").mkdir(parents=True, exist_ok=True)
    (root / "pages" / f"{args.slug}.txt").write_text(
        "\n".join(f"=== {p.url} ===\n{p.text}\n" for p in pages), encoding="utf-8")
    total = sum(len(p.text) for p in pages)
    print(f"Saved {len(pages)} page(s), {total} characters to {root / 'pages' / (args.slug + '.txt')}")
    if total < 500:
        print("WARNING: very little text; the site is probably rendered by JavaScript. Try another page.")
    lab = root / "profiles" / f"{args.slug}.json"
    if not lab.exists():
        lab.write_text(json.dumps({
            "company": args.company, "source_url": args.url, "page": f"{args.slug}.txt",
            "how_to_label": ("Read the saved page and list what a careful person would extract. category is one of "
                             "product, technology, market, geography, priority. Add 'aliases' for other wordings. "
                             "Use 'also_categories' where product vs technology is a judgement call. "
                             "Put things the page does NOT say but a model might invent under must_not."),
            "items": [],
            "must_not": [],
        }, indent=2) + "\n", encoding="utf-8")
        print(f"Created label template {lab}. Fill in 'items' by reading the saved page.")
    else:
        print(f"Label file {lab} already exists; left unchanged.")
    return 0


def cmd_labelsheet(args) -> int:
    from sqlalchemy import select
    from app.db import SessionLocal, init_db
    from app.models import MonitoredItem

    root = Path(args.dir or get_settings().eval_dir)
    out = root / "ranking" / f"{args.slug}.json"
    if out.exists() and not args.force:
        print(f"{out} exists; use --force to overwrite (this would discard your labels).")
        return 2
    init_db()
    with SessionLocal() as db:
        rows = db.scalars(select(MonitoredItem).where(MonitoredItem.module == "news")
                          .order_by(MonitoredItem.published_at.desc().nullslast(), MonitoredItem.id.desc())
                          .limit(args.limit)).all()
    if not rows:
        print("No news items in the database. Run: python -m app.feeds ingest")
        return 1
    now = date.today()
    items = [{"title": r.title, "summary": r.summary, "relevant": None,
              "published_days_ago": max((now - r.published_at).days, 0) if r.published_at else 3,
              **({"location": r.location} if r.location else {})} for r in rows]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"company": args.company, "profile_from": args.slug,
                               "how_to_label": f"Set relevant to true or false for each item: would a person at {args.company} want to see it?",
                               "items": items}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} items to {out}. Set each 'relevant' to true or false.")
    return 0


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="python -m app.eval", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="score profiling and ranking against labels")
    r.add_argument("--only", choices=["profiles", "ranking"])
    r.add_argument("--dir")
    r.set_defaults(fn=cmd_run)
    s = sub.add_parser("snapshot", help="crawl a company site and save its text for repeatable evaluation")
    s.add_argument("slug"); s.add_argument("company"); s.add_argument("url"); s.add_argument("--dir")
    s.set_defaults(fn=cmd_snapshot)
    l = sub.add_parser("labelsheet", help="export ingested news items to a file you label true/false")
    l.add_argument("slug"); l.add_argument("company"); l.add_argument("--limit", type=int, default=40)
    l.add_argument("--dir"); l.add_argument("--force", action="store_true")
    l.set_defaults(fn=cmd_labelsheet)
    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
