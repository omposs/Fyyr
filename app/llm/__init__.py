from __future__ import annotations

from app.config import get_settings
from app.llm.base import LLMProvider
from app.llm.mock import MockProvider

_override: LLMProvider | None = None


def set_provider(p: LLMProvider | None) -> None:
    """Test hook / dependency injection point."""
    global _override
    _override = p


def get_provider() -> LLMProvider:
    if _override is not None:
        return _override
    s = get_settings()
    if s.anthropic_api_key:
        from app.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(s.anthropic_api_key, s.llm_model, s.llm_max_tokens)
    return MockProvider()


__all__ = ["LLMProvider", "get_provider", "set_provider"]
