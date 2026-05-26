"""Select catalog videos for browser ingestion jobs."""

from __future__ import annotations

from sqlalchemy import exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.video import Video
from app.services.transcripts.api_ingestion.missing import missing_transcript_clause


def _missing_comments_clause():
    return not_(exists().where(Comment.video_id == Video.id))


async def select_videos_for_browser_run(
    db: AsyncSession,
    *,
    mode: str,
    limit: int,
    creator_filter: str | None,
    latest_only: bool,
    only_missing: bool,
) -> list[Video]:
    stmt = select(Video)
    if only_missing:
        if mode == "transcript":
            stmt = stmt.where(missing_transcript_clause())
        elif mode == "comments":
            stmt = stmt.where(_missing_comments_clause())
        else:
            stmt = stmt.where(
                or_(
                    missing_transcript_clause(),
                    _missing_comments_clause(),
                )
            )
    if creator_filter:
        stmt = stmt.where(func.lower(Video.creator_name) == creator_filter.lower())
    if latest_only:
        stmt = stmt.order_by(Video.published_at.desc().nullslast(), Video.id.desc())
    else:
        stmt = stmt.order_by(Video.views_count.desc(), Video.id.desc())
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())
