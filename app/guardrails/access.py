"""Data-access guardrail.

The model never queries the database. The server assembles a context block containing ONLY rows
the requesting member is allowed to see, and gives the model nothing else. Therefore a successful
prompt injection can at worst talk about data the member could already read through the API.

Also blocks requests that name another company's private data and enforces a per-member rate limit.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.profiling import visible_items
from app.matching.matcher import matches_for
from app.models import Member
from app.monitoring.ranking import recommend

_hits: dict[int, deque[float]] = defaultdict(deque)


def rate_limited(member_id: int, limit_per_minute: int, now: float | None = None) -> bool:
    now = now if now is not None else time.monotonic()
    q = _hits[member_id]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit_per_minute:
        return True
    q.append(now)
    return False


def reset_rate_limits() -> None:
    _hits.clear()


def build_context(db: Session, member: Member) -> tuple[dict, dict[str, set[str]]]:
    """Returns (context for the model, allowed ids by kind for output validation; ids are namespaced strings (p12, r4))."""
    profile = visible_items(db, member.id, viewer_is_owner=True)
    recs = recommend(db, member, limit=6)
    matches = matches_for(db, member, limit=5)
    ctx = {
        "company": member.name,
        "profile": [{"id": f"p{p.id}", "category": p.category, "value": p.value, "kind": p.kind,
                     "source_url": p.source_url, "source_date": p.source_date.isoformat()} for p in profile],
        "recommendations": [{"id": f"r{r.item_id}", "module": r.module, "title": r.title,
                             "why_it_matters": r.why_it_matters} for _, r in recs],
        "matches": [{"company": m.member.name, "explanation": m.explanation} for m in matches],
    }
    allowed = {
        "profile": {f"p{p.id}" for p in profile},
        "recommendations": {f"r{r.item_id}" for _, r in recs},
    }
    return ctx, allowed


def other_company_names(db: Session, member: Member) -> list[str]:
    return [n for n in db.scalars(select(Member.name).where(Member.id != member.id, Member.is_admin.is_(False))).all()]
