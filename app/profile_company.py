"""Profile one real company from a URL you choose.

    python -m app.profile_company "Ericsson" https://www.ericsson.com/en/about-us

You are the operator and chose the URL, so its host is allowed for this crawl. The crawler follows a few
same-site pages (about, products, technology ...), honours robots.txt, then runs the profiling agent.
Run it on your own machine: the cloud sandbox cannot reach arbitrary sites.
"""
from __future__ import annotations

import sys
from sqlalchemy import select

from app.agents.profiling import run_profiling, visible_items
from app.db import SessionLocal, init_db
from app.models import Member
from app.schemas import SourceDocIn
from app.sources.crawler import crawl_site

MIN_USEFUL_CHARS = 500


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    name, url = argv[1], argv[2]
    try:
        pages = crawl_site(url)
    except Exception as e:
        print(f"Crawl failed: {type(e).__name__}: {e}")
        return 1
    total = sum(len(p.text) for p in pages)
    print(f"Fetched {len(pages)} page(s), {total} characters of text:")
    for p in pages:
        print(f"  {len(p.text):7d}  {p.url}")
    if total < MIN_USEFUL_CHARS:
        print("WARNING: very little text. The page is probably rendered by JavaScript. Try a different "
              "page (an 'about' or press page), or paste the text in via POST /me/profile/run.")
    init_db()
    with SessionLocal() as db:
        m = db.scalar(select(Member).where(Member.name == name))
        if m is None:
            m = Member(name=name, website=url)
            db.add(m)
            db.commit()
        res = run_profiling(db, m, [SourceDocIn(url=p.url, title=name, text=p.text) for p in pages])
        print(f"added={res.items_added} refreshed={res.items_refreshed} rejected={res.items_rejected}")
        for f in res.sources_failed:
            print(f"  FAILED: {f}")
        for r in res.rejected_reasons[:10]:
            print(f"  rejected: {r}")
        for it in visible_items(db, m.id, viewer_is_owner=True):
            print(f"  {it.category:10s} {it.kind:8s} {it.visibility:7s} {it.value[:80]}")
        print(f"\nAPI token for {name}: {m.api_token}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
