"""Config-driven feed connector and CLI helpers.

`data/feeds.json` lists feeds. Each entry:
  name      shown as source_name
  module    events | funding | testbeds | news
  kind      rss | ical      (rss covers RSS 2.0 and Atom)
  url       https only
  enabled   false = skipped
  verified  informational: has someone confirmed from a real network that it works?
  include   optional list of keywords; an item must contain at least one (case-insensitive)
  location  optional default location for items that carry none
  max_summary_chars  stored excerpt length (default 300 for news, 1000 otherwise). We store an excerpt and the link,
                     not the article.
  max_age_days       drop items published longer ago than this (default 45 for news, none otherwise);
                     items with no date are kept
The feed config is trusted (it lives in the repo), so its hosts form the fetch allowlist for feeds.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

from app.feeds.parsers import FeedParseError, excerpt, parse_feed, parse_ical
from app.sources.fetcher import FetchError, fetch_raw

MODULES = {"events", "funding", "testbeds", "news"}


class ConfigError(Exception):
    pass


@dataclass
class FeedSpec:
    name: str
    module: str
    kind: str
    url: str
    enabled: bool = True
    verified: bool = False
    include: list[str] = field(default_factory=list)
    location: str | None = None
    max_summary_chars: int | None = None
    max_age_days: int | None = None
    note: str = ""  # free text for humans: where the URL came from, what was checked

    @property
    def host(self) -> str:
        return urlparse(self.url).hostname or ""

    @property
    def summary_limit(self) -> int:
        return self.max_summary_chars or (300 if self.module == "news" else 1000)

    @property
    def age_limit(self) -> int | None:
        return self.max_age_days if self.max_age_days is not None else (45 if self.module == "news" else None)


def load_specs(path: Path) -> list[FeedSpec]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise ConfigError(f"Cannot read {path}: {e}") from e
    specs: list[FeedSpec] = []
    for i, r in enumerate(raw):
        try:
            spec = FeedSpec(**r)
        except TypeError as e:
            raise ConfigError(f"feeds[{i}]: {e}") from e
        if spec.module not in MODULES:
            raise ConfigError(f"feeds[{i}] {spec.name!r}: unknown module {spec.module!r}")
        if spec.kind not in ("rss", "ical"):
            raise ConfigError(f"feeds[{i}] {spec.name!r}: unknown kind {spec.kind!r}")
        if not spec.url.startswith("https://"):
            raise ConfigError(f"feeds[{i}] {spec.name!r}: url must be https")
        for name in ("max_summary_chars", "max_age_days"):
            v = getattr(spec, name)
            if v is not None and (not isinstance(v, int) or v <= 0):
                raise ConfigError(f"feeds[{i}] {spec.name!r}: {name} must be a positive integer")
        specs.append(spec)
    return specs


class FeedConnector:
    """Implements the FeedConnector protocol used by app.monitoring.ingest."""

    def __init__(self, spec: FeedSpec, allowed_hosts: list[str]):
        self.spec, self.allowed, self.module = spec, allowed_hosts, spec.module

    def fetch(self, today: date | None = None) -> list[dict]:
        text = fetch_raw(self.spec.url, self.allowed)
        items = parse_ical(text) if self.spec.kind == "ical" else parse_feed(text)
        limit = self.spec.age_limit
        now = today or date.today()
        oldest = now - timedelta(days=limit) if limit else None
        out = []
        for it in items:
            # An event or deadline that has already happened is useless to show; do not even store it.
            if self.spec.module in ("events", "funding") and it.get("starts_at") and it["starts_at"] < now:
                continue
            if oldest and it.get("published_at") and it["published_at"] < oldest:
                continue
            it["summary"] = excerpt(it.get("summary", ""), self.spec.summary_limit)
            if self.spec.include:
                blob = f"{it['title']} {it.get('summary', '')} {' '.join(it.get('tags', []))}".lower()
                if not any(k.lower() in blob for k in self.spec.include):
                    continue
            it["source_name"] = self.spec.name
            if not it.get("location") and self.spec.location:
                it["location"] = self.spec.location
            out.append(it)
        return out


def check(spec: FeedSpec, allowed_hosts: list[str]) -> tuple[bool, str]:
    """Network probe used by `python -m app.feeds check`."""
    try:
        items = FeedConnector(spec, allowed_hosts).fetch()
    except (FetchError, FeedParseError) as e:
        return False, str(e)
    except Exception as e:  # network errors, HTTP status errors
        return False, f"{type(e).__name__}: {e}"
    if not items:
        return True, "reachable and parsed, but 0 items (after include filter)"
    return True, f"{len(items)} items; newest: {items[0]['title'][:70]!r}"
