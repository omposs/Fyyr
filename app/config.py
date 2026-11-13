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
    # auto = anthropic if a key is set, else mock.  Or force: anthropic | openai_compat | mock
    llm_provider: str = "auto"
    # OpenAI-compatible endpoint, e.g. Ollama at http://localhost:11434/v1
    openai_base_url: str = "http://localhost:11434/v1"
    openai_model: str = "llama3.1"
    openai_api_key: str | None = None
    openai_timeout_seconds: float = 180.0

    # Profiling
    chunk_chars: int = 12000
    chunk_overlap: int = 500
    extraction_attempts: int = 2
    stale_after_days: int = 180
    crawl_max_pages: int = 5
    crawl_delay_seconds: float = 1.0
    crawl_user_agent: str = "BlueScienceParkBot/0.1"

    # Web source fetching: only these hosts may be fetched by the profiling agent.
    # Empty list means no live fetching at all (seed/fixture sources only).
    fetch_allowed_domains: list[str] = []
    fetch_timeout_seconds: float = 10.0
    fetch_max_bytes: int = 1_000_000

    # Chat guardrails
    chat_max_message_chars: int = 2000
    chat_rate_limit_per_minute: int = 20

    seed_dir: str = "data/seed"
    feeds_file: str = "data/feeds.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
