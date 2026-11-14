"""Ingest every enabled feed in feeds.json. Shared by `python -m app.feeds ingest` and the background scheduler."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.feeds.connector import FeedConnector, load_specs
from app.monitoring.ingest import ingest


def ingest_all(db: Session, path: Path | None = None) -> tuple[int, list[str]]:
    """Returns (new items stored, one status line per feed). A broken feed is reported, not raised.
    Raises ConfigError if feeds.json itself is unreadable."""
    specs = [s for s in load_specs(path or Path(get_settings().feeds_file)) if s.enabled]
    allowed = sorted({s.host for s in specs})
    total, lines = 0, []
    for s in specs:
        try:
            n = ingest(db, FeedConnector(s, allowed))
        except Exception as e:  # one broken feed must not stop the rest
            db.rollback()
            lines.append(f"FAIL {s.name}: {type(e).__name__}: {e}")
            continue
        total += n
        lines.append(f"ok   {s.name}: {n} new")
    return total, lines
