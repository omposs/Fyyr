"""Profile one real company from a URL you choose.

    python -m app.profile_company "Ericsson" https://www.ericsson.com/en/about-us

The host of the URL you pass is allowed for this one fetch (you are the operator and chose it).
Creates the member if needed, fetches the page, runs the profiling agent, prints the result.
Run it on your own machine: the cloud sandbox cannot reach arbitrary sites.
"""
from __future__ import annotations

import sys
from urllib.parse import urlparse

from sqlalchemy import select

from app.agents.profiling import run_profiling, visible_items
from app.db import SessionLocal, init_db
from app.models import Member
from app.schemas import SourceDocIn
from app.sources.fetcher import FetchError, fetch_raw, html_to_text

MIN_USEFUL_CHARS = 500


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    name, url = argv[1], argv[2]
    host = urlparse(url).hostname or ""
    try:
        text = html_to_text(fetch_raw(url, [host]))
    except (FetchError, Exception) as e:
        print(f"Fetch failed: {type(e).__name__}: {e}")
        return 1
    print(f"Fetched {len(text)} characters of text from {url}")
    if len(text) < MIN_USEFUL_CHARS:
        print("WARNING: very little text. The page is probably rendered by JavaScript. Try a different "
              "page (an 'about' or press page), or paste the text in via POST /me/profile/run.")
    init_db()
    with SessionLocal() as db:
        m = db.scalar(select(Member).where(Member.name == name))
        if m is None:
            m = Member(name=name, website=url)
            db.add(m)
            db.commit()
        res = run_profiling(db, m, [SourceDocIn(url=url, title=name, text=text)])
        print(f"added={res.items_added} rejected={res.items_rejected}")
        for r in res.rejected_reasons[:10]:
            print(f"  rejected: {r}")
        for it in visible_items(db, m.id, viewer_is_owner=True):
            print(f"  {it.category:10s} {it.kind:8s} {it.visibility:7s} {it.value[:80]}")
        print(f"\nAPI token for {name}: {m.api_token}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
