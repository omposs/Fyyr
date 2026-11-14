"""Background refresh that runs inside the API process.

A single daemon thread wakes every few seconds and runs whichever jobs are due, one at a time. A job that raises is
recorded as an error and retried at its next interval; it never stops the scheduler or the other jobs. Results are
visible to admins at GET /admin/scheduler.

Assumes ONE server process. With several uvicorn workers every worker would run every job; for that, move the jobs to
cron (`python -m app.feeds ingest`, `python -m app.refresh_profiles`) and set BSP_SCHEDULER_ENABLED=false.
"""
from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from datetime import datetime, timedelta

from app.models import utcnow

log = logging.getLogger(__name__)

JobFn = Callable[[], tuple[bool, str]]  # returns (ok, one-line detail)


class Job:
    def __init__(self, name: str, interval_seconds: float, fn: JobFn, first_delay_seconds: float = 0.0):
        self.name, self.interval, self.fn, self.first_delay = name, interval_seconds, fn, first_delay_seconds
        self.next_due: float | None = None
        self.lock = threading.Lock()
        self.runs = 0
        self.last_status: str | None = None  # "ok" | "error"
        self.last_detail = ""
        self.last_started_at: datetime | None = None
        self.last_finished_at: datetime | None = None


class Scheduler:
    def __init__(self, jobs: list[Job], clock: Callable[[], float] = time.monotonic, poll_seconds: float = 5.0):
        self.jobs = {j.name: j for j in jobs}
        self.clock, self.poll = clock, poll_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        now = self.clock()
        for j in self.jobs.values():
            j.next_due = now + j.first_delay
        self._thread = threading.Thread(target=self._loop, name="bsp-scheduler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=10)

    def _loop(self) -> None:
        while not self._stop.wait(self.poll):
            try:
                self.tick()
            except Exception:  # defensive: nothing may kill the loop
                log.exception("scheduler tick failed")

    def tick(self) -> list[str]:
        """Run every due job once. Returns the names that ran."""
        ran = []
        for j in self.jobs.values():
            if j.next_due is not None and self.clock() >= j.next_due:
                if self._execute(j):
                    ran.append(j.name)
        return ran

    def _execute(self, j: Job) -> bool:
        if not j.lock.acquire(blocking=False):  # already running (e.g. started by "run now")
            return False
        try:
            j.last_started_at = utcnow()
            try:
                ok, detail = j.fn()
                j.last_status, j.last_detail = ("ok" if ok else "error"), detail[:1000]
            except Exception as e:
                log.exception("job %s failed", j.name)
                j.last_status, j.last_detail = "error", f"{type(e).__name__}: {e}"[:1000]
            j.runs += 1
            j.last_finished_at = utcnow()
            return True
        finally:
            j.next_due = self.clock() + j.interval
            j.lock.release()

    def run_now(self, name: str) -> dict:
        j = self.jobs[name]  # KeyError for an unknown job
        if not self._execute(j):
            return {**self._status(j), "note": "already running"}
        return self._status(j)

    def _status(self, j: Job) -> dict:
        nxt = None
        if j.next_due is not None:
            nxt = (utcnow() + timedelta(seconds=max(j.next_due - self.clock(), 0))).isoformat(timespec="seconds")
        return {"name": j.name, "every_seconds": j.interval, "runs": j.runs, "last_status": j.last_status,
                "last_detail": j.last_detail, "running": j.lock.locked(), "next_run_at": nxt,
                "last_started_at": j.last_started_at.isoformat(timespec="seconds") if j.last_started_at else None,
                "last_finished_at": j.last_finished_at.isoformat(timespec="seconds") if j.last_finished_at else None}

    def status(self) -> list[dict]:
        return [self._status(j) for j in self.jobs.values()]


# ---- the real jobs -------------------------------------------------------------------------------
def _job_feeds() -> tuple[bool, str]:
    from app.db import SessionLocal
    from app.feeds.connector import ConfigError
    from app.feeds.service import ingest_all

    try:
        with SessionLocal() as db:
            total, lines = ingest_all(db)
    except ConfigError as e:
        return False, f"feeds.json problem: {e}"
    failed = [l for l in lines if l.startswith("FAIL")]
    return not failed, f"{total} new items; {len(lines) - len(failed)}/{len(lines)} feeds ok" + (
        "; " + "; ".join(failed) if failed else "")


def _job_profiles() -> tuple[bool, str]:
    from app.refresh_profiles import refresh_all

    lines = refresh_all()
    failed = [l for l in lines if l.startswith("FAIL")]
    skipped = sum(1 for l in lines if l.startswith("skip"))
    done = sum(1 for l in lines if l.startswith("ok"))
    detail = f"{done} refreshed, {skipped} skipped (host not in BSP_FETCH_ALLOWED_DOMAINS), {len(failed)} failed"
    return not failed, detail + ("; " + "; ".join(failed) if failed else "")


def _job_matches() -> tuple[bool, str]:
    from app.db import SessionLocal
    from app.matching.matcher import recompute_matches

    with SessionLocal() as db:
        return True, f"{recompute_matches(db)} matches"


def _job_maintenance() -> tuple[bool, str]:
    from sqlalchemy import delete

    from app.db import SessionLocal
    from app.models import AuthSession

    cutoff = utcnow() - timedelta(days=7)
    with SessionLocal() as db:
        n = db.execute(delete(AuthSession).where(AuthSession.expires_at < cutoff)).rowcount
        db.commit()
    return True, f"{n} old sessions removed"


def build_default_jobs(s) -> list[Job]:
    d = float(s.scheduler_initial_delay_seconds)
    prof = s.profiles_refresh_hours * 3600.0
    return [
        Job("feeds", s.feeds_refresh_minutes * 60.0, _job_feeds, first_delay_seconds=d),
        Job("profiles", prof, _job_profiles, first_delay_seconds=d + 60),
        Job("matches", prof, _job_matches, first_delay_seconds=d + 600),  # after profiles have had time to finish
        Job("maintenance", 3600.0, _job_maintenance, first_delay_seconds=d + 5),
    ]
