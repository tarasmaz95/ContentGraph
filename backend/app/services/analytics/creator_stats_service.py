"""Daily creator snapshots from synced catalog metadata."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.creator_stats_history import CreatorStatsHistory
from app.models.video import Video
from app.services.analytics.channel_id import extract_youtube_channel_id

logger = logging.getLogger(__name__)


class CreatorStatsService:
    """Capture and query creator-level time series."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def capture_daily_snapshot(
        self, snapshot_date: date | None = None
    ) -> int:
        """
        Upsert one row per creator for snapshot_date (default: today UTC).

        Uses current videos table — no external API calls.
        """
        day = snapshot_date or datetime.now(timezone.utc).date()

        stmt = (
            select(
                Video.creator_name,
                func.max(Video.channel_url).label("channel_url"),
                func.max(Video.subscribers_count).label("subscribers"),
                func.sum(Video.views_count).label("total_views"),
                func.count().label("total_videos"),
            )
            .group_by(Video.creator_name)
        )
        rows = (await self._db.execute(stmt)).all()
        saved = 0

        for row in rows:
            channel_id = extract_youtube_channel_id(row.channel_url or "")
            values = {
                "creator_name": row.creator_name,
                "youtube_channel_id": channel_id,
                "subscribers_count": int(row.subscribers or 0),
                "total_views": int(row.total_views or 0),
                "total_videos": int(row.total_videos or 0),
                "snapshot_date": day,
                "captured_at": datetime.now(timezone.utc),
            }
            upsert = (
                insert(CreatorStatsHistory)
                .values(**values)
                .on_conflict_do_update(
                    constraint="uq_creator_stats_day",
                    set_={
                        "youtube_channel_id": values["youtube_channel_id"],
                        "subscribers_count": values["subscribers_count"],
                        "total_views": values["total_views"],
                        "total_videos": values["total_videos"],
                        "captured_at": values["captured_at"],
                    },
                )
            )
            await self._db.execute(upsert)
            saved += 1

        await self._db.flush()
        logger.info("creator_stats_snapshot day=%s creators=%s", day, saved)
        return saved
