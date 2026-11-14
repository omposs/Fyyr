from __future__ import annotations

from typing import Any, Protocol


class ProviderError(Exception):
    """Transport or API failure talking to a model (network, auth, rate limit, server error)."""


class LLMProvider(Protocol):
    """Everything the agents need from a model. Swap providers by implementing this."""

    name: str

    def structured(self, *, task: str, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        """Return a JSON object conforming to `schema`. `task` names the job (used by the mock)."""

    def chat(self, *, task: str, system: str, messages: list[dict[str, str]]) -> str:
        """Return a plain-text reply."""
