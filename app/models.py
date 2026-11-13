"""Data model.

Key design rules enforced here:
  * Every ProfileItem carries a source (url or "company-edit") and a date.
  * `kind` separates STATED facts (said by the source) from INFERRED interests
    (derived by the agent). They are never merged.
  * `visibility` controls what other members and the chat assistant may see.
    Stated items default to public, inferred items default to private until the
    company approves them.
"""
from __future__ import annotations

import enum
import secrets
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_token() -> str:
    return secrets.token_urlsafe(24)


class Category(str, enum.Enum):
    product = "product"
    technology = "technology"
    market = "market"
    geography = "geography"
    priority = "priority"


class Kind(str, enum.Enum):
    stated = "stated"
    inferred = "inferred"


class Visibility(str, enum.Enum):
    public = "public"
    private = "private"


class Origin(str, enum.Enum):
    agent = "agent"
    company = "company"


class Module(str, enum.Enum):
    events = "events"
    funding = "funding"
    testbeds = "testbeds"
    news = "news"


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    website: Mapped[str | None] = mapped_column(String(500))
    api_token: Mapped[str] = mapped_column(String(64), default=new_token, unique=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    items: Mapped[list[ProfileItem]] = relationship(back_populates="member", cascade="all, delete-orphan")


class Source(Base):
    """A retrieved document a profile item can point back to."""

    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    title: Mapped[str | None] = mapped_column(String(500))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    published_at: Mapped[date | None] = mapped_column(Date)
    text: Mapped[str] = mapped_column(Text)


class ProfileItem(Base):
    __tablename__ = "profile_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    category: Mapped[str] = mapped_column(String(20))
    value: Mapped[str] = mapped_column(String(500))
    kind: Mapped[str] = mapped_column(String(10))
    visibility: Mapped[str] = mapped_column(String(10), default=Visibility.private.value)
    origin: Mapped[str] = mapped_column(String(10), default=Origin.agent.value)

    # Provenance: mandatory.
    source_url: Mapped[str] = mapped_column(String(1000))  # real URL, or "company-edit"
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"))
    source_date: Mapped[date] = mapped_column(Date)
    evidence: Mapped[str | None] = mapped_column(Text)  # quote from source (stated) or rationale (inferred)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    # Company control
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    removed: Mapped[bool] = mapped_column(Boolean, default=False)  # soft delete, keeps audit trail
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    # Last time an agent run saw this item in a source. Drives the stale flag.
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    member: Mapped[Member] = relationship(back_populates="items")

    @property
    def stale(self) -> bool:
        """Agent-found items nobody has re-confirmed recently. Company-authored items never go stale."""
        from app.config import get_settings

        if self.origin != Origin.agent.value or self.last_seen_at is None:
            return False
        seen = self.last_seen_at if self.last_seen_at.tzinfo else self.last_seen_at.replace(tzinfo=timezone.utc)
        return (utcnow() - seen).days > get_settings().stale_after_days


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    member_id: Mapped[int | None] = mapped_column(Integer, index=True)
    actor: Mapped[str] = mapped_column(String(50))  # "agent", "company:<id>", "chat"
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class MonitoredItem(Base):
    """An event, funding call, testbed or news item from an external feed."""

    __tablename__ = "monitored_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    module: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(1000))
    source_name: Mapped[str] = mapped_column(String(200))
    published_at: Mapped[date | None] = mapped_column(Date)
    starts_at: Mapped[date | None] = mapped_column(Date)  # event date or funding deadline
    location: Mapped[str | None] = mapped_column(String(200))
    tags: Mapped[list] = mapped_column(JSON, default=list)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_a_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    member_b_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    score: Mapped[float] = mapped_column(Float)
    # list of {type, label, a_item_id, b_item_id, weight}; only public B items are ever shown to A.
    basis: Mapped[list] = mapped_column(JSON, default=list)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    block_reason: Mapped[str | None] = mapped_column(String(100))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
