from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import AuthContext, audit, current_auth, require_admin
from app.models import AuthSession, Member, utcnow
from app.schemas import ChangePasswordIn, CredentialsIn, LoginIn, LoginOut
from app.security import (dummy_hash, hash_password, hash_token, new_session_token, throttle, verify_password)

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    s = get_settings()
    ip = request.client.host if request.client else "unknown"
    window = s.login_window_minutes * 60
    wait = throttle.blocked_for(body.email, ip, s.login_max_failures, window)
    if wait:
        raise HTTPException(429, "Too many failed attempts. Try again later.", headers={"Retry-After": str(wait)})
    member = db.scalar(select(Member).where(Member.email == body.email))
    stored = member.password_hash if member and member.password_hash else None
    ok = verify_password(body.password, stored or dummy_hash())  # always do the work, so timing does not reveal the email
    if not (member and stored and ok):
        throttle.fail(body.email, ip)
        audit(db, member_id=member.id if member else None, actor="anonymous", action="login_failed",
              detail={"email": body.email})
        db.commit()
        raise HTTPException(401, "Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    throttle.clear_email(body.email)
    token = new_session_token()
    expires = utcnow() + timedelta(hours=s.session_hours)
    db.add(AuthSession(member_id=member.id, token_hash=hash_token(token), expires_at=expires))
    audit(db, member_id=member.id, actor=f"company:{member.id}", action="login")
    db.commit()
    return LoginOut(access_token=token, expires_at=expires, member_id=member.id, name=member.name)


@router.post("/logout", status_code=204)
def logout(ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    if ctx.session is not None:
        ctx.session.revoked = True
        audit(db, member_id=ctx.member.id, actor=f"company:{ctx.member.id}", action="logout")
        db.commit()
    return Response(status_code=204)


@router.post("/change-password", status_code=204)
def change_password(body: ChangePasswordIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    m = ctx.member
    if not m.password_hash or not verify_password(body.current_password, m.password_hash):
        raise HTTPException(401, "Current password is incorrect")
    if m.email and body.new_password.lower() == m.email.lower():
        raise HTTPException(422, "password must not be the same as the email address")
    m.password_hash = hash_password(body.new_password)
    q = update(AuthSession).where(AuthSession.member_id == m.id, AuthSession.revoked.is_(False))
    if ctx.session is not None:  # keep the session that made the change, sign out all others
        q = q.where(AuthSession.id != ctx.session.id)
    db.execute(q.values(revoked=True))
    audit(db, member_id=m.id, actor=f"company:{m.id}", action="password_changed")
    db.commit()
    return Response(status_code=204)


@admin_router.put("/members/{member_id}/credentials", status_code=204)
def set_credentials(member_id: int, body: CredentialsIn, db: Session = Depends(get_db), admin: Member = Depends(require_admin)):
    m = db.get(Member, member_id)
    if m is None:
        raise HTTPException(404, "No such member")
    other = db.scalar(select(Member).where(Member.email == body.email, Member.id != member_id))
    if other:
        raise HTTPException(409, "That email address is already in use")
    m.email, m.password_hash = body.email, hash_password(body.password)
    db.execute(update(AuthSession).where(AuthSession.member_id == m.id).values(revoked=True))  # old sessions end
    audit(db, member_id=m.id, actor=f"admin:{admin.id}", action="credentials_set")
    db.commit()
    return Response(status_code=204)


@admin_router.get("/scheduler")
def scheduler_status(request: Request, _: Member = Depends(require_admin)):
    sch = getattr(request.app.state, "scheduler", None)
    if sch is None:
        raise HTTPException(404, "Scheduler is disabled (BSP_SCHEDULER_ENABLED=false)")
    return sch.status()


@admin_router.post("/scheduler/{job}/run")
def scheduler_run(job: str, request: Request, _: Member = Depends(require_admin)):
    sch = getattr(request.app.state, "scheduler", None)
    if sch is None:
        raise HTTPException(404, "Scheduler is disabled (BSP_SCHEDULER_ENABLED=false)")
    if job not in sch.jobs:
        raise HTTPException(404, f"No such job. Jobs: {', '.join(sch.jobs)}")
    return sch.run_now(job)
