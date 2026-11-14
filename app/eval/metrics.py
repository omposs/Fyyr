"""Pure scoring functions. No database, no model: easy to test and to reason about.

Matching rule (deliberately simple and documented, so scores can be audited):
two values are "the same concept" when, after lower-casing and stripping plural 's', their word sets are
identical, or one is a subset of the other and covers at least half of it, or their Jaccard overlap is >= 0.6.
So "5G" matches "5G networks", "autonomous underwater vehicle" matches "autonomous underwater vehicles",
but "radio" does not match "radio access networks". A label can list `aliases` for anything the rule misses.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

_WORD = re.compile(r"[a-z0-9]+")


def _stem(w: str) -> str:
    return w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w


def words(s: str) -> set[str]:
    return {_stem(w) for w in _WORD.findall(s.lower())}


def same_concept(a: str, b: str) -> bool:
    sa, sb = words(a), words(b)
    if not sa or not sb:
        return False
    if sa == sb:
        return True
    small, big = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
    if small <= big and len(small) / len(big) >= 0.5:
        return True
    return len(sa & sb) / len(sa | sb) >= 0.6


@dataclass
class Label:
    category: str
    value: str
    aliases: list[str] = field(default_factory=list)
    also_categories: list[str] = field(default_factory=list)  # product vs technology is often a judgement call

    def matches(self, category: str, value: str) -> bool:
        return (category == self.category or category in self.also_categories) and any(same_concept(value, v) for v in [self.value, *self.aliases])


@dataclass
class Forbidden:
    value: str
    category: str | None = None  # None = any category

    def matches(self, category: str, value: str) -> bool:
        return (self.category is None or self.category == category) and same_concept(value, self.value)


def _ratio(n: int, d: int) -> float | None:
    return round(n / d, 3) if d else None


def score_profile(labels: list[Label], extracted: list[tuple[str, str]], must_not: list[Forbidden]) -> dict:
    """`extracted` is a list of (category, value) for STATED items the agent produced."""
    found = [l for l in labels if any(l.matches(c, v) for c, v in extracted)]
    missed = [l for l in labels if l not in found]
    correct = [e for e in extracted if any(l.matches(*e) for l in labels)]
    unmatched = [e for e in extracted if e not in correct]
    forbidden = [e for e in extracted if any(m.matches(*e) for m in must_not)]
    precision, recall = _ratio(len(correct), len(extracted)), _ratio(len(found), len(labels))
    f1 = round(2 * precision * recall / (precision + recall), 3) if precision and recall else (0.0 if labels else None)
    by_cat: dict[str, dict] = {}
    for cat in sorted({l.category for l in labels}):
        lc = [l for l in labels if l.category == cat]
        by_cat[cat] = {"labels": len(lc), "found": sum(1 for l in lc if l in found),
                       "recall": _ratio(sum(1 for l in lc if l in found), len(lc))}
    return {
        "labels": len(labels), "extracted": len(extracted), "found": len(found), "correct": len(correct),
        "precision": precision, "recall": recall, "f1": f1, "recall_by_category": by_cat,
        "missed": [f"{l.category}: {l.value}" for l in missed],
        "unmatched_extracted": [f"{c}: {v}" for c, v in unmatched],
        "forbidden_hits": [f"{c}: {v}" for c, v in forbidden],
    }


def score_ranking(ranked_relevance: list[bool], total_relevant: int, total_items: int, k: int = 5, k_recall: int = 10) -> dict:
    """`ranked_relevance` is the relevance flag of each item the system SHOWED, best first.
    Items the system filtered out (below its score threshold) are simply absent from the list."""
    shown = len(ranked_relevance)
    top = ranked_relevance[:k]
    base = _ratio(total_relevant, total_items)
    p_at_k = _ratio(sum(top), len(top)) if top else None
    first = next((i + 1 for i, r in enumerate(ranked_relevance) if r), None)
    return {
        "items": total_items, "relevant": total_relevant, "shown": shown, "base_rate": base,
        f"precision_at_{k}": p_at_k,
        f"recall_at_{k_recall}": _ratio(sum(ranked_relevance[:k_recall]), total_relevant),
        "first_relevant_rank": first,
        "lift_over_base_rate": round(p_at_k / base, 2) if p_at_k is not None and base else None,
    }
