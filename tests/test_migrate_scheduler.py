import threading
import time

import pytest
from sqlalchemy import create_engine, inspect, text

from app.migrate import ensure_columns
from app.scheduler import Job, Scheduler
from conftest import H


# ---- additive migration ---------------------------------------------------------------------------
def test_ensure_columns_upgrades_an_old_database_without_losing_rows(tmp_path):
    from app import models  # noqa: F401

    eng = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with eng.begin() as c:  # members as it looked before auth existed
        c.execute(text("CREATE TABLE members (id INTEGER PRIMARY KEY, name VARCHAR(200) UNIQUE, website VARCHAR(500), "
                       "api_token VARCHAR(64) UNIQUE, is_admin BOOLEAN, created_at DATETIME)"))
        c.execute(text("INSERT INTO members (id, name, api_token, is_admin) VALUES (1, 'Saab', 'tok', 0)"))
    added = ensure_columns(eng)
    assert set(added) == {"members.email", "members.password_hash"}
    cols = {c["name"] for c in inspect(eng).get_columns("members")}
    assert {"email", "password_hash"} <= cols
    with eng.begin() as c:
        assert c.execute(text("SELECT name, email FROM members")).one() == ("Saab", None)  # data kept
        c.execute(text("UPDATE members SET email='a@b.se' WHERE id=1"))
        c.execute(text("INSERT INTO members (id, name, api_token, is_admin) VALUES (2, 'Other', 'tok2', 0)"))
        with pytest.raises(Exception):  # unique index was created too
            c.execute(text("UPDATE members SET email='a@b.se' WHERE id=2"))
    assert ensure_columns(eng) == []  # idempotent


def test_ensure_columns_leaves_a_current_database_alone():
    from app.db import engine

    assert ensure_columns(engine) == []


# ---- scheduler ---------------------------------------------------------------------------------------
class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def test_jobs_run_when_due_and_reschedule():
    clock, calls = Clock(), []
    s = Scheduler([Job("a", 100, lambda: (calls.append("a") or True, "done"), first_delay_seconds=10)], clock=clock)
    s.start_time = None
    for j in s.jobs.values():
        j.next_due = clock() + j.first_delay
    assert s.tick() == [] and calls == []
    clock.t = 10
    assert s.tick() == ["a"] and calls == ["a"]
    clock.t = 109
    assert s.tick() == []
    clock.t = 110
    assert s.tick() == ["a"] and s.status()[0]["runs"] == 2 and s.status()[0]["last_status"] == "ok"


def test_a_failing_job_is_recorded_and_does_not_stop_others():
    clock, ran = Clock(), []

    def boom():
        raise RuntimeError("feed exploded")

    s = Scheduler([Job("bad", 50, boom), Job("good", 50, lambda: (ran.append(1) or True, "fine"))], clock=clock)
    for j in s.jobs.values():
        j.next_due = 0
    assert s.tick() == ["bad", "good"] and ran == [1]
    st = {x["name"]: x for x in s.status()}
    assert st["bad"]["last_status"] == "error" and "feed exploded" in st["bad"]["last_detail"]
    assert st["good"]["last_status"] == "ok"
    clock.t = 50
    assert s.tick() == ["bad", "good"]  # the failing job is retried at its next interval


def test_job_reporting_failure_is_marked_error():
    s = Scheduler([Job("x", 10, lambda: (False, "2 feeds failed"))], clock=Clock())
    s.jobs["x"].next_due = 0
    s.tick()
    assert s.status()[0]["last_status"] == "error" and s.status()[0]["last_detail"] == "2 feeds failed"


def test_overlapping_run_is_refused():
    started, release = threading.Event(), threading.Event()

    def slow():
        started.set()
        release.wait(5)
        return True, "slow done"

    s = Scheduler([Job("slow", 10, slow)], clock=Clock())
    t = threading.Thread(target=lambda: s.run_now("slow"))
    t.start()
    assert started.wait(5)
    second = s.run_now("slow")  # while the first is still running
    assert second["note"] == "already running" and second["running"] is True
    release.set()
    t.join(5)
    assert s.status()[0]["runs"] == 1 and s.status()[0]["last_detail"] == "slow done"


