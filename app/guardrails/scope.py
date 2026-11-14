"""Scope guardrail: the assistant only discusses the member's own profile, recommendations,
matches and how the platform works. Deterministic keyword gate so it works with any provider and
cannot be argued out of its decision by the user message."""
from __future__ import annotations

import re

IN_SCOPE = re.compile(
    r"\b(profile|source|stated|inferred|recommend\w*|event|funding|grant|call|testbed|news|trend\w*|match\w*|"
    r"collaborat\w*|partner\w*|why|relevan\w*|matter\w*|deadline|company|companies|member|science park|"
    r"technolog\w*|product\w*|market\w*|priorit\w*|region|geograph\w*|edit|correct|wrong|update|remove|"
    r"how (do|does|can)|what (is|are|does)|explain|help)\b",
    re.IGNORECASE,
)
OUT_OF_SCOPE_HINTS = re.compile(
    r"\b(write (me )?(a |an )?(poem|essay|story|code|script)|translate|recipe|weather|stock price|"
    r"medical advice|legal advice|homework|joke)\b",
    re.IGNORECASE,
)

REFUSAL = (
    "I can only help with your Blue Science Park profile, your recommendations (events, funding, testbeds, news) "
    "and your collaboration matches, including why they were suggested. Ask me about one of those."
)


def in_scope(message: str) -> tuple[bool, str | None]:
    if OUT_OF_SCOPE_HINTS.search(message):
        return False, "out_of_scope_topic"
    if not IN_SCOPE.search(message):
        return False, "out_of_scope_topic"
    return True, None
