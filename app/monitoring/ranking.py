"""Relevance ranking and grounded 'why this matters to you' explanations.

Recommendations are only ever produced for the owning member, so unreviewed inferred interests
may be used here (down-weighted) and are always labelled as inferred in the explanation.
The explanation is built from the actual profile items that matched, never free-written by a model,
so it cannot invent a reason.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.profiling import today, visible_items
from app.models import Kind, Member, MonitoredItem, ProfileItem
from app.schemas import RecommendationOut
from app.text import Corpus, shared_terms, tokens

CATEGORY_WEIGHT = {"priority": 3, "technology": 2, "market": 2, "product": 2, "geography": 1}


@dataclass
class Scored:
    item: MonitoredItem
    score: float
    reasons: list[ProfileItem]
    why: str


def _item_text(m: MonitoredItem) -> str:
    return f"{m.title}. {m.summary}. {' '.join(m.tags or [])}"


def _profile_doc(items: list[ProfileItem]) -> str:
    parts: list[str] = []
    for i in items:
        w = CATEGORY_WEIGHT.get(i.category, 1)
        if i.kind == Kind.inferred.value:
            w = max(1, w - 1)
        parts.extend([i.value] * w)
    return " ".join(parts)


def _geo_hit(item: MonitoredItem, profile: list[ProfileItem]) -> ProfileItem | None:
    if not item.location:
        return None
    loc = set(tokens(item.location))
    for p in profile:
        if p.category == "geography" and loc & set(tokens(p.value)):
            return p
    return None


def _timing(item: MonitoredItem, now: date) -> tuple[float, str | None, bool]:
    """Returns (boost, phrase, expired)."""
    if item.module in ("events", "funding") and item.starts_at:
        days = (item.starts_at - now).days
        if days < 0:
            return 0.0, None, True
        label = "deadline" if item.module == "funding" else "date"
        phrase = f"The {label} is {item.starts_at.isoformat()} ({days} days away)."
        return (0.12 if days <= 60 else 0.04), phrase, False
    if item.module == "news" and item.published_at:
        age = max((now - item.published_at).days, 0)
        return 0.12 * math.exp(-age / 30), None, False
    return 0.0, None, False


def _explain(item: MonitoredItem, profile: list[ProfileItem], geo: ProfileItem | None,
             timing_phrase: str | None) -> tuple[str, list[ProfileItem]]:
    text = _item_text(item)
    hits: list[tuple[int, ProfileItem, list[str]]] = []
    for p in profile:
        st = shared_terms(p.value, text)
        if st:
            weight = CATEGORY_WEIGHT.get(p.category, 1) * (0.5 if p.kind == Kind.inferred.value else 1)
            hits.append((len(st) * weight, p, st))
    hits.sort(key=lambda h: -h[0])
    top = hits[:2]
    used = [h[1] for h in top]
    bits: list[str] = []
    for _, p, st in top:
        if p.kind == Kind.inferred.value:
            bits.append(f"it relates to your inferred (unconfirmed) {p.category} interest '{p.value}' via {', '.join(st)}")
        else:
            bits.append(f"it matches your {p.category} '{p.value}' via {', '.join(st)}")
    if geo is not None:
        bits.append(f"it is in {item.location}, in your region '{geo.value}'")
        if geo not in used:
            used.append(geo)
    why = ("Why this matters: " + "; ".join(bits) + ".") if bits else "Why this matters: weak match on overall profile similarity."
    if timing_phrase:
        why += " " + timing_phrase
    return why, used


def recommend(db: Session, member: Member, *, module: str | None = None, limit: int = 10,
              min_score: float = 0.06) -> list[tuple[Scored, RecommendationOut]]:
    profile = visible_items(db, member.id, viewer_is_owner=True)
    if not profile:
        return []
    q = select(MonitoredItem)
    if module:
        q = q.where(MonitoredItem.module == module)
    items = list(db.scalars(q).all())
    if not items:
        return []
    corpus = Corpus([_item_text(i) for i in items])
    pvec = corpus.vector(_profile_doc(profile))
    now = today()
    out: list[tuple[Scored, RecommendationOut]] = []
    for it in items:
        boost, phrase, expired = _timing(it, now)
        if expired:
            continue
        geo = _geo_hit(it, profile)
        sim = Corpus.cosine(corpus.vector(_item_text(it)), pvec)
        score = min(1.0, sim * 2.0 + boost + (0.15 if geo else 0.0))
        if score < min_score:
            continue
        why, used = _explain(it, profile, geo, phrase)
        s = Scored(it, score, used, why)
        out.append((s, RecommendationOut(
            item_id=it.id, module=it.module, title=it.title, summary=it.summary, url=it.url,
            source_name=it.source_name, published_at=it.published_at, starts_at=it.starts_at,
            location=it.location, score=round(score, 3), why_it_matters=why,
            basis_item_ids=[p.id for p in used],
        )))
    out.sort(key=lambda t: -t[0].score)
    return out[:limit]
