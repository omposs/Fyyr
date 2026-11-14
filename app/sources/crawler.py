"""Small, polite, bounded crawler for building a company profile from its own public site.

Starting from one URL it fetches the page, then up to (max_pages - 1) further pages that:
  * are on the same host (www and non-www are treated as the same site),
  * are https, have no query string, and are not files (pdf, images, archives ...),
  * are allowed by robots.txt for our user agent,
  * look informative: link paths containing words like about, products, technology, solutions ...
Pages are fetched one at a time with a delay. All fetches go through the guarded fetcher, so the
SSRF, size and redirect rules apply to every request.

This cannot render JavaScript. Sites that build their pages in the browser return little text.
"""
from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.config import get_settings
from app.sources.fetcher import FetchError, fetch_raw, html_to_text

Fetch = Callable[[str, list[str] | None], str]

_HREF = re.compile(r"""href\s*=\s*["']([^"'#][^"']*)["']""", re.IGNORECASE)
_SKIP_EXT = re.compile(
    r"\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|zip|gz|tar|mp4|mp3|mov|docx?|xlsx?|pptx?|xml|json|rss)$",
    re.IGNORECASE,
)
KEYWORDS = ("about", "company", "who-we-are", "what-we-do", "product", "solution", "technolog", "service",
            "offer", "business", "market", "industr", "research", "innovation", "capabilit", "portfolio")


@dataclass
class CrawledPage:
    url: str
    text: str


def _site_key(host: str) -> str:
    return host.lower().removeprefix("www.")


def _allowed_hosts(start_host: str) -> list[str]:
    base = _site_key(start_host)
    return [base, f"www.{base}"]


def load_robots(start_url: str, fetch: Fetch, allowed: list[str]) -> RobotFileParser | None:
    """None means 'could not decide, treat everything as disallowed' (the cautious reading of RFC 9309
    for server errors). A missing robots.txt (4xx) means everything is allowed."""
    p = urlparse(start_url)
    robots_url = f"{p.scheme}://{p.hostname}/robots.txt"
    rp = RobotFileParser()
    try:
        body = fetch(robots_url, allowed)
    except httpx.HTTPStatusError as e:
        if 400 <= e.response.status_code < 500:
            rp.parse([])  # no rules: allow all
            return rp
        return None
    except (FetchError, httpx.HTTPError):
        return None
    rp.parse(body.splitlines())
    return rp


def extract_links(html: str, base_url: str, site: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for href in _HREF.findall(html):
        url, _ = urldefrag(urljoin(base_url, href.strip()))
        u = urlparse(url)
        if u.scheme != "https" or not u.hostname or _site_key(u.hostname) != site:
            continue
        if u.query or _SKIP_EXT.search(u.path):
            continue
        norm = f"https://{u.hostname}{u.path.rstrip('/') or '/'}"
        if norm not in seen:
            seen.add(norm)
            out.append(norm)
    return out


def _score(url: str) -> int:
    path = urlparse(url).path.lower()
    return sum(1 for k in KEYWORDS if k in path)


def crawl_site(
    start_url: str,
    *,
    max_pages: int | None = None,
    delay: float | None = None,
    fetch: Fetch = fetch_raw,
    sleep: Callable[[float], None] = time.sleep,
) -> list[CrawledPage]:
    s = get_settings()
    max_pages = max_pages if max_pages is not None else s.crawl_max_pages
    delay = delay if delay is not None else s.crawl_delay_seconds
    host = urlparse(start_url).hostname
    if not host:
        raise FetchError("Invalid start URL")
    site = _site_key(host)
    allowed = _allowed_hosts(host)

    robots = load_robots(start_url, fetch, allowed)
    if robots is None:
        raise FetchError("robots.txt could not be read reliably; refusing to crawl")
    if not robots.can_fetch(s.crawl_user_agent, start_url):
        raise FetchError("robots.txt disallows fetching this page")

    first_html = fetch(start_url, allowed)
    pages = [CrawledPage(start_url, html_to_text(first_html))]

    candidates = sorted(extract_links(first_html, start_url, site), key=lambda u: (-_score(u), len(u)))
    start_norm = f"https://{host}{urlparse(start_url).path.rstrip('/') or '/'}"
    for url in candidates:
        if len(pages) >= max_pages:
            break
        if url == start_norm or _score(url) == 0:  # only follow links that look informative
            continue
        if not robots.can_fetch(s.crawl_user_agent, url):
            continue
        sleep(delay)
        try:
            pages.append(CrawledPage(url, html_to_text(fetch(url, allowed))))
        except (FetchError, httpx.HTTPError):
            continue  # one dead link must not sink the crawl
    return [p for p in pages if p.text]
