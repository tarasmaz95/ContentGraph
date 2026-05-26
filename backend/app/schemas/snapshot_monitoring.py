"""Snapshot cron observability — status, history, run response."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class SnapshotStatusResponse(BaseModel):
    """Latest run + next scheduled cron time (computed)."""

    scheduler_enabled: bool = True
    schedule_hour_utc: int = 3
    schedule_minute_utc: int = 15
    next_scheduled_at: datetime | None = None
    last_started_at: datetime | None = None
    last_finished_at: datetime | None = None
    last_status: str | None = None
    creators_saved: int | None = None
    videos_saved: int | None = None
    duration_ms: int | None = None
    error_message: str | None = None


class SnapshotRunHistoryItem(BaseModel):
    id: int
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    creators_saved: int = 0
    videos_saved: int = 0
    duration_ms: int | None = None
    error_message: str | None = None
    source: str = "manual"


class SnapshotRunHistoryResponse(BaseModel):
    items: list[SnapshotRunHistoryItem] = Field(default_factory=list)


class SnapshotRunResponse(BaseModel):
    """Result of POST /snapshots/run (unchanged fields + run log id)."""

    snapshot_date: date
    creators_saved: int
    videos_saved: int
    message: str
    run_id: int | None = None
    duration_ms: int | None = None
