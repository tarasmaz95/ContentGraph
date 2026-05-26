"""Read/query helpers + hybrid semantic retrieval."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.schemas.video import VideoDetail, VideoRead
from app.services.retrieval_service import HybridRetrievalService
from app.services.video_helpers import video_to_detail, video_to_read


class VideoService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._retrieval = HybridRetrievalService(db)

    async def get_by_id(self, video_id: int) -> VideoDetail | None:
        video = await self._db.get(Video, video_id)
        if video is None:
            return None
        return video_to_detail(video)

    async def list_videos(self, limit: int = 100, offset: int = 0) -> tuple[list[VideoRead], int]:
        total = (await self._db.execute(select(func.count()).select_from(Video))).scalar_one()
        result = await self._db.execute(
            select(Video).order_by(Video.views_count.desc()).limit(limit).offset(offset)
        )
        videos = [video_to_read(v) for v in result.scalars().all()]
        return videos, total

    async def catalog_stats(self) -> dict[str, int]:
        """Counts for catalog + embedding coverage (dashboard copy)."""
        video_count = (
            await self._db.execute(select(func.count()).select_from(Video))
        ).scalar_one()
        title_emb = (
            await self._db.execute(
                select(func.count()).select_from(Video).where(Video.title_embedding.isnot(None))
            )
        ).scalar_one()
        transcript_emb = (
            await self._db.execute(
                select(func.count())
                .select_from(Video)
                .where(Video.transcript_embedding.isnot(None))
            )
        ).scalar_one()
        return {
            "video_count": int(video_count or 0),
            "title_embedding_count": int(title_emb or 0),
            "transcript_embedding_count": int(transcript_emb or 0),
        }

    async def top_videos(self, limit: int = 10) -> list[VideoRead]:
        result = await self._db.execute(
            select(Video).order_by(Video.views_count.desc()).limit(limit)
        )
        return [video_to_read(v) for v in result.scalars().all()]

    async def search(self, q: str, limit: int = 50) -> list[VideoRead]:
        pattern = f"%{q}%"
        result = await self._db.execute(
            select(Video)
            .where(
                or_(
                    Video.title.ilike(pattern),
                    Video.creator_name.ilike(pattern),
                    Video.transcript.ilike(pattern),
                )
            )
            .order_by(Video.views_count.desc())
            .limit(limit)
        )
        return [video_to_read(v, query_for_snippet=q) for v in result.scalars().all()]

    async def semantic_search(self, q: str, limit: int = 30) -> list[VideoRead]:
        return await self._retrieval.semantic_search(q, limit=limit)

    async def hybrid_retrieve(
        self,
        query: str,
        keywords: list[str],
        creator_filter: str | None = None,
        limit: int = 40,
    ) -> list[VideoRead]:
        return await self._retrieval.hybrid_retrieve(
            query=query,
            keywords=keywords,
            creator_filter=creator_filter,
            limit=limit,
        )
