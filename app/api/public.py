"""Anonymous public opportunity listing, enforced on the SERVER.

Visibility model (inspected before writing this): `MonitoredItem` rows are externally ingested records (events, funding calls,
testbeds, news). They had NO visibility or publication field, and an external record being on a public website does not mean it is
approved for display on Fyyr. So a record is public only when staff explicitly set `public_approved = True`. NULL (rows from before
this column existed), False and anything else are NOT public. Company profiles, matches, ranking evidence, chat and accounts are never
reachable from here: only the whitelisted fields of PublicOpportunityOut are ever selected into the response.

Company-created and Blue Science Park-created opportunities are held in the browser in this prototype (no table on the server), so
they cannot be served from here; the frontend adds only the ones its own access check allows for an anonymous viewer.

Every endpoint below (list, search, counts, detail) goes through `_eligible()`, the single place that decides eligibility.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import audit, require_admin
from app.models import Member, MonitoredItem

public_router = APIRouter(prefix="/public", tags=["public"])
admin_public_router = APIRouter(prefix="/admin", tags=["admin"])
MODULES = "^(events|funding|testbeds|news)$"


class PublicOpportunityOut(BaseModel):
    """The explicit allow-list of fields an anonymous visitor may receive."""
    id: int
    module: str
    title: str
    summary: str
    url: str
    source_name: str
    published_at: date | None
    starts_at: date | None  # event date, or the funding deadline
    location: str | None
    tags: list[str]
    closed: bool = False  # only ever true on the detail endpoint (lists exclude past items)


class PublicListOut(BaseModel):
    total: int  # eligible items matching the search and module filter
    counts: dict[str, int]  # eligible items per module for the same search (never includes ineligible rows)
    items: list[PublicOpportunityOut]


def _eligible(stmt, *, upcoming: bool):
    """Public AND approved for public display. `.is_(True)` means NULL and False are both excluded (conservative default)."""
    stmt = stmt.where(MonitoredItem.public_approved.is_(True))
    if upcoming:
        stmt = stmt.where(or_(MonitoredItem.starts_at.is_(None), MonitoredItem.starts_at >= date.today()))
    return stmt


def _like(term: str) -> str:
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _search(stmt, q: str | None):
    for term in (q or "").lower().split()[:6]:
        pat = _like(term[:60])
        stmt = stmt.where(or_(*(func.lower(c).like(pat, escape="\\") for c in
                                (MonitoredItem.title, MonitoredItem.summary, MonitoredItem.source_name, cast(MonitoredItem.tags, String)))))
    return stmt


def _out(m: MonitoredItem, closed: bool = False) -> PublicOpportunityOut:
    return PublicOpportunityOut(id=m.id, module=m.module, title=m.title, summary=m.summary, url=m.url, source_name=m.source_name,
                                published_at=m.published_at, starts_at=m.starts_at, location=m.location,
                                tags=[str(t) for t in (m.tags or [])], closed=closed)


@public_router.get("/opportunities", response_model=PublicListOut)
def list_public(q: str | None = Query(default=None, max_length=80), module: str | None = Query(default=None, pattern=MODULES),
                sort: str = Query(default="soon", pattern="^(soon|newest|title)$"), limit: int = Query(default=50, ge=1, le=100),
                offset: int = Query(default=0, ge=0, le=5000), db: Session = Depends(get_db)):
    searched = _search(_eligible(select(MonitoredItem), upcoming=True), q)
    counts = dict(db.execute(select(MonitoredItem.module, func.count()).where(MonitoredItem.id.in_(searched.with_only_columns(MonitoredItem.id)))
                             .group_by(MonitoredItem.module)).all())
    stmt = searched.where(MonitoredItem.module == module) if module else searched
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = {"soon": [MonitoredItem.starts_at.is_(None), MonitoredItem.starts_at, MonitoredItem.id],
             "newest": [MonitoredItem.published_at.is_(None), MonitoredItem.published_at.desc(), MonitoredItem.id.desc()],
             "title": [func.lower(MonitoredItem.title), MonitoredItem.id]}[sort]
    rows = db.scalars(stmt.order_by(*order).limit(limit).offset(offset)).all()
    return PublicListOut(total=total, counts={m: int(counts.get(m, 0)) for m in ("events", "funding", "testbeds", "news")}, items=[_out(r) for r in rows])


@public_router.get("/opportunities/{item_id}", response_model=PublicOpportunityOut)
def public_detail(item_id: int, db: Session = Depends(get_db)):
    m = db.scalar(_eligible(select(MonitoredItem).where(MonitoredItem.id == item_id), upcoming=False))
    if m is None:  # not approved, or does not exist: the same answer, so nothing about private records is revealed
        raise HTTPException(404, "Not found.")
    return _out(m, closed=bool(m.starts_at and m.starts_at < date.today()))


class PublicApprovalIn(BaseModel):
    approved: bool


@admin_public_router.put("/items/{item_id}/public", status_code=204)
def set_public(item_id: int, body: PublicApprovalIn, db: Session = Depends(get_db), admin: Member = Depends(require_admin)):
    """Staff decision: approve (or withdraw) a record for anonymous display. Ingestion never sets this."""
    m = db.get(MonitoredItem, item_id)
    if m is None:
        raise HTTPException(404, "No such item.")
    m.public_approved = body.approved
    audit(db, member_id=admin.id, actor=f"admin:{admin.id}", action="item.public_approval", detail={"item_id": item_id, "approved": body.approved})
    db.commit()
