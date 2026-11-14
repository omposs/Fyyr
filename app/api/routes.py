from __future__ import annotations

from datetime import datetime, timezone

from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.profiling import run_profiling, visible_items
from app.chat.assistant import handle_chat
from app.config import get_settings
from app.db import get_db
from app.deps import audit, current_member, require_admin
from app.matching.matcher import matches_for, recompute_matches
from app.models import Kind, Member, Origin, ProfileItem, Visibility
from app.monitoring.ranking import recommend
from app.schemas import (ChatIn, ChatOut, MatchOut, MemberCreate, MemberCreated, MemberOut, ProfileItemCreate,
                         ProfileItemOut, ProfileItemPatch, ProfileOut, ProfilingRunOut, PublicProfileItemOut,
                         PublicProfileOut, RecommendationOut, SourceDocIn)
from app.sources.crawler import crawl_site
from app.sources.fetcher import FetchError

router = APIRouter()


# ---- admin / membership -------------------------------------------------------------------------
@router.post("/admin/members", response_model=MemberCreated, status_code=201, tags=["admin"])
def create_member(body: MemberCreate, db: Session = Depends(get_db), admin: Member = Depends(require_admin)):
    if db.scalar(select(Member).where(Member.name == body.name)):
        raise HTTPException(409, "Member already exists")
    m = Member(name=body.name, website=body.website)
    db.add(m)
    audit(db, member_id=None, actor=f"admin:{admin.id}", action="member_created", detail={"name": body.name})
    db.commit()
    return m


@router.post("/admin/matches/recompute", tags=["admin"])
def admin_recompute(db: Session = Depends(get_db), _: Member = Depends(require_admin)):
    return {"matches": recompute_matches(db)}


@router.post("/admin/members/{member_id}/profile/run", response_model=ProfilingRunOut, tags=["admin"])
def admin_profile_run(member_id: int, docs: list[SourceDocIn] | None = None, db: Session = Depends(get_db),
                      _: Member = Depends(require_admin)):
    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(404, "No such member")
    return _run(db, member, docs)


def _run(db: Session, member: Member, docs: list[SourceDocIn] | None) -> ProfilingRunOut:
    if not docs:
        if not member.website:
            raise HTTPException(422, "No documents supplied and member has no website")
        allowed = get_settings().fetch_allowed_domains
        host = (urlparse(member.website).hostname or "").lower().removeprefix("www.")
        if host not in {d.lower().removeprefix("www.") for d in allowed}:
            raise HTTPException(422, f"{host or 'This website'} is not on the fetch allowlist (BSP_FETCH_ALLOWED_DOMAINS)")
        try:
            pages = crawl_site(member.website)
        except Exception as e:  # FetchError, httpx errors: report, do not 500
            raise HTTPException(422, f"Cannot crawl website: {type(e).__name__}: {e}") from e
        docs = [SourceDocIn(url=p.url, title=member.name, text=p.text) for p in pages]
        if not docs:
            raise HTTPException(422, "The site returned no readable text (JavaScript-rendered?)")
    return run_profiling(db, member, docs)


# ---- own profile (company view) -----------------------------------------------------------------
@router.get("/me", response_model=MemberOut, tags=["profile"])
def me(member: Member = Depends(current_member)):
    return member


@router.get("/me/profile", response_model=ProfileOut, tags=["profile"])
def my_profile(db: Session = Depends(get_db), member: Member = Depends(current_member)):
    items = visible_items(db, member.id, viewer_is_owner=True)
    return ProfileOut(
        member=MemberOut.model_validate(member),
        stated=[ProfileItemOut.model_validate(i) for i in items if i.kind == Kind.stated.value],
        inferred=[ProfileItemOut.model_validate(i) for i in items if i.kind == Kind.inferred.value],
    )


@router.post("/me/profile/run", response_model=ProfilingRunOut, tags=["profile"])
def my_profile_run(docs: list[SourceDocIn] | None = None, db: Session = Depends(get_db),
                   member: Member = Depends(current_member)):
    return _run(db, member, docs)


