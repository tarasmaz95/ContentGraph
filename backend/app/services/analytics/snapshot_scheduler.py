"""APScheduler hook — one daily snapshot job inside the API process."""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.services.analytics.snapshot_runner import run_daily_snapshots

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _job_daily_snapshots() -> None:
    try:
        async with AsyncSessionLocal() as db:
            result = await run_daily_snapshots(db, source="scheduled")
        logger.info("scheduled_snapshot %s", result.message)
    except Exception:
        logger.exception("scheduled_snapshot_failed")


def start_snapshot_scheduler() -> AsyncIOScheduler | None:
    """Start cron scheduler if enabled. Safe to call once at app startup."""
    global _scheduler
    settings = get_settings()
    if not settings.stats_scheduler_enabled:
        logger.info("stats_scheduler_disabled")
        return None
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        _job_daily_snapshots,
        trigger=CronTrigger(
            hour=settings.stats_snapshot_hour_utc,
            minute=settings.stats_snapshot_minute_utc,
        ),
        id="daily_stats_snapshot",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "stats_scheduler_started hour_utc=%s minute=%s",
        settings.stats_snapshot_hour_utc,
        settings.stats_snapshot_minute_utc,
    )
    return _scheduler


def shutdown_snapshot_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("stats_scheduler_stopped")
