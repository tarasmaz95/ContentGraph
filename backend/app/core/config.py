"""Application settings loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for API, database, Sheets, and OpenAI."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "ContentGraph Lite"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    # Database (async SQLAlchemy + asyncpg)
    database_url: str = (
        "postgresql+asyncpg://contentgraph:contentgraph@localhost:5432/contentgraph"
    )

    # Google Sheets
    google_sheets_spreadsheet_id: str = ""
    google_service_account_file: str = "credentials/service_account.json"
    google_sheets_range: str = "Sheet1!A:F"
    sheets_writeback_enabled: bool = True
    tm1_public_url: str = "https://tm1.website"

    # Chrome extension ingest (optional — empty = no auth)
    extension_api_key: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4"
    openai_embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # Transcript enrichment (inline after sync — no workers)
    transcript_enrich_limit: int = 30
    transcript_embed_max_chars: int = 8000
    transcript_preview_chars: int = 220
    # Optional HTTP(S) proxy for youtube-transcript-api (cloud IPs are often blocked)
    transcript_http_proxy: str = ""

    # API-based transcript ingestion (/transcripts/api-ingestion)
    transcript_api_ingestion_workers: int = 5
    transcript_api_ingestion_max_workers: int = 10
    transcript_api_ingestion_fetch_retries: int = 2
    transcript_api_ingestion_default_limit: int = 500

    # YouTube Data API — top comments per video
    youtube_api_key: str = ""
    comments_max_per_video: int = 25
    comments_enrich_limit: int = 15

    # Daily historical snapshots (in-process APScheduler)
    stats_scheduler_enabled: bool = True
    stats_snapshot_hour_utc: int = 3
    stats_snapshot_minute_utc: int = 15
    stats_run_on_startup: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