@router.post("/me/profile/items", response_model=ProfileItemOut, status_code=201, tags=["profile"])
def add_item(body: ProfileItemCreate, db: Session = Depends(get_db), member: Member = Depends(current_member)):
    item = ProfileItem(
        member_id=member.id, category=body.category.value, value=body.value.strip(), kind=Kind.stated.value,
        visibility=Visibility.public.value if body.public else Visibility.private.value,
        origin=Origin.company.value, source_url="company-edit", source_date=datetime.now(timezone.utc).date(),
        evidence="Provided by the company itself", confidence=1.0, approved=True)
    db.add(item)
    audit(db, member_id=member.id, actor=f"company:{member.id}", action="item_added", detail={"value": item.value})
    db.commit()
    return item


def _own_item(db: Session, member: Member, item_id: int) -> ProfileItem:
    item = db.get(ProfileItem, item_id)
    if item is None or item.member_id != member.id or item.removed:
        raise HTTPException(404, "No such item")  # 404 not 403: do not reveal other members' ids
    return item


@router.patch("/me/profile/items/{item_id}", response_model=ProfileItemOut, tags=["profile"])
def patch_item(item_id: int, body: ProfileItemPatch, db: Session = Depends(get_db),
               member: Member = Depends(current_member)):
    item = _own_item(db, member, item_id)
    before = {"value": item.value, "visibility": item.visibility, "approved": item.approved}
    if body.value is not None and body.value.strip() != item.value:
        item.value = body.value.strip()
        # An edited agent item becomes company-authored: it is now the company's statement.
        item.origin, item.kind = Origin.company.value, Kind.stated.value
        item.source_url, item.source_id = "company-edit", None
        item.source_date = datetime.now(timezone.utc).date()
        item.evidence, item.confidence, item.approved = "Edited by the company itself", 1.0, True
    if body.visibility is not None:
        item.visibility = body.visibility
    if body.approved is not None:
        item.approved = body.approved
    audit(db, member_id=member.id, actor=f"company:{member.id}", action="item_edited",
          detail={"item_id": item.id, "before": before})
    db.commit()
    return item


@router.delete("/me/profile/items/{item_id}", status_code=204, tags=["profile"])
def delete_item(item_id: int, db: Session = Depends(get_db), member: Member = Depends(current_member)):
    item = _own_item(db, member, item_id)
    item.removed = True  # soft delete: stops the agent re-adding it and keeps the audit trail
    audit(db, member_id=member.id, actor=f"company:{member.id}", action="item_removed", detail={"item_id": item.id})
    db.commit()


# ---- other members' public profiles -------------------------------------------------------------
@router.get("/members/{member_id}/profile", response_model=PublicProfileOut, tags=["profile"])
def public_profile(member_id: int, db: Session = Depends(get_db), _: Member = Depends(current_member)):
    other = db.get(Member, member_id)
    if other is None or other.is_admin:
        raise HTTPException(404, "No such member")
    items = visible_items(db, other.id, viewer_is_owner=False)  # the *published* view, even for oneself
    return PublicProfileOut(member=MemberOut.model_validate(other),
                            items=[PublicProfileItemOut.model_validate(i) for i in items])


# ---- monitoring and matching --------------------------------------------------------------------
@router.get("/me/recommendations", response_model=list[RecommendationOut], tags=["monitoring"])
def my_recommendations(module: str | None = Query(default=None, pattern="^(events|funding|testbeds|news)$"),
                       limit: int = Query(default=10, ge=1, le=50), db: Session = Depends(get_db),
                       member: Member = Depends(current_member)):
    return [r for _, r in recommend(db, member, module=module, limit=limit)]


@router.get("/me/matches", response_model=list[MatchOut], tags=["matching"])
def my_matches(limit: int = Query(default=10, ge=1, le=50), db: Session = Depends(get_db),
               member: Member = Depends(current_member)):
    return matches_for(db, member, limit=limit)


# ---- chat ---------------------------------------------------------------------------------------
@router.post("/me/chat", response_model=ChatOut, tags=["chat"])
def chat(body: ChatIn, db: Session = Depends(get_db), member: Member = Depends(current_member)):
    return handle_chat(db, member, body.message, body.session_id)
