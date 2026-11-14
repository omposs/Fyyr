import json

import httpx
import pytest

from app import refresh_profiles
from app.api import routes
from app.config import get_settings
from app.llm import get_provider
from app.llm.base import ProviderError
from app.llm.openai_compat import OpenAICompatProvider, parse_json_object
from app.sources.crawler import CrawledPage, crawl_site, extract_links
from app.sources.fetcher import FetchError

from conftest import H

START = "https://acme.example/"
HOME = """<html><body>
<a href="/about">About</a> <a href="/products/sonar-systems">Sonar</a> <a href="/news?id=1">News</a>
<a href="/brochure.pdf">pdf</a> <a href="https://other.example/about">elsewhere</a> <a href="/contact">Contact</a>
<a href="/private/about-secrets">secret</a> <a href="https://www.acme.example/technology">Tech</a>
<a href="/about#team">team</a> <a href="mailto:x@y.z">mail</a>
Acme builds sonar for offshore wind.</body></html>"""
ROBOTS = "User-agent: *\nDisallow: /private\n"


def http_error(status):
    return httpx.HTTPStatusError("e", request=httpx.Request("GET", START), response=httpx.Response(status))


def make_fetch(robots=ROBOTS, dead=()):
    calls = []

    def fetch(url, allowed=None):
        calls.append((url, allowed))
        if url.endswith("/robots.txt"):
            if isinstance(robots, Exception):
                raise robots
            return robots
        if url in dead:
            raise FetchError("dead link")
        return HOME if url == START else f"<html>page {url} sonar</html>"

    fetch.calls = calls
    return fetch


def crawl(fetch, **kw):
    kw.setdefault("sleep", lambda s: None)
    kw.setdefault("delay", 0)
    return crawl_site(START, fetch=fetch, **kw)


def test_crawler_follows_only_informative_same_site_allowed_links():
    fetch = make_fetch()
    urls = {p.url for p in crawl(fetch, max_pages=10)}
    assert urls == {START, "https://acme.example/about", "https://acme.example/products/sonar-systems",
                    "https://www.acme.example/technology"}
    # every request carried a host allowlist limited to this one site
    assert all(set(a) == {"acme.example", "www.acme.example"} for _, a in fetch.calls)


def test_crawler_respects_max_pages_and_prefers_better_paths():
    pages = crawl(make_fetch(), max_pages=2)
    assert len(pages) == 2 and pages[0].url == START
    assert pages[1].url in {"https://acme.example/products/sonar-systems", "https://acme.example/about"}


def test_crawler_sleeps_between_pages():
    slept = []
    crawl(make_fetch(), max_pages=3, delay=2.5, sleep=slept.append)
    assert slept == [2.5, 2.5]


def test_dead_link_does_not_sink_the_crawl():
    pages = crawl(make_fetch(dead={"https://acme.example/about"}), max_pages=10)
    assert "https://acme.example/about" not in {p.url for p in pages} and len(pages) >= 3


def test_missing_robots_txt_means_allowed():
    urls = {p.url for p in crawl(make_fetch(robots=http_error(404)), max_pages=10)}
    assert "https://acme.example/private/about-secrets" in urls


@pytest.mark.parametrize("robots", [http_error(500), FetchError("network")])
def test_unreadable_robots_means_no_crawl(robots):
    with pytest.raises(FetchError, match="robots.txt could not be read"):
        crawl(make_fetch(robots=robots))


def test_robots_disallowing_start_page_means_no_crawl():
    with pytest.raises(FetchError, match="disallows"):
        crawl(make_fetch(robots="User-agent: *\nDisallow: /\n"))


def test_extract_links_normalises_and_filters():
    links = extract_links(HOME, START, "acme.example")
    assert "https://acme.example/about" in links and links.count("https://acme.example/about") == 1
    assert not any("pdf" in l or "?" in l or "other.example" in l or "mailto" in l for l in links)


# ---- API route + refresh command --------------------------------------------------------------
def _admin_member(client, tokens, website):
    r = client.post("/admin/members", json={"name": "Blue Co", "website": website}, headers=H(tokens["BSP Admin"]))
    assert r.status_code == 201
    return r.json()["id"]


def test_profile_run_requires_allowlisted_host(client, tokens):
    mid = _admin_member(client, tokens, "https://blue.example/")
    r = client.post(f"/admin/members/{mid}/profile/run", headers=H(tokens["BSP Admin"]))
    assert r.status_code == 422 and "allowlist" in r.json()["detail"]


