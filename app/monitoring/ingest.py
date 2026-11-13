"""Feed ingestion for the four monitoring modules.

Connectors implement `fetch() -> list[dict]`. Today there is a seed-file connector; add RSS, API or
scraper connectors (events calendars, funding portals, testbed registries, news) behind the same
interface. Everything ingested is plain data and goes through `normalise` before storage.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.guardrails.injection import normalise
from app.models import Module, MonitoredItem


class FeedConnector(Protocol):
    module: str

    def fetch(self) -> list[dict]: ...


class SeedFileConnector:
    def __init__(self, path: Path, module: str):
        self.path, self.module = path, module

    def fetch(self) -> list[dict]:
        return json.loads(self.path.read_text(encoding="utf-8"))


def _d(v: str | None) -> date | None:
    return date.fromisoformat(v) if v else None


def ingest(db: Session, connector: FeedConnector) -> int:
    if connector.module not in {m.value for m in Module}:
        raise ValueError(f"Unknown module {connector.module!r}")
    known = set(db.scalars(select(MonitoredItem.url)).all())
    added = 0
    for raw in connector.fetch():
        url = str(raw["url"]).strip()
        if url in known:
            continue
        db.add(MonitoredItem(
            module=connector.module,
            title=normalise(raw["title"])[:500],
            summary=normalise(raw.get("summary", ""))[:4000],
            url=url,
            source_name=normalise(raw.get("source_name", "unknown"))[:200],
            published_at=_d(raw.get("published_at")),
            starts_at=_d(raw.get("starts_at")),
            location=normalise(raw["location"])[:200] if raw.get("location") else None,
            tags=[normalise(t)[:60] for t in raw.get("tags", [])][:20],
        ))
        known.add(url)
        added += 1
    db.commit()
    return added
