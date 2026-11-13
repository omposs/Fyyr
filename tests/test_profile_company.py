from sqlalchemy import select

from app import profile_company
from app.models import Member, ProfileItem

TELECOM = ("Acme Networks develops 5G radio access network software for mobile operators in Sweden and "
           "the Nordic region. We are seeking partners for open RAN testing. Our radar division serves "
           "aviation customers in Linköping.")


def test_company_cli_profiles_telecom_text(db, monkeypatch, capsys):
    monkeypatch.setattr(profile_company, "fetch_raw", lambda url, allowed=None: f"<html><body>{TELECOM}</body></html>")
    assert profile_company.main(["x", "Acme Networks", "https://acme.example/about"]) == 0
    out = capsys.readouterr().out
    assert "API token for Acme Networks" in out and "WARNING" in out  # short text triggers the JS warning
    m = db.scalar(select(Member).where(Member.name == "Acme Networks"))
    vals = {(i.category, i.value) for i in db.scalars(select(ProfileItem).where(ProfileItem.member_id == m.id))}
    assert ("technology", "5g") in vals and ("technology", "radar") in vals
    assert ("market", "telecommunications") not in vals  # not in the text, so must not appear as stated
    assert ("market", "mobile operators") in vals and ("geography", "linköping") in vals
    assert all(i.source_url == "https://acme.example/about" for i in db.scalars(select(ProfileItem)))


def test_company_cli_reports_fetch_failure(monkeypatch, capsys):
    def boom(url, allowed=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(profile_company, "fetch_raw", boom)
    assert profile_company.main(["x", "A", "https://a.example"]) == 1
    assert "Fetch failed" in capsys.readouterr().out
