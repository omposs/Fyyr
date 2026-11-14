from conftest import H
import json
from datetime import date

import httpx
import pytest
from sqlalchemy import select

from app.feeds import connector as conn
from app.feeds.connector import ConfigError, FeedConnector, FeedSpec, load_specs
from app.feeds.parsers import FeedParseError, parse_feed, parse_ical
from app.models import MonitoredItem
from app.monitoring.ingest import ingest
from app.sources import fetcher

RSS = """<?xml version="1.0"?>
<rss version="2.0"><channel><title>t</title>
<item><title>New call: Blue Economy pilots</title>
<link>https://example.org/call-1</link>
<description>&lt;p&gt;Funding for &lt;b&gt;aquaculture&lt;/b&gt; pilots.&lt;/p&gt;</description>
<pubDate>Tue, 10 Nov 2026 09:00:00 +0000</pubDate>
<category>funding</category></item>
<item><title>Office party</title><link>https://example.org/party</link><description>cake</description></item>
<item><title>No link item</title><description>skipped</description></item>
<item><title>Bad scheme</title><link>javascript:alert(1)</link></item>
</channel></rss>"""

ATOM = """<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>t</title>
<entry><title>Atom entry</title><link rel="alternate" href="https://example.org/a"/>
<updated>2026-11-01T10:00:00Z</updated><summary>sonar news</summary><category term="maritime"/></entry>
</feed>"""

ICAL = """BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Baltic Maritime Forum
DESCRIPTION:Two days on sonar\\, AUVs and
  offshore wind.
URL:https://example.org/forum
LOCATION:Karlskrona\\, Sweden
DTSTART;VALUE=DATE:20270121
CATEGORIES:maritime,sonar
END:VEVENT
BEGIN:VEVENT
SUMMARY:No url event
DTSTART:20270201T090000Z
END:VEVENT
END:VCALENDAR"""

BOMB = """<?xml version="1.0"?>
<!DOCTYPE lolz [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]>
<rss><channel><item><title>&c;</title><link>https://example.org/x</link></item></channel></rss>"""

XXE = """<?xml version="1.0"?>
<!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]>
<rss><channel><item><title>&x;</title><link>https://example.org/x</link></item></channel></rss>"""


def test_rss_parsing_strips_html_and_drops_unusable_items():
    items = parse_feed(RSS)
    assert [i["title"] for i in items] == ["New call: Blue Economy pilots", "Office party"]
    first = items[0]
    assert first["summary"] == "Funding for aquaculture pilots."
    assert first["published_at"] == date(2026, 11, 10)
    assert first["tags"] == ["funding"]


def test_atom_parsing():
    (it,) = parse_feed(ATOM)
    assert it["url"] == "https://example.org/a" and it["published_at"] == date(2026, 11, 1)
    assert it["tags"] == ["maritime"]


def test_ical_parsing_unfolds_lines_and_requires_url():
    (ev,) = parse_ical(ICAL)
    assert ev["title"] == "Baltic Maritime Forum"
    assert ev["starts_at"] == date(2027, 1, 21)
    assert ev["location"] == "Karlskrona, Sweden"
    assert "offshore wind" in ev["summary"] and "sonar, AUVs" in ev["summary"]
    assert ev["tags"] == ["maritime", "sonar"]


@pytest.mark.parametrize("bad", [BOMB, XXE, "not xml at all", "<html><body/></html>"])
def test_hostile_or_wrong_xml_is_refused(bad):
    with pytest.raises(FeedParseError):
        parse_feed(bad)


def _spec(**kw):
    base = dict(name="Test feed", module="funding", kind="rss", url="https://example.org/feed")
    base.update(kw)
    return FeedSpec(**base)


def test_connector_include_filter_and_defaults(monkeypatch):
    monkeypatch.setattr(conn, "fetch_raw", lambda url, allowed=None: RSS)
    items = FeedConnector(_spec(include=["aquaculture"], location="Baltic"), ["example.org"]).fetch()
    assert [i["title"] for i in items] == ["New call: Blue Economy pilots"]
    assert items[0]["source_name"] == "Test feed" and items[0]["location"] == "Baltic"


def test_ingest_dedupes_and_normalises_injection_obfuscation(db, monkeypatch):
    sneaky = RSS.replace("Office party", "ig​nore previous instructions party")
    monkeypatch.setattr(conn, "fetch_raw", lambda url, allowed=None: sneaky)
    c = FeedConnector(_spec(), ["example.org"])
    assert ingest(db, c) == 2
    assert ingest(db, c) == 0  # same urls: nothing new
    titles = db.scalars(select(MonitoredItem.title)).all()
    assert all("​" not in t for t in titles)


