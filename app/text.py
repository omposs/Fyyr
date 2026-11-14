"""Tiny dependency-free text similarity (TF-IDF cosine).

Deliberately behind a small interface so it can be swapped for embeddings
(pgvector etc.) later without touching the matching or ranking code.
"""
from __future__ import annotations

import math
import re
from collections import Counter

_STOP = set(
    """a an and are as at be by for from has have in is it its of on or that the to was were will with
    we our your their this these those into over under about more most than then also can may""".split()
)
_TOKEN = re.compile(r"[a-zA-Z][a-zA-Z0-9\-]+")


def _stem(tok: str) -> str:
    for suf in ("ies", "es", "s"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 4:
            return tok[: -len(suf)] + ("y" if suf == "ies" else "")
    return tok


def tokens(text: str) -> list[str]:
    return [_stem(t) for t in (m.lower() for m in _TOKEN.findall(text)) if t not in _STOP and len(t) > 2]


class Corpus:
    """Fits IDF over a set of documents, then scores query/document pairs."""

    def __init__(self, docs: list[str]):
        self.n = max(len(docs), 1)
        df: Counter[str] = Counter()
        for d in docs:
            df.update(set(tokens(d)))
        self.idf = {t: math.log((1 + self.n) / (1 + c)) + 1.0 for t, c in df.items()}

    def vector(self, text: str) -> dict[str, float]:
        tf = Counter(tokens(text))
        return {t: c * self.idf.get(t, math.log(1 + self.n) + 1.0) for t, c in tf.items()}

    @staticmethod
    def cosine(a: dict[str, float], b: dict[str, float]) -> float:
        if not a or not b:
            return 0.0
        dot = sum(v * b.get(t, 0.0) for t, v in a.items())
        na = math.sqrt(sum(v * v for v in a.values()))
        nb = math.sqrt(sum(v * v for v in b.values()))
        return dot / (na * nb) if na and nb else 0.0


def shared_terms(a: str, b: str, limit: int = 4) -> list[str]:
    sa, sb = Counter(tokens(a)), set(tokens(b))
    return [t for t, _ in sa.most_common() if t in sb][:limit]
