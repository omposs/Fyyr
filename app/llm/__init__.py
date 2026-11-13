from __future__ import annotations

from app.config import get_settings
from app.llm.base import LLMProvider, ProviderError
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
    choice = s.llm_provider.lower()
    if choice == "auto":
        choice = "anthropic" if s.anthropic_api_key else "mock"
    if choice == "anthropic":
        if not s.anthropic_api_key:
            raise RuntimeError("BSP_LLM_PROVIDER=anthropic but BSP_ANTHROPIC_API_KEY is not set")
        from app.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(s.anthropic_api_key, s.llm_model, s.llm_max_tokens)
    if choice == "openai_compat":
        from app.llm.openai_compat import OpenAICompatProvider

        return OpenAICompatProvider(s.openai_base_url, s.openai_model, s.openai_api_key,
                                    s.openai_timeout_seconds, s.llm_max_tokens)
    if choice == "mock":
        return MockProvider()
    raise RuntimeError(f"Unknown BSP_LLM_PROVIDER {s.llm_provider!r} (use auto, anthropic, openai_compat or mock)")


__all__ = ["LLMProvider", "ProviderError", "get_provider", "set_provider"]
