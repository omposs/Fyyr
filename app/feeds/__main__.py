"""CLI:  python -m app.feeds check     probe every enabled feed, print what works
        python -m app.feeds ingest    fetch enabled feeds and store new items
"""
from __future__ import annotations

import sys
from pathlib import Path

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.feeds.connector import ConfigError, FeedConnector, check, load_specs
from app.monitoring.ingest import ingest


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "check"
    path = Path(get_settings().feeds_file)
    try:
        specs = [s for s in load_specs(path) if s.enabled]
    except ConfigError as e:
        print(f"Config error: {e}")
        return 2
    allowed = sorted({s.host for s in specs})
    if not specs:
        print(f"No enabled feeds in {path}")
        return 0

    if cmd == "check":
        bad = 0
        for s in specs:
            ok, msg = check(s, allowed)
            bad += not ok
            print(f"{'OK  ' if ok else 'FAIL'} [{s.module:8s}] {s.name}: {msg}")
        print(f"\n{len(specs) - bad}/{len(specs)} feeds working. Set enabled=false or fix the url for the failures.")
        return 1 if bad else 0

    if cmd == "ingest":
        init_db()
        total = 0
        with SessionLocal() as db:
            for s in specs:
                try:
                    n = ingest(db, FeedConnector(s, allowed))
                except Exception as e:  # one broken feed must not stop the rest
                    print(f"FAIL {s.name}: {type(e).__name__}: {e}")
                    continue
                total += n
                print(f"ok   {s.name}: {n} new")
        print(f"\n{total} new items stored.")
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
