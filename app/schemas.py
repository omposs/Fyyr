from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Category


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    website: str | None = None


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    website: str | None


class MemberCreated(MemberOut):
    api_token: str


class ProfileItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    value: str
    kind: str
    visibility: str
    origin: str
    source_url: str
    source_date: date
    evidence: str | None
    confidence: float
    approved: bool
    last_seen_at: datetime
    stale: bool


class PublicProfileItemOut(BaseModel):
    """What other members may see: stated + public only, no internal fields."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    value: str
    kind: str
    source_url: str
    source_date: date


class ProfileOut(BaseModel):
    member: MemberOut
    stated: list[ProfileItemOut]
    inferred: list[ProfileItemOut]


class PublicProfileOut(BaseModel):
    member: MemberOut
    items: list[PublicProfileItemOut]


class ProfileItemCreate(BaseModel):
    category: Category
    value: str = Field(min_length=1, max_length=500)
    public: bool = True


class ProfileItemPatch(BaseModel):
    value: str | None = Field(default=None, min_length=1, max_length=500)
    visibility: str | None = Field(default=None, pattern="^(public|private)$")
    approved: bool | None = None


class SourceDocIn(BaseModel):
    url: str
    title: str | None = None
    text: str = Field(min_length=1, max_length=200_000)
    published_at: date | None = None


class ProfilingRunOut(BaseModel):
    sources_processed: int
    items_added: int
    items_rejected: int
    rejected_reasons: list[str]
    items_refreshed: int = 0
    sources_failed: list[str] = []


class RecommendationOut(BaseModel):
    item_id: int
    module: str
    title: str
    summary: str
    url: str
    source_name: str
    published_at: date | None
    starts_at: date | None
    location: str | None
    score: float
    why_it_matters: str
    basis_item_ids: list[int] = []


class MatchBasisOut(BaseModel):
    type: str  # shared_market | complementary | same_region | shared_technology
    label: str
    your_item: str | None
    their_item: str | None
    their_item_source: str | None
    weight: float


class MatchOut(BaseModel):
    member: MemberOut
    score: float
    explanation: str
    basis: list[MatchBasisOut]


class ChatIn(BaseModel):
    message: str
    session_id: str | None = None


class ChatOut(BaseModel):
    session_id: str
    reply: str
    blocked: bool = False
    block_reason: str | None = None
    cited_item_ids: list[str] = []
    at: datetime
