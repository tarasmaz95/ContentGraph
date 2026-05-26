"""Browser automation ingestion — local worker + extension queue."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BrowserIngestionWorker(Base):
    __tablename__ = "browser_ingestion_workers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="offline", index=True)
    current_action: Mapped[str] = mapped_column(String(64), nullable=False, default="idle")
    current_job_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_video_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stats_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class BrowserIngestionRun(Base):
    __tablename__ = "browser_ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, index=True, default="queued")
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="both")
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


class BrowserIngestionJob(Base):
    __tablename__ = "browser_ingestion_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("browser_ingestion_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    creator_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="both")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    worker_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("browser_ingestion_workers.id", ondelete="SET NULL"),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
