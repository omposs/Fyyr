"""Re-profile every member that has a website. Safe to run from cron, e.g. weekly:

    0 3 * * 1  cd /path/to/bsp-backend && .venv/bin/python -m app.refresh_profiles

Items seen again get a fresh last_seen_at (and source date); items not seen for
BSP_STALE_AFTER_DAYS are flagged stale in the API. Nothing is deleted automatically, and
company-authored or company-removed items are never touched (see app.agents.profiling).
Only hosts on BSP_FETCH_ALLOWED_DOMAINS are crawled. One failing member does not stop the rest.
"""
from __future__ import annotations

import sys
from urllib.parse import urlparse

from sqlalchemy import select

from app.agents.profiling import run_profiling
from app.config import get_settings
from app.db import SessionLocal, init_db
from app.models import Member
from app.schemas import SourceDocIn
from app.sources.crawler import crawl_site


def _site(host: str) -> str:
    return host.lower().removeprefix("www.")


def refresh_all() -> list[str]:
    init_db()
    allowed = {_site(d) for d in get_settings().fetch_allowed_domains}
    lines: list[str] = []
    with SessionLocal() as db:
        members = db.scalars(select(Member).where(Member.is_admin.is_(False), Member.website.is_not(None))).all()
        for m in members:
            host = _site(urlparse(m.website).hostname or "")
            if host not in allowed:
                lines.append(f"skip  {m.name}: {host or m.website} not in BSP_FETCH_ALLOWED_DOMAINS")
                continue
            try:
                pages = crawl_site(m.website)
                res = run_profiling(db, m, [SourceDocIn(url=p.url, title=m.name, text=p.text) for p in pages])
            except Exception as e:
                db.rollback()
                lines.append(f"FAIL  {m.name}: {type(e).__name__}: {e}")
                continue
            lines.append(f"ok    {m.name}: {len(pages)} pages, added={res.items_added} "
                         f"refreshed={res.items_refreshed} rejected={res.items_rejected} "
                         f"failed={len(res.sources_failed)}")
    return lines


if __name__ == "__main__":
    out = refresh_all()
    print("\n".join(out) or "No members with a website.")
    sys.exit(1 if any(line.startswith("FAIL") for line in out) else 0)
