"""Browser ingestion worker queue schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class BrowserIngestionStartRequest(BaseModel):
    limit: int = Field(default=100, ge=1, le=5000)
    mode: str = Field(default="both", pattern="^(transcript|comments|both)$")
    creator_filter: str | None = Field(default=None, max_length=255)
    latest_only: bool = False
    only_missing: bool = True


class BrowserIngestionJobResult(BaseModel):
    transcript_status: str | None = None
    comments_status: str | None = None
    sheets_transcript: str | None = None
    sheets_comments: str | None = None
    embedding_created: bool | None = None
    screenshot_path: str | None = None
    failure_category: str | None = None
    duration_ms: int | None = None
    current_phase: str | None = None
    retry_history: list[str] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)


class BrowserIngestionJobRead(BaseModel):
    id: int
    run_id: int
    video_id: int
    video_url: str
    title: str
    creator_name: str
    mode: str
    status: str
    retry_count: int
    error_message: str | None
    result_json: dict[str, Any] | None
    transcript_status: str | None = None
    comments_status: str | None = None
    sheets_status: str | None = None
    embedding_status: str | None = None
    failure_category: str | None = None
    duration_seconds: float | None = None
    worker_name: str | None = None
    screenshot_path: str | None = None
    current_phase: str | None = None
    retry_history: list[str] = Field(default_factory=list)
    updated_at: datetime
    finished_at: datetime | None = None

    model_config = {"from_attributes": True}


class BrowserIngestionRunStats(BaseModel):
    jobs_total: int = 0
    queued: int = 0
    processing: int = 0
    success: int = 0
    failed: int = 0
    skipped: int = 0
    processed: int = 0
    progress_pct: float = 0.0
    success_pct: float = 0.0


class BrowserIngestionRunRead(BaseModel):
    id: int
    status: str
    mode: str
    limit_count: int | None
    creator_filter: str | None
    latest_only: bool
    only_missing: bool
    jobs_total: int
    message: str | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    run_stats: BrowserIngestionRunStats
    jobs: list[BrowserIngestionJobRead] = Field(default_factory=list)


class BrowserIngestionWorkerRead(BaseModel):
    id: int
    name: str
    status: str
    current_action: str
    current_phase: str | None = None
    current_job_id: int | None
    current_video_url: str | None
    last_heartbeat_at: datetime | None
    processed_today: int = 0
    success_today: int = 0
    failed_today: int = 0
    jobs_per_min: float | None = None
    consecutive_failures: int = 0
    max_jobs_per_day: int | None = None
    daily_limit_reached: bool = False
    cooldown_until: datetime | None = None
    extension_version: str | None = None
    required_extension_version: str | None = None
    memory_mb: float | None = None
    uptime_seconds: int | None = None
    last_screenshot_path: str | None = None
    last_success_at: datetime | None = None
    restart_recommended: bool = False
    processed_per_hour: float | None = None
    health_status: str = "unknown"
    clear_local_cooldown: bool = False

    model_config = {"from_attributes": True}


class BrowserIngestionDashboard(BaseModel):
    worker: BrowserIngestionWorkerRead | None
    active_run_id: int | None
    run: BrowserIngestionRunRead | None
    catalog_videos_total: int = 0
    catalog_missing_transcript: int = 0
    catalog_missing_comments: int = 0


class BrowserIngestionStartResponse(BaseModel):
    run: BrowserIngestionRunRead
    message: str


class BrowserIngestionWorkerRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class BrowserIngestionWorkerRegisterResponse(BaseModel):
    worker_id: int
    token: str
    message: str


class BrowserIngestionHeartbeatRequest(BaseModel):
    status: str = Field(
        default="online",
        pattern="^(online|paused|incompatible_extension|cooldown|daily_limit)$",
    )
    current_action: str = "idle"
    current_phase: str | None = None
    current_job_id: int | None = None
    current_video_url: str | None = None
    processed_today: int = 0
    success_today: int = 0
    failed_today: int = 0
    jobs_per_min: float | None = None
    consecutive_failures: int = 0
    max_jobs_per_day: int | None = None
    daily_limit_reached: bool = False
    cooldown_until: str | None = None
    extension_version: str | None = None
    required_extension_version: str | None = None
    memory_mb: float | None = None
    uptime_seconds: int | None = None
    last_screenshot_path: str | None = None
    last_success_at: str | None = None
    restart_recommended: bool = False
    processed_per_hour: float | None = None


class BrowserIngestionJobClaimResponse(BaseModel):
    job: BrowserIngestionJobRead | None = None
    run_paused: bool = False


class BrowserIngestionJobCompleteRequest(BaseModel):
    result: BrowserIngestionJobResult | None = None


class BrowserIngestionJobFailRequest(BaseModel):
    error_message: str = Field(..., min_length=1, max_length=8000)
    result: BrowserIngestionJobResult | None = None
    retryable: bool = True


class BrowserIngestionJobsPage(BaseModel):
    items: list[BrowserIngestionJobRead]
    total: int
    offset: int
    limit: int
    status_filter: str | None = None
