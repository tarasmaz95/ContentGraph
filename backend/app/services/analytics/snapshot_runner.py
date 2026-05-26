"""Run daily creator + video stat snapshots (cron or manual)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.snapshot_monitoring import SnapshotRunResponse
from app.services.cache.intelligence_cache import invalidate_intelligence_cache
from app.services.analytics.creator_stats_service import CreatorStatsService
from app.services.analytics.snapshot_run_service import SnapshotRunService
from app.services.analytics.video_stats_service import VideoStatsService

logger = logging.getLogger(__name__)


async def run_daily_snapshots(
    db: AsyncSession,
    *,
    source: str = "manual",
) -> SnapshotRunResponse:
    """Idempotent daily capture — upserts rows for today UTC; logs run to snapshot_runs."""
    started_at = datetime.now(timezone.utc)
    day = started_at.date()
    creators = 0
    videos = 0
    status = "success"
    error_message: str | None = None
    run_id: int | None = None
    duration_ms = 0

    try:
        creators = await CreatorStatsService(db).capture_daily_snapshot(day)
        videos = await VideoStatsService(db).capture_daily_snapshot(day)
        await db.commit()
        invalidate_intelligence_cache()
        logger.info(
            "daily_snapshots_complete date=%s creators=%s videos=%s source=%s",
            day,
            creators,
            videos,
            source,
        )
    except Exception as exc:
        status = "failed"
        error_message = str(exc)[:2000]
        await db.rollback()
        logger.exception("daily_snapshots_failed source=%s", source)
    finally:
        finished_at = datetime.now(timezone.utc)
        duration_ms = int((finished_at - started_at).total_seconds() * 1000)
        run_row = await SnapshotRunService(db).record_run(
            started_at=started_at,
            finished_at=finished_at,
            status=status,
            creators_saved=creators,
            videos_saved=videos,
            duration_ms=duration_ms,
            error_message=error_message,
            source=source,
        )
        await db.commit()
        run_id = run_row.id

    if status == "failed":
        raise RuntimeError(error_message or "Snapshot run failed")

    return SnapshotRunResponse(
        snapshot_date=day,
        creators_saved=creators,
        videos_saved=videos,
        message=f"Snapshots saved for {day.isoformat()}.",
        run_id=run_id,
        duration_ms=duration_ms,
    )