def test_profile_run_crawls_when_allowed_and_reports_failures(client, tokens, monkeypatch):
    monkeypatch.setattr(get_settings(), "fetch_allowed_domains", ["blue.example"])
    mid = _admin_member(client, tokens, "https://blue.example/")
    adm = H(tokens["BSP Admin"])
    monkeypatch.setattr(routes, "crawl_site", lambda url: [CrawledPage(url, "We build sonar systems in Sweden.")])
    ok = client.post(f"/admin/members/{mid}/profile/run", headers=adm)
    assert ok.status_code == 200 and ok.json()["items_added"] >= 2

    def boom(url):
        raise FetchError("robots.txt disallows fetching this page")

    monkeypatch.setattr(routes, "crawl_site", boom)
    bad = client.post(f"/admin/members/{mid}/profile/run", headers=adm)
    assert bad.status_code == 422 and "Cannot crawl" in bad.json()["detail"]

    monkeypatch.setattr(routes, "crawl_site", lambda url: [])
    empty = client.post(f"/admin/members/{mid}/profile/run", headers=adm)
    assert empty.status_code == 422 and "no readable text" in empty.json()["detail"]


def test_refresh_command_skips_unlisted_and_isolates_failures(tokens, monkeypatch):
    monkeypatch.setattr(get_settings(), "fetch_allowed_domains", ["nautilab.example", "finfeed.example"])

    def fake_crawl(url):
        if "finfeed" in url:
            raise FetchError("boom")
        return [CrawledPage(url, "Nautilab builds sonar systems in Karlskrona, Sweden.")]

    monkeypatch.setattr(refresh_profiles, "crawl_site", fake_crawl)
    lines = refresh_profiles.refresh_all()
    by = {l.split(":")[0].split(maxsplit=1)[1]: l for l in lines}
    assert by["Nautilab AB"].startswith("ok") and "refreshed=" in by["Nautilab AB"]
    assert by["FinFeed Systems"].startswith("FAIL")
    assert by["HullClean Nordic"].startswith("skip")


# ---- local / OpenAI-compatible provider -------------------------------------------------------
def provider_with(handler):
    return OpenAICompatProvider("http://localhost:11434/v1/", "llama3.1",
                                client=httpx.Client(transport=httpx.MockTransport(handler)))


def reply(content):
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


@pytest.mark.parametrize("raw", [
    '{"items": []}',
    '```json\n{"items": []}\n```',
    'Sure! Here is the JSON:\n{"items": []}\nHope that helps.',
])
def test_json_parsing_tolerates_common_model_habits(raw):
    assert parse_json_object(raw) == {"items": []}


@pytest.mark.parametrize("raw", ["", "no json here", "[1, 2]", '{"items": [', "{'items': []}"])
def test_json_parsing_rejects_garbage(raw):
    with pytest.raises(ValueError):
        parse_json_object(raw)


def test_structured_call_shape():
    seen = {}

    def handler(req):
        seen["url"], seen["body"] = str(req.url), json.loads(req.content)
        return reply('{"items": []}')

    out = provider_with(handler).structured(task="t", system="SYS", user="USER", schema={"type": "object"})
    assert out == {"items": []}
    assert seen["url"] == "http://localhost:11434/v1/chat/completions"
    b = seen["body"]
    assert b["model"] == "llama3.1" and b["response_format"] == {"type": "json_object"} and b["temperature"] == 0
    assert b["messages"][0]["content"].startswith("SYS") and '"type": "object"' in b["messages"][0]["content"]
    assert b["messages"][1] == {"role": "user", "content": "USER"}


def test_transport_and_shape_errors_become_provider_errors():
    with pytest.raises(ProviderError):
        provider_with(lambda r: httpx.Response(500)).chat(task="c", system="s", messages=[])
    with pytest.raises(ProviderError):
        provider_with(lambda r: httpx.Response(200, json={"unexpected": 1})).chat(task="c", system="s", messages=[])

    def refuse(req):
        raise httpx.ConnectError("refused")

    with pytest.raises(ProviderError):
        provider_with(refuse).structured(task="t", system="s", user="u", schema={})


def test_non_json_reply_is_a_value_error_so_the_agent_retries():
    with pytest.raises(ValueError):
        provider_with(lambda r: reply("I cannot do that")).structured(task="t", system="s", user="u", schema={})


def test_provider_selection(monkeypatch):
    s = get_settings()
    assert get_provider().name == "mock"
    monkeypatch.setattr(s, "llm_provider", "openai_compat")
    assert get_provider().name == "openai_compat"
    monkeypatch.setattr(s, "llm_provider", "anthropic")
    with pytest.raises(RuntimeError, match="API_KEY"):
        get_provider()
    monkeypatch.setattr(s, "llm_provider", "nope")
    with pytest.raises(RuntimeError, match="Unknown"):
        get_provider()
    monkeypatch.setattr(s, "llm_provider", "auto")
    monkeypatch.setattr(s, "anthropic_api_key", "sk-test")
    assert get_provider().name == "anthropic"
