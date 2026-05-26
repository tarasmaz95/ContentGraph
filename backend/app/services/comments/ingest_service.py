"""Save browser-extracted top comments onto catalog videos (no YouTube API)."""

import logging

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.schemas.comment_ingest import CommentsIngestRequest, CommentsIngestResponse
from app.services.comments.sentiment import enrich_comment
from app.services.ingest.video_match import find_catalog_video
from google_sheets.comments_writeback_service import SheetsCommentsWritebackService

logger = logging.getLogger(__name__)


class CommentsIngestService:
    """Match video, replace stored comments, apply lightweight sentiment tags."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def ingest(self, payload: CommentsIngestRequest) -> CommentsIngestResponse:
        video = await find_catalog_video(
            self._db,
            video_url=payload.video_url.strip(),
            title=payload.title.strip(),
            creator=payload.creator.strip(),
        )
        if video is None:
            return CommentsIngestResponse(
                matched=False,
                comments_saved=0,
                message=(
                    "No matching catalog video. Sync your sheet first, or check "
                    "title/creator match the catalog row."
                ),
                sheets_writeback="skipped",
            )

        # Normalize, dedupe by text, sort by likes desc, cap at 20
        seen: set[str] = set()
        cleaned: list[dict] = []
        for item in sorted(payload.comments, key=lambda c: c.likes, reverse=True):
            text = " ".join(item.text.split()).strip()
            if len(text) < 2 or text.lower() in seen:
                continue
            seen.add(text.lower())
            cleaned.append(
                {
                    "text": text[:4000],
                    "author": (item.author or "").strip()[:255],
                    "likes": int(item.likes or 0),
                }
            )
            if len(cleaned) >= 20:
                break

        if not cleaned:
            return CommentsIngestResponse(
                video_id=video.id,
                matched=True,
                comments_saved=0,
                message="No valid comments after filtering.",
                sheets_writeback="skipped",
            )

        await self._db.execute(delete(Comment).where(Comment.video_id == video.id))

        for row in cleaned:
            sentiment, tags = enrich_comment(row["text"])
            self._db.add(
                Comment(
                    video_id=video.id,
                    comment_text=row["text"],
                    author_name=row["author"],
                    likes_count=row["likes"],
                    published_at=None,
                    sentiment=sentiment,
                    emotional_tags=tags,
                )
            )

        await self._db.commit()
        await self._db.refresh(video)

        wb = await SheetsCommentsWritebackService(self._db).write_after_ingest(
            video, cleaned
        )
        logger.info(
            "comments_ingest_done video_id=%s comments_saved=%s sheets_writeback=%s "
            "sheets_rows_updated=%s sheets_message=%r",
            video.id,
            len(cleaned),
            wb.status,
            wb.rows_updated,
            wb.message,
        )

        return CommentsIngestResponse(
            video_id=video.id,
            matched=True,
            comments_saved=len(cleaned),
            message=f"Saved {len(cleaned)} comments to catalog video.",
            sheets_rows_updated=wb.rows_updated,
            sheets_writeback=wb.status,
            sheets_message=wb.message or None,
        )
