"""Schemas for API-based transcript ingestion queue."""

from datetime import datetime

from pydantic import BaseModel, Field


class CatalogCoverageStats(BaseModel):
    """Catalog-wide transcript / embedding coverage (not run-specific)."""

    total_videos: int
    with_transcript: int
    without_transcript: int
    with_transcript_embedding: int
    transcript_coverage_pct: float = 0.0
    embedding_coverage_pct: float = 0.0


class RunJobStats(BaseModel):
    """Per-run job counters and derived progress."""

    jobs_total: int
    queued: int = 0
    processing: int = 0
    success: int = 0
    failed: int = 0
    unavailable: int = 0
    skipped_existing: int = 0
    processed: int = 0
    progress_pct: float = 0.0
    success_pct: float = 0.0
    unavailable_pct: float = 0.0


class TranscriptApiIngestionDashboardStats(BaseModel):
    """GET /stats — catalog only + pointer to active run."""

    catalog: CatalogCoverageStats
    active_run_id: int | None = None


# Backward-compatible alias for older clients
class TranscriptApiIngestionStats(CatalogCoverageStats):
    """Deprecated merged shape; prefer CatalogCoverageStats + RunJobStats."""

    queued: int = 0
    processing: int = 0
    success: int = 0
    failed: int = 0
    unavailable: int = 0
    skipped_existing: int = 0


class TranscriptApiIngestionStartRequest(BaseModel):
    limit: int = Field(default=500, ge=1, le=5000)
    worker_count: int = Field(default=5, ge=1, le=10)
    creator_filter: str | None = Field(default=None, max_length=255)
    latest_only: bool = False
    only_missing: bool = True


class TranscriptApiIngestionJobRead(BaseModel):
    id: int
    run_id: int
    video_id: int
    status: str
    title: str
    creator_name: str
    transcript_chars: int
    embedding_created: bool
    sheets_rows_updated: int
    sheets_writeback: str
    error_message: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class TranscriptApiIngestionJobsPage(BaseModel):
    items: list[TranscriptApiIngestionJobRead]
    total: int
    offset: int
    limit: int
    status_filter: str | None = None


class TranscriptApiIngestionRunRead(BaseModel):
    id: int
    status: str
    worker_count: int
    limit_count: int | None
    creator_filter: str | None
    latest_only: bool
    only_missing: bool
    jobs_total: int
    message: str | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    duration_seconds: int | None
    catalog: CatalogCoverageStats
    run_stats: RunJobStats
    jobs: list[TranscriptApiIngestionJobRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TranscriptApiIngestionStartResponse(BaseModel):
    run: TranscriptApiIngestionRunRead
    message: str
