"""Daily per-video snapshots from catalog + stored comments."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.video import Video
from app.models.video_stats_history import VideoStatsHistory

logger = logging.getLogger(__name__)


class VideoStatsService:
    """Capture and query video-level time series."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def capture_daily_snapshot(
        self, snapshot_date: date | None = None
    ) -> int:
        """Upsert one row per video for snapshot_date (default: today UTC)."""
        day = snapshot_date or datetime.now(timezone.utc).date()

        comment_counts = dict(
            (await self._db.execute(
                select(Comment.video_id, func.count())
                .group_by(Comment.video_id)
            )).all()
        )

        videos = list((await self._db.execute(select(Video.id, Video.views_count))).all())
        saved = 0

        for video_id, views in videos:
            values = {
                "video_id": video_id,
                "views_count": int(views or 0),
                "likes_count": 0,
                "comments_count": int(comment_counts.get(video_id, 0)),
                "snapshot_date": day,
                "captured_at": datetime.now(timezone.utc),
            }
            upsert = (
                insert(VideoStatsHistory)
                .values(**values)
                .on_conflict_do_update(
                    constraint="uq_video_stats_day",
                    set_={
                        "views_count": values["views_count"],
                        "likes_count": values["likes_count"],
                        "comments_count": values["comments_count"],
                        "captured_at": values["captured_at"],
                    },
                )
            )
            await self._db.execute(upsert)
            saved += 1

        await self._db.flush()
        logger.info("video_stats_snapshot day=%s videos=%s", day, saved)
        return saved