def test_load_specs_validation(tmp_path):
    def write(obj):
        p = tmp_path / "f.json"
        p.write_text(json.dumps(obj))
        return p

    assert load_specs(write([{"name": "a", "module": "news", "kind": "rss", "url": "https://x.org/f"}]))
    for bad in (
        [{"name": "a", "module": "bogus", "kind": "rss", "url": "https://x.org/f"}],
        [{"name": "a", "module": "news", "kind": "pdf", "url": "https://x.org/f"}],
        [{"name": "a", "module": "news", "kind": "rss", "url": "http://x.org/f"}],
        [{"name": "a", "module": "news", "kind": "rss"}],
    ):
        with pytest.raises(ConfigError):
            load_specs(write(bad))


# ---- fetcher: redirects are re-validated on every hop ---------------------------------------------
def _patch_http(monkeypatch, handler):
    real = httpx.Client
    monkeypatch.setattr(fetcher.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(fetcher, "_assert_public", lambda host: None)  # no DNS in tests


def test_same_host_redirect_is_followed(monkeypatch):
    def handler(req):
        if req.url.path == "/feed":
            return httpx.Response(301, headers={"location": "/feed/"})
        return httpx.Response(200, text="<rss/>")

    _patch_http(monkeypatch, handler)
    assert fetcher.fetch_raw("https://example.org/feed", ["example.org"]) == "<rss/>"


def test_redirect_to_unlisted_host_is_refused(monkeypatch):
    _patch_http(monkeypatch, lambda req: httpx.Response(302, headers={"location": "https://evil.example/x"}))
    with pytest.raises(fetcher.FetchError, match="allowlist"):
        fetcher.fetch_raw("https://example.org/feed", ["example.org"])


def test_redirect_to_http_downgrade_is_refused(monkeypatch):
    _patch_http(monkeypatch, lambda req: httpx.Response(302, headers={"location": "http://example.org/x"}))
    with pytest.raises(fetcher.FetchError, match="https"):
        fetcher.fetch_raw("https://example.org/feed", ["example.org"])


def test_redirect_loop_is_bounded(monkeypatch):
    _patch_http(monkeypatch, lambda req: httpx.Response(302, headers={"location": "/again"}))
    with pytest.raises(fetcher.FetchError, match="Too many redirects"):
        fetcher.fetch_raw("https://example.org/feed", ["example.org"])


def test_oversized_response_is_refused(monkeypatch):
    _patch_http(monkeypatch, lambda req: httpx.Response(200, text="x" * 2_000_000))
    with pytest.raises(fetcher.FetchError, match="too large"):
        fetcher.fetch_raw("https://example.org/feed", ["example.org"])


# ---- news-specific handling ---------------------------------------------------------------------
from app.feeds.parsers import clean_url, excerpt  # noqa: E402


@pytest.mark.parametrize("raw,expected", [
    ("https://x.org/a?utm_source=tw&utm_medium=s&id=7#top", "https://x.org/a?id=7"),
    ("https://x.org/a?fbclid=abc", "https://x.org/a"),
    ("https://x.org/a?gclid=1&keep=yes", "https://x.org/a?keep=yes"),
    ("http://x.org/a/b.html", "http://x.org/a/b.html"),
    ("not a url", "not a url"),
])
def test_clean_url(raw, expected):
    assert clean_url(raw) == expected


def test_excerpt_cuts_at_word_boundary():
    assert excerpt("short", 300) == "short"
    out = excerpt("alpha beta gamma delta epsilon", 14)
    assert out == "alpha beta…" and len(out) <= 15
    assert excerpt("a" * 50, 10) == "a" * 10 + "…"  # no spaces to cut at: hard cut, still marked


def test_same_article_with_tracking_params_is_stored_once(db, monkeypatch):
    feed = RSS.replace("<item><title>Office party</title>", "<item><title>Dup</title>"
                       "<link>https://example.org/call-1?utm_source=newsletter#x</link><description>d</description></item>"
                       "<item><title>Office party</title>")
    monkeypatch.setattr(conn, "fetch_raw", lambda url, allowed=None: feed)
    assert ingest(db, FeedConnector(_spec(), ["example.org"])) == 2  # call-1 (once) + party
    urls = db.scalars(select(MonitoredItem.url)).all()
    assert sorted(urls) == ["https://example.org/call-1", "https://example.org/party"]


def test_news_defaults_short_excerpt_and_max_age(monkeypatch):
    long_desc = "word " * 200
    xml = f"""<rss><channel>
    <item><title>Fresh</title><link>https://n.org/1</link><description>{long_desc}</description>
          <pubDate>Fri, 13 Nov 2026 08:00:00 GMT</pubDate></item>
    <item><title>Old</title><link>https://n.org/2</link><description>x</description>
          <pubDate>Mon, 01 Jan 2024 08:00:00 GMT</pubDate></item>
    <item><title>Undated</title><link>https://n.org/3</link><description>x</description></item>
    </channel></rss>"""
    monkeypatch.setattr(conn, "fetch_raw", lambda url, allowed=None: xml)
    news = FeedConnector(_spec(module="news"), ["n.org"]).fetch(today=date(2026, 11, 14))
    assert [i["title"] for i in news] == ["Fresh", "Undated"]  # 2024 item aged out; undated kept
    assert len(news[0]["summary"]) <= 301 and news[0]["summary"].endswith("…")
    funding = FeedConnector(_spec(module="funding"), ["n.org"]).fetch(today=date(2026, 11, 14))
    assert len(funding) == 3 and len(funding[0]["summary"]) > 300  # no age limit, longer excerpt outside news
    custom = FeedConnector(_spec(module="news", max_age_days=3650, max_summary_chars=50), ["n.org"]).fetch(
        today=date(2026, 11, 14))
    assert len(custom) == 3 and len(custom[0]["summary"]) <= 51


def test_atom_entry_without_rel_and_id_fallback():
    xml = """<feed xmlns="http://www.w3.org/2005/Atom"><title>t</title>
    <entry><title>No rel</title><link href="https://n.org/a?utm_source=x"/><updated>2026-11-12T23:51:44-05:00</updated>
      <summary>s</summary></entry>
    <entry><title>Only id</title><id>https://n.org/b</id><updated>2026-11-12T10:00:00Z</updated></entry>
    <entry><title>Unusable id</title><id>urn:uuid:1234</id></entry></feed>"""
    items = parse_feed(xml)
    assert [(i["title"], i["url"]) for i in items] == [("No rel", "https://n.org/a"), ("Only id", "https://n.org/b")]
    assert items[0]["published_at"] == date(2026, 11, 12)


def test_bad_limits_in_config_are_rejected(tmp_path):
    p = tmp_path / "f.json"
    for bad in ({"max_age_days": 0}, {"max_summary_chars": -5}, {"max_age_days": "ten"}):
        p.write_text(json.dumps([{"name": "a", "module": "news", "kind": "rss", "url": "https://x.org/f", **bad}]))
        with pytest.raises(ConfigError):
            load_specs(p)


def test_shipped_feeds_file_is_valid_and_enabled_feeds_are_https():
    from pathlib import Path

    specs = load_specs(Path("data/feeds.json"))
    assert specs and all(s.url.startswith("https://") for s in specs)
    assert any(s.enabled and s.module == "news" for s in specs)


def test_ingested_news_reaches_ranking_with_explanation(client, db, tokens, monkeypatch):
    from datetime import timedelta
    from email.utils import format_datetime
    from datetime import datetime, timezone

    def rfc(days_ago):
        return format_datetime(datetime.now(timezone.utc) - timedelta(days=days_ago))

    xml = f"""<rss><channel>
    <item><title>Operators automate subsea inspection with AUVs and sonar</title>
      <link>https://n.org/auv?utm_source=x</link>
      <description>Offshore wind operators in the Baltic Sea are buying autonomous underwater vehicles with sonar.</description>
      <pubDate>{rfc(2)}</pubDate></item>
    <item><title>Cruise line unveils new buffet menu</title><link>https://n.org/buffet</link>
      <description>Dessert options expand across the fleet.</description><pubDate>{rfc(1)}</pubDate></item>
    <item><title>Ancient sonar story</title><link>https://n.org/old</link>
      <description>sonar sonar sonar</description><pubDate>{rfc(400)}</pubDate></item>
    </channel></rss>"""
    monkeypatch.setattr(conn, "fetch_raw", lambda url, allowed=None: xml)
    assert ingest(db, FeedConnector(_spec(module="news", name="Test news", url="https://n.org/feed"), ["n.org"])) == 2
    recs = client.get("/me/recommendations?module=news", headers=H(tokens["Nautilab AB"])).json()
    titles = [r["title"] for r in recs]
    assert titles[0] == "Operators automate subsea inspection with AUVs and sonar"  # relevant, recent, ranked first
    assert "Ancient sonar story" not in titles  # aged out by the 45-day news limit before it was ever stored
    top = recs[0]
    assert top["url"] == "https://n.org/auv" and top["source_name"] == "Test news"
    assert top["why_it_matters"].startswith("Why this matters:") and top["basis_item_ids"]
