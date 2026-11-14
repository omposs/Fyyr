from __future__ import annotations

import hmac
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import AuditLog, AuthSession, Member, utcnow
from app.security import hash_token

# Both are registered as OpenAPI security schemes, so /docs shows an Authorize button for each.
bearer = HTTPBearer(auto_error=False, description="Session token returned by POST /auth/login")
token_header = APIKeyHeader(name="X-Member-Token", auto_error=False,
                            description="Static member API token (scripts and local development)")


@dataclass
class AuthContext:
    member: Member
    session: AuthSession | None  # None when authenticated with a static API token


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


def current_auth(creds=Depends(bearer), x_member_token: str | None = Depends(token_header),
                 db: Session = Depends(get_db)) -> AuthContext:
    if creds is not None and creds.credentials:
        session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(creds.credentials)))
        if session is None or session.revoked or aware(session.expires_at) <= utcnow():
            raise _unauthorized("Invalid or expired session. Log in again at POST /auth/login")
        member = db.get(Member, session.member_id)
        if member is None:
            raise _unauthorized("Invalid or expired session. Log in again at POST /auth/login")
        return AuthContext(member, session)
    if x_member_token:
        if not get_settings().allow_api_tokens:
            raise _unauthorized("API tokens are disabled. Log in at POST /auth/login")
        member = db.scalar(select(Member).where(Member.api_token == x_member_token))
        if member is None or not hmac.compare_digest(member.api_token, x_member_token):
            raise _unauthorized("Invalid token")
        return AuthContext(member, None)
    raise _unauthorized("Not authenticated. Log in at POST /auth/login")


def current_member(ctx: AuthContext = Depends(current_auth)) -> Member:
    return ctx.member


def require_admin(member: Member = Depends(current_member)) -> Member:
    if not member.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return member


def audit(db: Session, *, member_id: int | None, actor: str, action: str, detail: dict | None = None) -> None:
    db.add(AuditLog(member_id=member_id, actor=actor, action=action, detail=detail or {}))