def test_background_thread_runs_and_stops_cleanly():
    hits = []
    s = Scheduler([Job("tick", 0.05, lambda: (hits.append(1) or True, "ok"))], poll_seconds=0.02)
    s.start()
    deadline = time.time() + 3
    while len(hits) < 3 and time.time() < deadline:
        time.sleep(0.02)
    s.stop()
    n = len(hits)
    assert n >= 3
    time.sleep(0.2)
    assert len(hits) == n  # really stopped


# ---- the real jobs and the admin endpoints --------------------------------------------------------------
def test_feed_job_ingests_and_reports(client, db, monkeypatch, tmp_path):
    import json

    import app.feeds.connector as conn
    from app.config import get_settings
    from app.scheduler import _job_feeds

    f = tmp_path / "feeds.json"
    f.write_text(json.dumps([
        {"name": "Good", "module": "news", "kind": "rss", "url": "https://good.example/feed"},
        {"name": "Bad", "module": "news", "kind": "rss", "url": "https://bad.example/feed"}]))
    monkeypatch.setattr(get_settings(), "feeds_file", str(f))
    rss = "<rss><channel><item><title>Sonar news</title><link>https://good.example/1</link><description>x</description></item></channel></rss>"

    def fake(url, allowed=None):
        if "bad.example" in url:
            raise OSError("connection refused")
        return rss

    monkeypatch.setattr(conn, "fetch_raw", fake)
    ok, detail = _job_feeds()
    assert ok is False and "1 new items" in detail and "1/2 feeds ok" in detail and "Bad" in detail
    ok, detail = _job_feeds()  # second run: nothing new, same single failure
    assert "0 new items" in detail
    f.write_text("{broken")
    ok, detail = _job_feeds()
    assert ok is False and "feeds.json problem" in detail


def test_maintenance_job_removes_only_long_expired_sessions(client, db, tokens):
    from datetime import timedelta

    from sqlalchemy import select

    from app.models import AuthSession, Member, utcnow
    from app.scheduler import _job_maintenance

    mid = db.scalar(select(Member.id))
    for name, delta in (("old", -10), ("recent", -1), ("live", 1)):
        db.add(AuthSession(member_id=mid, token_hash=name, expires_at=utcnow() + timedelta(days=delta)))
    db.commit()
    _job_maintenance()
    db.expire_all()
    assert {s.token_hash for s in db.scalars(select(AuthSession))} == {"recent", "live"}


def test_scheduler_admin_endpoints(client, tokens):
    from app.main import app

    admin, member = H(tokens["BSP Admin"]), H(tokens["Nautilab AB"])
    app.state.scheduler = None
    assert client.get("/admin/scheduler", headers=admin).status_code == 404  # disabled
    app.state.scheduler = Scheduler([Job("demo", 60, lambda: (True, "ran fine"))], clock=Clock())
    try:
        assert client.get("/admin/scheduler", headers=member).status_code == 403
        assert client.get("/admin/scheduler").status_code == 401
        listing = client.get("/admin/scheduler", headers=admin).json()
        assert [j["name"] for j in listing] == ["demo"] and listing[0]["runs"] == 0
        run = client.post("/admin/scheduler/demo/run", headers=admin).json()
        assert run["last_status"] == "ok" and run["last_detail"] == "ran fine" and run["runs"] == 1
        assert client.post("/admin/scheduler/nope/run", headers=admin).status_code == 404
    finally:
        app.state.scheduler = None


def test_lifespan_starts_and_stops_scheduler_only_when_enabled(monkeypatch):
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import app

    with TestClient(app) as c:  # runs lifespan; disabled via conftest
        assert app.state.scheduler is None
    monkeypatch.setattr(get_settings(), "scheduler_enabled", True)
    monkeypatch.setattr(get_settings(), "scheduler_initial_delay_seconds", 3600)  # nothing becomes due during the test
    with TestClient(app) as c:
        assert app.state.scheduler is not None and set(app.state.scheduler.jobs) == {"feeds", "profiles", "matches", "maintenance"}
        thread = app.state.scheduler._thread
        assert thread.is_alive()
    assert not thread.is_alive()
