"""Prompt-injection defences.

Two surfaces:
  1. User chat input (direct injection).
  2. Retrieved documents: web pages, feeds (indirect injection). These are never
     instructions. They are wrapped, stripped of control characters and flagged if
     they contain instruction-like text.

Heuristics are a first line only. The structural defences (no tools that can reach other
members' data, context built server-side from permitted rows, output validation) are what
actually bound the damage if a clever injection gets through.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

_PATTERNS = [
    r"ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)",
    r"disregard (all |any |the )?(previous|prior|above|earlier|system)",
    r"forget (everything|all|your) (instructions|rules|above|previous)",
    r"you are now\b",
    r"\bnew (system )?(instructions|prompt|role)\b",
    r"(reveal|show|print|repeat|output|leak) (me )?(your |the )?(system|hidden|initial|original) (prompt|instructions|message)",
    r"\bdeveloper mode\b|\bjailbreak\b|\bDAN\b",
    r"act as (if you (are|were)|an?)\b.{0,40}(without|no) (restrictions|rules|limits)",
    r"</?(system|assistant|context|instructions?)>",
    r"\bsystem prompt\b",
    r"(api[_ -]?key|x-member-token|bearer\s+[a-z0-9\-_\.]{10,})",
]
_COMPILED = [re.compile(p, re.IGNORECASE) for p in _PATTERNS]
_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿‪‫‬‭‮"), None)


@dataclass
class InjectionResult:
    flagged: bool
    reasons: list[str]
    cleaned: str


def normalise(text: str) -> str:
    """Defeat trivial obfuscation: unicode compatibility forms, zero-width and bidi characters."""
    text = unicodedata.normalize("NFKC", text).translate(_ZERO_WIDTH)
    return "".join(ch for ch in text if ch in "\n\t" or unicodedata.category(ch)[0] != "C")


def scan(text: str) -> InjectionResult:
    cleaned = normalise(text)
    reasons = [p.pattern[:40] for p in _COMPILED if p.search(cleaned)]
    return InjectionResult(flagged=bool(reasons), reasons=reasons, cleaned=cleaned)


def wrap_untrusted(text: str, label: str) -> str:
    """Wrap retrieved content so the model is told it is data, and cannot close the wrapper."""
    safe = normalise(text).replace("<", "(").replace(">", ")")
    return f"<untrusted_data source={label!r}>\n{safe}\n</untrusted_data>"
