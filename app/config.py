from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BSP_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./bsp.db"

    # Browser origins allowed to call the API (CORS). Defaults cover common local frontend dev servers.
    # Override with a JSON list, e.g. BSP_CORS_ORIGINS='["http://localhost:4200","https://demo.example.org"]'
    cors_origins: list[str] = [
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4200", "http://127.0.0.1:4200",
        "http://localhost:8080", "http://127.0.0.1:8080",
    ]

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
    eval_dir: str = "data/eval"

    # Authentication
    session_hours: int = 12
    # Static per-member API tokens (X-Member-Token) are kept for scripts and local development.
    # Set BSP_ALLOW_API_TOKENS=false once everyone logs in with email + password.
    allow_api_tokens: bool = True
    login_max_failures: int = 5          # per email, per window
    login_window_minutes: int = 15

    # Background refresh (runs inside the API process; run ONE worker, see README)
    scheduler_enabled: bool = True
    scheduler_initial_delay_seconds: int = 30
    feeds_refresh_minutes: int = 60
    profiles_refresh_hours: int = 24
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
