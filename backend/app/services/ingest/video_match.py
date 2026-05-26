"""Match extension payloads to catalog Video rows (transcript + comments ingest)."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.services.transcripts.transcript_service import TranscriptService


async def find_catalog_video(
    db: AsyncSession,
    *,
    video_url: str,
    title: str,
    creator: str,
) -> Video | None:
    """YouTube ID in video_url or channel_url, then title + creator."""
    yt_id = TranscriptService.extract_video_id(video_url)
    # Only match by ID when it is a full 11-char YouTube video id (avoids false %x% hits)
    if yt_id and len(yt_id) == 11:
        by_id = await _find_by_youtube_id(db, yt_id, title=title)
        if by_id is not None:
            return by_id
    return await _find_by_title_creator(db, title, creator)


async def _find_by_youtube_id(
    db: AsyncSession, yt_id: str, *, title: str
) -> Video | None:
    pattern = f"%{yt_id}%"
    result = await db.execute(
        select(Video).where(
            (Video.video_url.ilike(pattern)) | (Video.channel_url.ilike(pattern))
        )
    )
    rows = list(result.scalars().all())
    if not rows:
        return None
    if len(rows) == 1:
        return rows[0]
    title_lower = title.lower()
    for row in rows:
        if row.title.lower() == title_lower:
            return row
    return max(rows, key=lambda v: v.views_count)


async def _find_by_title_creator(
    db: AsyncSession, title: str, creator: str
) -> Video | None:
    result = await db.execute(
        select(Video)
        .where(func.lower(Video.title) == title.lower())
        .where(func.lower(Video.creator_name) == creator.lower())
        .order_by(Video.views_count.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
