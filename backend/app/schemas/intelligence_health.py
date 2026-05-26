"""Intelligence coverage & health dashboard schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

SeverityLevel = Literal["info", "warning", "critical"]
HealthLevel = Literal["healthy", "partial", "degraded", "critical"]
FreshnessSeverity = Literal["green", "amber", "red"]


class IntelligenceOverview(BaseModel):
    total_videos: int = 0
    videos_with_transcripts: int = 0
    transcript_coverage_pct: float = 0.0
    videos_with_comments: int = 0
    comment_coverage_pct: float = 0.0
    videos_with_title_embeddings: int = 0
    videos_with_transcript_embeddings: int = 0
    embedding_coverage_pct: float = 0.0
    creators_tracked: int = 0
    hook_patterns_indexed: int = 0
    snapshot_days: int = 0
    latest_snapshot_date: date | None = None
    last_catalog_sync_at: datetime | None = None
    last_comment_ingest_at: datetime | None = None
    last_transcript_activity_at: datetime | None = None
    last_transcript_activity_note: str = ""


class FreshnessMetric(BaseModel):
    label: str
    value: int
    severity: FreshnessSeverity = "green"
    hint: str | None = None


class DataFreshnessSection(BaseModel):
    metrics: list[FreshnessMetric] = Field(default_factory=list)


class CreatorCoverageRow(BaseModel):
    creator_name: str
    video_count: int
    transcript_pct: float
    comment_pct: float
    embedding_pct: float
    latest_video_published_at: datetime | None = None
    is_strongest_coverage: bool = False
    is_weakest_coverage: bool = False


class CreatorCoverageSection(BaseModel):
    rows: list[CreatorCoverageRow] = Field(default_factory=list)
    strongest_creator: str | None = None
    weakest_creator: str | None = None


class TranscriptSourceCount(BaseModel):
    source: Literal["extension", "batch", "manual", "unknown"]
    count: int


class TranscriptHealthSection(BaseModel):
    total_transcripts: int = 0
    avg_transcript_length: float = 0.0
    transcripts_missing_embeddings: int = 0
    orphan_transcript_embeddings: int = 0
    videos_missing_transcript: int = 0
    source_breakdown: list[TranscriptSourceCount] = Field(default_factory=list)
    source_tracking_note: str = ""


class CreatorCommentVolume(BaseModel):
    creator_name: str
    comment_count: int


class CommentHealthSection(BaseModel):
    total_comments: int = 0
    videos_with_comments: int = 0
    avg_comments_per_video: float = 0.0
    videos_with_emotional_tags: int = 0
    emotional_tags_coverage_pct: float = 0.0
    neutral_only_pct: float = 0.0
    top_video_comment_share_pct: float = 0.0
    top_synced_creators: list[CreatorCommentVolume] = Field(default_factory=list)


class SnapshotRunRow(BaseModel):
    id: int
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    creators_saved: int = 0
    videos_saved: int = 0
    duration_ms: int | None = None
    error_message: str | None = None
    source: str = "manual"


class SnapshotHealthSection(BaseModel):
    scheduler_enabled: bool = True
    next_scheduled_at: datetime | None = None
    recent_runs: list[SnapshotRunRow] = Field(default_factory=list)
    videos_with_changing_snapshots: int = 0
    snapshot_days: int = 0


class HealthWarning(BaseModel):
    id: str
    severity: SeverityLevel
    message: str
    detail: str | None = None


class SystemStatusHeader(BaseModel):
    level: HealthLevel
    headline: str
    summary: str


class IntelligenceHealthResponse(BaseModel):
    generated_at: datetime
    system_status: SystemStatusHeader
    overview: IntelligenceOverview
    freshness: DataFreshnessSection
    creator_coverage: CreatorCoverageSection
    transcripts: TranscriptHealthSection
    comments: CommentHealthSection
    snapshots: SnapshotHealthSection
    warnings: list[HealthWarning] = Field(default_factory=list)
