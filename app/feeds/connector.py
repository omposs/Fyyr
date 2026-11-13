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
The feed config is trusted (it lives in the repo), so its hosts form the fetch allowlist for feeds.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from app.feeds.parsers import FeedParseError, parse_feed, parse_ical
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

    @property
    def host(self) -> str:
        return urlparse(self.url).hostname or ""


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
        specs.append(spec)
    return specs


class FeedConnector:
    """Implements the FeedConnector protocol used by app.monitoring.ingest."""

    def __init__(self, spec: FeedSpec, allowed_hosts: list[str]):
        self.spec, self.allowed, self.module = spec, allowed_hosts, spec.module

    def fetch(self) -> list[dict]:
        text = fetch_raw(self.spec.url, self.allowed)
        items = parse_ical(text) if self.spec.kind == "ical" else parse_feed(text)
        out = []
        for it in items:
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
