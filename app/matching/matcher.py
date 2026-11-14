"""Collaboration matching.

Privacy rule: matching reads ONLY items that are visible to other members (public stated, or
public inferred-and-approved) for BOTH sides. That makes the result symmetric and means an
explanation can never leak anything the other company has not published. Companies improve their
matches by approving and publishing items, which is also the incentive to review the profile.

Signals (weights sum is capped at 1.0):
  complementary     one side's stated priority asks for what the other offers (technology/product)   0.40
  shared_market     same market                                                                   0.30
  shared_technology same technology                                                               0.12
  same_region       overlapping geography                                                         0.15
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.agents.profiling import visible_items
from app.models import Match, Member, ProfileItem
from app.schemas import MatchBasisOut, MatchOut, MemberOut
from app.text import tokens

W = {"complementary": 0.40, "shared_market": 0.30, "shared_technology": 0.12, "same_region": 0.15}
MIN_SCORE = 0.2


def _same(a: str, b: str) -> bool:
    ta, tb = set(tokens(a)), set(tokens(b))
    if not ta or not tb:
        return False
    return ta == tb or len(ta & tb) / len(ta | tb) >= 0.5


def _asks_for(priority: str, offer: str) -> bool:
    """True if every meaningful token of `offer` appears in the `priority` phrase."""
    to = set(tokens(offer))
    return bool(to) and to <= set(tokens(priority))


@dataclass
class Basis:
    type: str
    label_a: str  # worded from member A's perspective
    label_b: str  # worded from member B's perspective
    a: ProfileItem | None
    b: ProfileItem | None
    weight: float


def compute_basis(a_items: list[ProfileItem], b_items: list[ProfileItem]) -> list[Basis]:
    out: list[Basis] = []
    seen: set[tuple] = set()

    def add(kind: str, label_a: str, a: ProfileItem | None, b: ProfileItem | None, label_b: str | None = None):
        key = (kind, a.id if a else None, b.id if b else None)
        if key not in seen:
            seen.add(key)
            out.append(Basis(kind, label_a, label_b or label_a, a, b, W[kind]))

    for x, y in itertools.product(a_items, b_items):
        if x.category == y.category == "market" and _same(x.value, y.value):
            add("shared_market", f"Both work in {x.value}", x, y)
        elif x.category == y.category == "technology" and _same(x.value, y.value):
            add("shared_technology", f"Both use {x.value}", x, y)
        elif x.category == y.category == "geography" and _same(x.value, y.value):
            add("same_region", f"Both are active in {x.value}", x, y)
        if x.category == "priority" and y.category in ("technology", "product") and _asks_for(x.value, y.value):
            add("complementary", f"Their {y.category} '{y.value}' fits a stated priority of yours", x, y,
                f"Your {y.category} '{y.value}' fits a stated priority of theirs")
        if y.category == "priority" and x.category in ("technology", "product") and _asks_for(y.value, x.value):
            add("complementary", f"Your {x.category} '{x.value}' fits a stated priority of theirs", x, y,
                f"Their {x.category} '{x.value}' fits a stated priority of yours")
    return out


def score_of(basis: list[Basis]) -> float:
    best: dict[str, float] = {}
    for b in basis:  # diminishing returns: first hit of a type counts fully, more add 25% each
        best[b.type] = best.get(b.type, 0.0) + (b.weight if b.type not in best else b.weight * 0.25)
    return round(min(1.0, sum(min(v, W[k] * 1.75) for k, v in best.items())), 3)


def recompute_matches(db: Session) -> int:
    members = list(db.scalars(select(Member).where(Member.is_admin.is_(False))).all())
    db.execute(delete(Match))
    cache = {m.id: visible_items(db, m.id, viewer_is_owner=False) for m in members}
    n = 0
    for a, b in itertools.combinations(sorted(members, key=lambda m: m.id), 2):
        basis = compute_basis(cache[a.id], cache[b.id])
        score = score_of(basis)
        if score < MIN_SCORE:
            continue
        db.add(Match(member_a_id=a.id, member_b_id=b.id, score=score, basis=[
            {"type": x.type, "label_a": x.label_a, "label_b": x.label_b, "a_item_id": x.a.id if x.a else None,
             "b_item_id": x.b.id if x.b else None, "weight": x.weight} for x in basis]))
        n += 1
    db.commit()
    return n


def _explanation(company: str, labels: list[str]) -> str:
    return f"{company} may be a good collaboration partner. " + "; ".join(labels[:3]) + "."


def matches_for(db: Session, member: Member, limit: int = 10) -> list[MatchOut]:
    rows = db.scalars(select(Match).where(or_(Match.member_a_id == member.id, Match.member_b_id == member.id))
                      .order_by(Match.score.desc()).limit(limit)).all()
    result: list[MatchOut] = []
    for r in rows:
        i_am_a = r.member_a_id == member.id
        other = db.get(Member, r.member_b_id if i_am_a else r.member_a_id)
        basis_out: list[MatchBasisOut] = []
        mine_key, theirs_key = ("a_item_id", "b_item_id") if i_am_a else ("b_item_id", "a_item_id")
        for b in r.basis:
            mine = db.get(ProfileItem, b[mine_key]) if b.get(mine_key) else None
            theirs = db.get(ProfileItem, b[theirs_key]) if b.get(theirs_key) else None
            if theirs is not None and (theirs.removed or theirs.visibility != "public"):
                continue  # published state may have changed since the last recompute
            basis_out.append(MatchBasisOut(
                type=b["type"], label=b["label_a" if i_am_a else "label_b"],
                your_item=mine.value if mine else None,
                their_item=theirs.value if theirs else None,
                their_item_source=f"{theirs.source_url} ({theirs.source_date})" if theirs else None,
                weight=b["weight"]))
        if not basis_out:
            continue
        result.append(MatchOut(member=MemberOut.model_validate(other), score=r.score,
                               explanation=_explanation(other.name, [x.label for x in basis_out]), basis=basis_out))
    return result
