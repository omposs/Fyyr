"""Output guardrail: never trust the model's reply.

Checks: no system-prompt/secret leakage, cited ids must be in the allowed context,
no mention of another company's *private* data (we only allow other company names that
appear in the member's own match list), and a length cap.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

LEAK = re.compile(
    r"(system prompt|you are an? (ai |assistant)|<untrusted_data|x-member-token|api[_ -]?key|sk-ant-|bearer\s+\S{10,})",
    re.IGNORECASE,
)
MAX_REPLY = 3000
SAFE_FALLBACK = "I could not produce a reliable answer to that. Please rephrase, or check your profile and matches directly."


@dataclass
class OutputCheck:
    ok: bool
    reply: str
    cited: list[str]
    reason: str | None = None


def check_output(reply: str, cited: list, allowed_profile_ids: set[str], allowed_rec_ids: set[str],
                 other_names: list[str], allowed_other_names: set[str]) -> OutputCheck:
    if LEAK.search(reply):
        return OutputCheck(False, SAFE_FALLBACK, [], "output_leak")
    for name in other_names:
        if name.lower() in reply.lower() and name not in allowed_other_names:
            return OutputCheck(False, SAFE_FALLBACK, [], "output_unpermitted_company")
    allowed = allowed_profile_ids | allowed_rec_ids
    clean_cited = [c for c in cited if isinstance(c, str) and c in allowed]
    return OutputCheck(True, reply[:MAX_REPLY], clean_cited)
