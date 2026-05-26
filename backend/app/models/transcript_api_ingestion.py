"""API-based transcript ingestion — queue runs and per-video jobs."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TranscriptApiIngestionRun(Base):
    """One batch session of server-side transcript fetching (no browser)."""

    __tablename__ = "transcript_api_ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, index=True, default="queued")
    worker_count: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    limit_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    creator_filter: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latest_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    only_missing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    jobs_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)


class TranscriptApiIngestionJob(Base):
    """One video in an API ingestion run."""

    __tablename__ = "transcript_api_ingestion_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("transcript_api_ingestion_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    creator_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    transcript_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedding_created: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sheets_rows_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sheets_writeback: Mapped[str] = mapped_column(String(16), nullable=False, default="skipped")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
