from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BSP_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./bsp.db"

    # LLM. With no API key the system falls back to a deterministic offline mock,
    # so everything runs (and is testable) without network access.
    anthropic_api_key: str | None = None
    llm_model: str = "claude-sonnet-5-5"
    llm_max_tokens: int = 1500

    # Web source fetching: only these hosts may be fetched by the profiling agent.
    # Empty list means no live fetching at all (seed/fixture sources only).
    fetch_allowed_domains: list[str] = []
    fetch_timeout_seconds: float = 10.0
    fetch_max_bytes: int = 1_000_000

    # Chat guardrails
    chat_max_message_chars: int = 2000
    chat_rate_limit_per_minute: int = 20

    seed_dir: str = "data/seed"


@lru_cache
def get_settings() -> Settings:
    return Settings()
