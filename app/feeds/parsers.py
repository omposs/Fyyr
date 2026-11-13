"""Pure parsers: text in, list of dicts out. No network, so they are fully testable.

Output dict keys match what `app.monitoring.ingest.ingest` expects:
title, summary, url, published_at, starts_at, location, tags.
XML is parsed with defusedxml (entity-expansion and external-entity attacks are refused).
"""
from __future__ import annotations

import re
from datetime import date, datetime
from email.utils import parsedate_to_datetime

from defusedxml import ElementTree as ET
from defusedxml.common import DefusedXmlException

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


class FeedParseError(Exception):
    pass


def clean(text: str | None, limit: int = 4000) -> str:
    if not text:
        return ""
    import html

    return _WS.sub(" ", html.unescape(_TAG.sub(" ", text))).strip()[:limit]


def _d(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    try:
        return parsedate_to_datetime(value).date()  # RFC 822 (RSS)
    except (TypeError, ValueError):
        pass
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()  # ISO 8601 (Atom)
    except ValueError:
        return None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(el, name: str) -> str | None:
    for c in el:
        if _local(c.tag) == name and (c.text or "").strip():
            return c.text.strip()
    return None


def parse_feed(xml_text: str) -> list[dict]:
    """RSS 2.0 and Atom 1.0."""
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except (ET.ParseError, DefusedXmlException) as e:
        raise FeedParseError(f"Not valid or not safe XML: {e}") from e
    root_name = _local(root.tag)
    out: list[dict] = []
    if root_name == "rss":
        entries = [i for ch in root for i in ch if _local(i.tag) == "item"]
        for it in entries:
            tags = [(c.text or "").strip() for c in it if _local(c.tag) == "category" and (c.text or "").strip()]
            out.append({
                "title": clean(_child_text(it, "title"), 500),
                "summary": clean(_child_text(it, "description") or _child_text(it, "encoded")),
                "url": (_child_text(it, "link") or _child_text(it, "guid") or "").strip(),
                "published_at": _d(_child_text(it, "pubDate") or _child_text(it, "date")),
                "tags": tags[:20],
            })
    elif root_name == "feed":
        for it in (e for e in root if _local(e.tag) == "entry"):
            link = ""
            for c in it:
                if _local(c.tag) == "link" and c.get("rel", "alternate") == "alternate" and c.get("href"):
                    link = c.get("href")
                    break
            tags = [c.get("term", "") for c in it if _local(c.tag) == "category" and c.get("term")]
            out.append({
                "title": clean(_child_text(it, "title"), 500),
                "summary": clean(_child_text(it, "summary") or _child_text(it, "content")),
                "url": link,
                "published_at": _d(_child_text(it, "published") or _child_text(it, "updated")),
                "tags": tags[:20],
            })
    else:
        raise FeedParseError(f"Unrecognised feed root <{root_name}>")
    return [i for i in out if i["title"] and i["url"].startswith(("http://", "https://"))]


def _ical_unfold(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def _ical_text(v: str) -> str:
    return v.replace("\\n", " ").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")


def parse_ical(text: str) -> list[dict]:
    """Minimal VEVENT reader: SUMMARY, DESCRIPTION, URL, LOCATION, DTSTART, CATEGORIES."""
    out: list[dict] = []
    cur: dict | None = None
    for line in _ical_unfold(text):
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT" and cur is not None:
            title = clean(_ical_text(cur.get("SUMMARY", "")), 500)
            url = cur.get("URL", "").strip()
            if title and url.startswith(("http://", "https://")):
                out.append({
                    "title": title,
                    "summary": clean(_ical_text(cur.get("DESCRIPTION", ""))),
                    "url": url,
                    "starts_at": _ical_date(cur.get("DTSTART")),
                    "published_at": _ical_date(cur.get("CREATED") or cur.get("DTSTAMP")),
                    "location": clean(_ical_text(cur.get("LOCATION", "")), 200) or None,
                    "tags": [t.strip() for t in cur.get("CATEGORIES", "").split(",") if t.strip()][:20],
                })
            cur = None
        elif cur is not None and ":" in line:
            key, _, value = line.partition(":")
            cur.setdefault(key.split(";", 1)[0].upper(), value)
    return out


def _ical_date(v: str | None) -> date | None:
    if not v:
        return None
    m = re.match(r"(\d{4})(\d{2})(\d{2})", v.strip())
    try:
        return date(int(m[1]), int(m[2]), int(m[3])) if m else None
    except ValueError:
        return None
