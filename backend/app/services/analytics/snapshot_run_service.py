"""Read/write snapshot_runs for Settings monitoring."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.snapshot_run import SnapshotRun
from app.schemas.snapshot_monitoring import (
    SnapshotRunHistoryItem,
    SnapshotRunHistoryResponse,
    SnapshotStatusResponse,
)


def compute_next_scheduled_run_utc() -> datetime | None:
    """Next daily run from env schedule (not live APScheduler state)."""
    settings = get_settings()
    if not settings.stats_scheduler_enabled:
        return None
    now = datetime.now(timezone.utc)
    candidate = now.replace(
        hour=settings.stats_snapshot_hour_utc,
        minute=settings.stats_snapshot_minute_utc,
        second=0,
        microsecond=0,
    )
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


class SnapshotRunService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def record_run(
        self,
        *,
        started_at: datetime,
        finished_at: datetime,
        status: str,
        creators_saved: int,
        videos_saved: int,
        duration_ms: int,
        error_message: str | None,
        source: str,
    ) -> SnapshotRun:
        row = SnapshotRun(
            started_at=started_at,
            finished_at=finished_at,
            status=status,
            creators_saved=creators_saved,
            videos_saved=videos_saved,
            duration_ms=duration_ms,
            error_message=error_message,
            source=source,
        )
        self._db.add(row)
        await self._db.flush()
        return row

    async def get_status(self) -> SnapshotStatusResponse:
        settings = get_settings()
        result = await self._db.execute(
            select(SnapshotRun).order_by(SnapshotRun.started_at.desc()).limit(1)
        )
        last = result.scalar_one_or_none()
        base = SnapshotStatusResponse(
            scheduler_enabled=settings.stats_scheduler_enabled,
            schedule_hour_utc=settings.stats_snapshot_hour_utc,
            schedule_minute_utc=settings.stats_snapshot_minute_utc,
            next_scheduled_at=compute_next_scheduled_run_utc(),
        )
        if last is None:
            return base
        return base.model_copy(
            update={
                "last_started_at": last.started_at,
                "last_finished_at": last.finished_at,
                "last_status": last.status,
                "creators_saved": last.creators_saved,
                "videos_saved": last.videos_saved,
                "duration_ms": last.duration_ms,
                "error_message": last.error_message,
            }
        )

    async def get_history(self, limit: int = 5) -> SnapshotRunHistoryResponse:
        result = await self._db.execute(
            select(SnapshotRun).order_by(SnapshotRun.started_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        return SnapshotRunHistoryResponse(
            items=[
                SnapshotRunHistoryItem(
                    id=r.id,
                    started_at=r.started_at,
                    finished_at=r.finished_at,
                    status=r.status,
                    creators_saved=r.creators_saved,
                    videos_saved=r.videos_saved,
                    duration_ms=r.duration_ms,
                    error_message=r.error_message,
                    source=r.source or "manual",
                )
                for r in rows
            ]
        )
