"""Deterministic offline provider.

Lets the whole pipeline run and be tested with no API key or network. It is NOT a
quality stand-in for a real model: it uses small lexicons and templates. Its output
still goes through exactly the same validation as a real model's output, which is the
point: the guardrails never trust the provider.
"""
from __future__ import annotations

import json
import re
from typing import Any

TECH = [
    "autonomous underwater vehicle", "auv", "sonar", "machine learning", "digital twin", "iot", "sensor",
    "satellite", "remote sensing", "biofouling", "desalination", "hydrogen", "battery", "lidar",
    "computer vision", "acoustic", "robotics", "predictive maintenance", "ai",
]
MARKETS = [
    "offshore wind", "aquaculture", "shipping", "maritime", "defence", "ports", "fisheries", "oil and gas",
    "water treatment", "renewable energy", "marine research", "coastal management",
]
PLACES = [
    "sweden", "karlskrona", "blekinge", "denmark", "norway", "finland", "germany", "poland", "baltic sea",
    "north sea", "gothenburg", "copenhagen", "malmo", "stockholm", "europe",
]
# tech -> markets a company with that tech plausibly has latent interest in (used for INFERRED items only)
LATENT = {
    "sonar": ["marine research", "aquaculture"],
    "autonomous underwater vehicle": ["offshore wind", "marine research"],
    "auv": ["offshore wind", "marine research"],
    "biofouling": ["shipping", "aquaculture"],
    "digital twin": ["ports", "offshore wind"],
    "machine learning": ["predictive maintenance"],
    "hydrogen": ["shipping", "renewable energy"],
    "desalination": ["water treatment"],
}
PRIORITY_CUES = re.compile(
    r"((?:we are|we're)\s+(?:seeking|looking for|expanding into|hiring)[^.]{3,120}|"
    r"our (?:goal|priority|mission) is[^.]{3,120}|we aim to[^.]{3,120})",
    re.IGNORECASE,
)


def _find(text_l: str, vocab: list[str]) -> list[str]:
    out = []
    for v in vocab:
        if re.search(rf"\b{re.escape(v)}s?\b", text_l):
            out.append(v)
    return out


def _quote(text: str, term: str) -> str:
    m = re.search(rf"[^.\n]*\b{re.escape(term)}s?\b[^.\n]*", text, re.IGNORECASE)
    return m.group(0).strip()[:300] if m else term


class MockProvider:
    name = "mock"

    def structured(self, *, task: str, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        if task == "profile_extraction":
            return self._extract(user)
        raise NotImplementedError(f"MockProvider has no handler for task {task!r}")

    def _extract(self, doc: str) -> dict[str, Any]:
        low = doc.lower()
        items: list[dict[str, Any]] = []
        techs = _find(low, TECH)
        for t in techs:
            items.append({"category": "technology", "value": t, "kind": "stated", "evidence": _quote(doc, t), "confidence": 0.8})
        for m in _find(low, MARKETS):
            items.append({"category": "market", "value": m, "kind": "stated", "evidence": _quote(doc, m), "confidence": 0.8})
        for p in _find(low, PLACES):
            items.append({"category": "geography", "value": p, "kind": "stated", "evidence": _quote(doc, p), "confidence": 0.8})
        for m in PRIORITY_CUES.finditer(doc):
            phrase = m.group(1).strip()
            items.append({"category": "priority", "value": phrase[:200], "kind": "stated", "evidence": phrase, "confidence": 0.7})
        stated_markets = {i["value"] for i in items if i["category"] == "market"}
        seen = set()
        for t in techs:
            for mk in LATENT.get(t, []):
                if mk in stated_markets or mk in seen:
                    continue
                seen.add(mk)
                items.append({
                    "category": "market", "value": mk, "kind": "inferred",
                    "evidence": f"Inferred from stated technology '{t}'; the source does not mention this market.",
                    "confidence": 0.4,
                })
        return {"items": items}

    def chat(self, *, task: str, system: str, messages: list[dict[str, str]]) -> str:
        # The chat assistant passes a JSON context block as the last user message.
        last = messages[-1]["content"]
        m = re.search(r"<context>(.*?)</context>", last, re.S)
        ctx = json.loads(m.group(1)) if m else {}
        question = re.sub(r"<context>.*?</context>", "", last, flags=re.S).lower()
        lines: list[str] = []
        cited: list[int] = []
        recs = ctx.get("recommendations", [])
        matches = ctx.get("matches", [])
        profile = ctx.get("profile", [])
        if any(w in question for w in ("match", "collaborat", "partner", "work with")) and matches:
            for mt in matches[:3]:
                lines.append(f"{mt['company']}: {mt['explanation']}")
        elif any(w in question for w in ("why", "recommend", "event", "fund", "testbed", "news", "relevant")) and recs:
            for r in recs[:3]:
                lines.append(f"{r['title']} ({r['module']}): {r['why_it_matters']}")
                cited.append(r["id"])
        elif any(w in question for w in ("profile", "know about", "my company", "source")) and profile:
            for p in profile[:6]:
                tag = "stated" if p["kind"] == "stated" else "inferred (not confirmed)"
                lines.append(f"{p['category']}: {p['value']} [{tag}, source {p['source_url']}, {p['source_date']}]")
                cited.append(p["id"])
        else:
            lines.append(
                "I can explain your recommendations, your matches, or what your profile says and where it came from. "
                "Ask about one of those."
            )
        return json.dumps({"reply": "\n".join(lines), "cited_item_ids": cited})
