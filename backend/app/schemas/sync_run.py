"""Schemas for background Sheets sync runs."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SyncRunStatus = Literal["queued", "running", "completed", "failed"]
SyncRunMode = Literal["quick", "full"]
SyncRunStage = Literal[
    "queued",
    "reading_sheet",
    "saving_videos",
    "analyzing_titles",
    "processing_transcripts",
    "finding_hook_patterns",
    "syncing_comments",
    "finalizing",
]


class SyncStartRequest(BaseModel):
    mode: SyncRunMode = "quick"


class SyncRunStartResponse(BaseModel):
    run_id: int
    status: SyncRunStatus = "queued"
    mode: SyncRunMode = "quick"


class SyncRunRead(BaseModel):
    id: int
    mode: SyncRunMode = "full"
    status: SyncRunStatus
    stage: str
    processed: int = 0
    total: int | None = None
    message: str | None = None
    current_entity_name: str | None = None
    warning_count: int = 0
    warnings: list[dict[str, Any]] = Field(default_factory=list)
    result: dict[str, Any] | None = None
    error_message: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
    duration_seconds: int | None = None

    model_config = {"from_attributes": True}


class LastSyncStatus(BaseModel):
    """Latest completed sync for UI badges."""

    run_id: int
    mode: SyncRunMode
    finished_at: datetime
    duration_seconds: int | None = None
    catalog_video_count: int = 0
    sheet_rows: int = 0
    warning_count: int = 0
    relative_label: str | None = None


class SyncRunSummary(BaseModel):
    """Human-facing completion stats (also stored in result_json)."""

    total_rows: int = 0
    created: int = 0
    updated: int = 0
    titles_analyzed: int = 0
    transcripts_processed: int = 0
    transcript_text_from_sheet: int = 0
    hook_patterns_found: int = 0
    audience_discussions_added: int = 0
    warning_count: int = 0
    duration_seconds: int | None = None
