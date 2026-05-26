"""Hybrid retrieval — title + transcript pgvector, keywords, views."""

import math
import re
from dataclasses import dataclass

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.video import Video
from app.schemas.video import VideoRead
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.embeddings.vector_utils import to_vector_literal
from app.services.transcripts.transcript_service import TranscriptService
from app.services.retrieval_scoring import (
    dynamic_min_similarity,
    hybrid_semantic_score,
    passes_semantic_filter,
    resolve_match_source,
)
from app.services.video_helpers import video_to_read


@dataclass
class ScoredVideo:
    video: VideoRead
    score: float
    semantic_score: float = 0.0
    title_sim: float = 0.0
    transcript_sim: float = 0.0
    keyword_boost: float = 0.0
    views_score: float = 0.0
    match_source: str = "keyword"


class HybridRetrievalService:
    """
    Combines title + transcript semantic similarity with keywords and views.

    Transcript vectors improve queries like "discipline mindset" or "AI productivity".
    """

    # Fallback floor when dynamic filter returns nothing (keyword path used instead)
    SEMANTIC_MIN_SIMILARITY = 0.18

    WEIGHT_SEMANTIC = 0.55
    WEIGHT_VIEWS = 0.25
    WEIGHT_KEYWORD = 0.15

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._embeddings = EmbeddingService(db)

    async def hybrid_retrieve(
        self,
        query: str,
        keywords: list[str],
        creator_filter: str | None = None,
        limit: int = 40,
    ) -> list[VideoRead]:
        candidates: dict[int, ScoredVideo] = {}
        max_views = await self._get_max_views()
        query_keywords = _normalize_keywords(query, keywords)

        title_hits = await self._vector_search_title(query, limit=limit)
        transcript_hits = await self._vector_search_transcript(query, limit=limit)

        for hit in title_hits:
            self._upsert_candidate(candidates, hit, max_views, source="title")

        for hit in transcript_hits:
            self._upsert_candidate(candidates, hit, max_views, source="transcript")

        for kw in query_keywords:
            if len(kw) < 3:
                continue
            for hit in await self._keyword_search(kw, limit=25):
                self._apply_keyword_boost(candidates, hit, kw, max_views)

        # Comment text matches boost parent videos (audience language in retrieval)
        for hit, snippet in await self._comment_search(query, limit=20):
            self._apply_comment_boost(candidates, hit, snippet, max_views)

        if creator_filter:
            for hit in await self._keyword_search(creator_filter, limit=30):
                if hit.creator_name.lower() == creator_filter.lower():
                    if hit.id in candidates:
                        candidates[hit.id].score += 0.08
                    else:
                        views_s = _views_normalize(hit.views_count, max_views)
                        candidates[hit.id] = ScoredVideo(
                            video=hit,
                            score=0.15 + self.WEIGHT_VIEWS * views_s,
                            views_score=views_s,
                        )

        if not candidates:
            for hit in await self._top_videos(limit=20):
                views_s = _views_normalize(hit.views_count, max_views)
                candidates[hit.id] = ScoredVideo(
                    video=hit,
                    score=self.WEIGHT_VIEWS * views_s,
                    views_score=views_s,
                )

        ranked = sorted(candidates.values(), key=lambda c: c.score, reverse=True)
        return [entry.video for entry in ranked[:limit]]

    async def semantic_search(self, query: str, limit: int = 30) -> list[VideoRead]:
        """API semantic search — transcript-aware merge."""
        candidates: dict[int, ScoredVideo] = {}
        max_views = await self._get_max_views()

        for hit in await self._vector_search_title(query, limit=limit):
            self._upsert_candidate(candidates, hit, max_views, source="title")
        for hit in await self._vector_search_transcript(query, limit=limit):
            self._upsert_candidate(candidates, hit, max_views, source="transcript")

        if not candidates:
            return await self._keyword_search(query, limit=limit)

        ranked = sorted(candidates.values(), key=lambda c: c.score, reverse=True)
        max_score = ranked[0].semantic_score if ranked else 0.0
        filtered = [
            e
            for e in ranked
            if passes_semantic_filter(
                query=query,
                hybrid_score=e.semantic_score,
                title_sim=e.title_sim,
                transcript_sim=e.transcript_sim,
                max_score=max_score,
            )
        ]
        if not filtered:
            return await self._keyword_search(query, limit=limit)
        return [e.video for e in filtered[:limit]]

    async def semantic_search_for_creator(
        self,
        creator_name: str,
        query: str,
        limit: int = 20,
    ) -> list[VideoRead]:
        """
        Semantic search limited to one creator's catalog.

        Vector search runs globally, then filters; keyword fallback is creator-scoped.
        """
        candidates: dict[int, ScoredVideo] = {}
        max_views = await self._get_max_views()
        creator_lower = creator_name.lower().strip()
        fetch_limit = max(limit * 4, 40)

        for hit in await self._vector_search_title(
            query, limit=fetch_limit, creator_name=creator_name
        ):
            if hit.creator_name.lower() == creator_lower:
                self._upsert_candidate(candidates, hit, max_views, source="title")

        for hit in await self._vector_search_transcript(
            query, limit=fetch_limit, creator_name=creator_name
        ):
            if hit.creator_name.lower() == creator_lower:
                self._upsert_candidate(candidates, hit, max_views, source="transcript")

        if not candidates:
            for hit in await self._keyword_search_creator(creator_name, query, limit=limit):
                self._apply_keyword_boost(candidates, hit, query, max_views)

        ranked = sorted(candidates.values(), key=lambda c: c.score, reverse=True)
        max_score = ranked[0].semantic_score if ranked else 0.0
        filtered = [
            e
            for e in ranked
            if passes_semantic_filter(
                query=query,
                hybrid_score=e.semantic_score,
                title_sim=e.title_sim,
                transcript_sim=e.transcript_sim,
                max_score=max_score,
            )
        ]
        return [e.video for e in (filtered or ranked)[:limit]]

    def _upsert_candidate(
        self,
        candidates: dict[int, ScoredVideo],
        hit: VideoRead,
        max_views: int,
        source: str,
    ) -> None:
        title_sim = hit.title_similarity or 0.0
        transcript_sim = hit.transcript_similarity or 0.0
        combined_sem = hybrid_semantic_score(title_sim, transcript_sim)
        views_s = _views_normalize(hit.views_count, max_views)

        if hit.id in candidates:
            entry = candidates[hit.id]
            entry.title_sim = max(entry.title_sim, title_sim)
            entry.transcript_sim = max(entry.transcript_sim, transcript_sim)
            entry.semantic_score = hybrid_semantic_score(entry.title_sim, entry.transcript_sim)
            entry.match_source = resolve_match_source(entry.title_sim, entry.transcript_sim)
            entry.score = (
                self.WEIGHT_SEMANTIC * entry.semantic_score
                + self.WEIGHT_VIEWS * views_s
                + self.WEIGHT_KEYWORD * entry.keyword_boost
            )
            entry.video.similarity_score = round(entry.semantic_score, 4)
            entry.video.title_similarity = round(entry.title_sim, 4) or None
            entry.video.transcript_similarity = round(entry.transcript_sim, 4) or None
            entry.video.match_source = entry.match_source
        else:
            match_source = resolve_match_source(title_sim, transcript_sim)
            candidates[hit.id] = ScoredVideo(
                video=hit,
                score=self.WEIGHT_SEMANTIC * combined_sem + self.WEIGHT_VIEWS * views_s,
                semantic_score=combined_sem,
                title_sim=title_sim,
                transcript_sim=transcript_sim,
                views_score=views_s,
                match_source=match_source,
            )
            hit.similarity_score = round(combined_sem, 4)
            hit.title_similarity = round(title_sim, 4) or None
            hit.transcript_similarity = round(transcript_sim, 4) or None
            hit.match_source = match_source

    def _apply_keyword_boost(
        self,
        candidates: dict[int, ScoredVideo],
        hit: VideoRead,
        kw: str,
        max_views: int,
    ) -> None:
        in_title = kw.lower() in hit.title.lower()
        in_transcript = bool(
            hit.transcript_preview and kw.lower() in hit.transcript_preview.lower()
        )
        boost = 1.0 if in_title else (0.7 if in_transcript else 0.4)
        views_s = _views_normalize(hit.views_count, max_views)

        if hit.id in candidates:
            entry = candidates[hit.id]
            entry.keyword_boost = max(entry.keyword_boost, boost)
            entry.score += self.WEIGHT_KEYWORD * boost
            if in_transcript and entry.match_source == "title":
                entry.match_source = "both"
        else:
            candidates[hit.id] = ScoredVideo(
                video=hit,
                score=self.WEIGHT_KEYWORD * boost + self.WEIGHT_VIEWS * views_s,
                keyword_boost=boost,
                views_score=views_s,
                match_source="keyword",
            )
            hit.match_source = "keyword"

    async def _vector_search_title(
        self,
        query: str,
        limit: int,
        creator_name: str | None = None,
    ) -> list[VideoRead]:
        return await self._vector_search_column(
            query, Video.title_embedding, "title", limit, creator_name=creator_name
        )

    async def _vector_search_transcript(
        self,
        query: str,
        limit: int,
        creator_name: str | None = None,
    ) -> list[VideoRead]:
        return await self._vector_search_column(
            query,
            Video.transcript_embedding,
            "transcript",
            limit,
            creator_name=creator_name,
        )

    async def _vector_search_column(
        self,
        query: str,
        column,
        source: str,
        limit: int,
        creator_name: str | None = None,
    ) -> list[VideoRead]:
        if not self._embeddings.is_available:
            return []

        has_any = await self._db.scalar(
            select(func.count()).select_from(Video).where(column.isnot(None))
        )
        if not has_any:
            return []

        try:
            query_vector = await self._embeddings.embed_text(query)
        except Exception:
            return []

        col_name = (
            "title_embedding" if source == "title" else "transcript_embedding"
        )
        literal = to_vector_literal(query_vector)
        creator_filter = ""
        params: dict[str, object] = {"limit": limit}
        if creator_name:
            creator_filter = "AND creator_name ILIKE :creator"
            params["creator"] = f"%{creator_name}%"

        sql = text(
            f"""
            SELECT *, 1 - ({col_name} <=> '{literal}'::vector) AS similarity
            FROM videos
            WHERE {col_name} IS NOT NULL {creator_filter}
            ORDER BY {col_name} <=> '{literal}'::vector
            LIMIT :limit
            """
        )
        result = await self._db.execute(sql, params)
        rows = result.mappings().all()

        videos: list[VideoRead] = []
        for row in rows:
            video = await self._db.get(Video, row["id"])
            if video is None:
                continue
            similarity = row["similarity"]
            sim = round(float(similarity), 4)
            read = video_to_read(
                video,
                query_for_snippet=query,
                title_similarity=sim if source == "title" else None,
                transcript_similarity=sim if source == "transcript" else None,
                match_source=source,
            )
            if source == "title":
                read.title_similarity = sim
            else:
                read.transcript_similarity = sim
            read.similarity_score = sim
            videos.append(read)
        return videos

    async def _keyword_search_creator(
        self,
        creator_name: str,
        q: str,
        limit: int,
    ) -> list[VideoRead]:
        """Keyword search within one creator's titles and transcripts."""
        pattern = f"%{q}%"
        creator_pattern = f"%{creator_name}%"
        stmt = (
            select(Video)
            .where(
                Video.creator_name.ilike(creator_pattern),
                or_(
                    Video.title.ilike(pattern),
                    Video.transcript.ilike(pattern),
                ),
            )
            .order_by(Video.views_count.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return [video_to_read(v, query_for_snippet=q) for v in result.scalars().all()]

    async def _comment_search(
        self, q: str, limit: int
    ) -> list[tuple[VideoRead, str]]:
        """Match query in stored comment bodies — returns video + snippet."""
        if len(q.strip()) < 3:
            return []
        pattern = f"%{q}%"
        stmt = (
            select(Video, Comment.comment_text)
            .join(Comment, Comment.video_id == Video.id)
            .where(Comment.comment_text.ilike(pattern))
            .order_by(Comment.likes_count.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        out: list[tuple[VideoRead, str]] = []
        for video, text in result.all():
            snippet = text[:220] + ("…" if len(text) > 220 else "")
            read = video_to_read(video, match_source="comment", comment_snippet=snippet)
            out.append((read, snippet))
        return out

    def _apply_comment_boost(
        self,
        candidates: dict[int, ScoredVideo],
        hit: VideoRead,
        snippet: str,
        max_views: int,
    ) -> None:
        """Comments layer — surface videos where audience discusses the topic."""
        boost = 0.85
        views_s = _views_normalize(hit.views_count, max_views)
        hit.comment_snippet = snippet
        hit.match_source = "comment"
        hit.transcript_snippet = hit.transcript_snippet or snippet

        if hit.id in candidates:
            entry = candidates[hit.id]
            entry.keyword_boost = max(entry.keyword_boost, boost)
            entry.score += self.WEIGHT_KEYWORD * boost
            entry.match_source = "comment"
        else:
            candidates[hit.id] = ScoredVideo(
                video=hit,
                score=self.WEIGHT_KEYWORD * boost + self.WEIGHT_VIEWS * views_s,
                keyword_boost=boost,
                views_score=views_s,
                match_source="comment",
            )

    async def _keyword_search(self, q: str, limit: int) -> list[VideoRead]:
        pattern = f"%{q}%"
        stmt = (
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
        result = await self._db.execute(stmt)
        return [video_to_read(v, query_for_snippet=q) for v in result.scalars().all()]

    async def _top_videos(self, limit: int) -> list[VideoRead]:
        stmt = select(Video).order_by(Video.views_count.desc()).limit(limit)
        result = await self._db.execute(stmt)
        return [video_to_read(v) for v in result.scalars().all()]

    async def _get_max_views(self) -> int:
        value = await self._db.scalar(select(func.max(Video.views_count)))
        return int(value or 1)


def _views_normalize(views: int, max_views: int) -> float:
    if max_views <= 0:
        return 0.0
    return math.log1p(views) / math.log1p(max_views)


def _normalize_keywords(query: str, extra: list[str]) -> list[str]:
    stop = {
        "what", "which", "how", "why", "does", "do", "the", "a", "an",
        "for", "get", "most", "best", "analyze", "about", "videos", "video",
    }
    words = list(extra)
    for token in query.lower().split():
        cleaned = re.sub(r"[^a-z0-9']", "", token)
        if len(cleaned) >= 3 and cleaned not in stop and cleaned not in words:
            words.append(cleaned)
    return words[:10]
