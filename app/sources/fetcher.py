"""Guarded web fetching for the profiling agent.

Controls: https only, host allowlist, no private/loopback/link-local addresses (SSRF),
response size cap, timeout, and no redirects to other hosts. Fetched text is always
treated as untrusted data (see sanitize_untrusted).
"""
from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import urlparse

import httpx

from app.config import get_settings


class FetchError(Exception):
    pass


def _host_allowed(host: str, allowed: list[str]) -> bool:
    host = host.lower()
    return any(host == d.lower() or host.endswith("." + d.lower()) for d in allowed)


def _assert_public(host: str) -> None:
    try:
        infos = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise FetchError(f"DNS failure for {host}") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise FetchError(f"{host} resolves to a non-public address")


def check_url(url: str, allowed: list[str] | None = None) -> str:
    """`allowed` overrides the global allowlist (used by feeds, whose hosts come from trusted config)."""
    s = get_settings()
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        raise FetchError("Only https URLs are allowed")
    if not _host_allowed(p.hostname, s.fetch_allowed_domains if allowed is None else allowed):
        raise FetchError(f"Host {p.hostname} is not on the allowlist")
    _assert_public(p.hostname)
    return p.hostname


def fetch_text(url: str) -> str:
    return html_to_text(fetch_raw(url))


def fetch_raw(url: str, allowed: list[str] | None = None, max_redirects: int = 3) -> str:
    """GET with manual redirect handling: every hop is re-validated (https, allowlist, public IP)."""
    s = get_settings()
    current = url
    with httpx.Client(timeout=s.fetch_timeout_seconds, follow_redirects=False) as c:
        for _ in range(max_redirects + 1):
            check_url(current, allowed)
            r = c.get(current, headers={"User-Agent": "BlueScienceParkBot/0.1"})
            if 300 <= r.status_code < 400 and r.headers.get("location"):
                current = str(httpx.URL(current).join(r.headers["location"]))
                continue
            r.raise_for_status()
            if len(r.content) > s.fetch_max_bytes:
                raise FetchError("Response too large")
            return r.text
    raise FetchError("Too many redirects")


def html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript|template).*?</\1>", " ", html)
    html = re.sub(r"(?s)<!--.*?-->", " ", html)  # comments are a common injection hiding place
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", html).strip()
