from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuditLog, Member


# Registered as an OpenAPI security scheme so /docs shows an Authorize button (paste the token once).
token_header = APIKeyHeader(name="X-Member-Token", auto_error=False, description="Member API token")


def current_member(
    x_member_token: str | None = Depends(token_header),
    db: Session = Depends(get_db),
) -> Member:
    if not x_member_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Member-Token")
    member = db.scalar(select(Member).where(Member.api_token == x_member_token))
    if member is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return member


def require_admin(member: Member = Depends(current_member)) -> Member:
    if not member.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return member


def audit(db: Session, *, member_id: int | None, actor: str, action: str, detail: dict | None = None) -> None:
    db.add(AuditLog(member_id=member_id, actor=actor, action=action, detail=detail or {}))
