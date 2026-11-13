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


def check_url(url: str) -> str:
    s = get_settings()
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        raise FetchError("Only https URLs are allowed")
    if not _host_allowed(p.hostname, s.fetch_allowed_domains):
        raise FetchError(f"Host {p.hostname} is not on the allowlist")
    _assert_public(p.hostname)
    return p.hostname


def fetch_text(url: str) -> str:
    s = get_settings()
    host = check_url(url)
    with httpx.Client(timeout=s.fetch_timeout_seconds, follow_redirects=False) as c:
        r = c.get(url, headers={"User-Agent": "BlueScienceParkBot/0.1"})
    if 300 <= r.status_code < 400:
        loc = urlparse(r.headers.get("location", ""))
        if loc.hostname and loc.hostname.lower() != host.lower():
            raise FetchError("Cross-host redirect refused")
        raise FetchError("Redirects are not followed; use the final URL")
    r.raise_for_status()
    if len(r.content) > s.fetch_max_bytes:
        raise FetchError("Response too large")
    return html_to_text(r.text)


def html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript|template).*?</\1>", " ", html)
    html = re.sub(r"(?s)<!--.*?-->", " ", html)  # comments are a common injection hiding place
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", html).strip()
