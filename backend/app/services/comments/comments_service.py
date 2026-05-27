"""
YouTube comments ingestion via YouTube Data API.

Flow: channel_url → video ID → commentThreads.list → save top comments.
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from googleapiclient.discovery import build
from sqlalchemy import delete, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.comment import Comment
from app.models.video import Video
from app.services.comments.scoring import compute_comment_score
from app.services.comments.sentiment import enrich_comment
from app.services.transcripts.transcript_service import TranscriptService


class CommentsService:
    """Fetch and store top YouTube comments per video."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._settings = get_settings()

    @property
    def is_available(self) -> bool:
        """True when YOUTUBE_API_KEY is configured."""
        return bool(self._settings.youtube_api_key.strip())

    async def fetch_for_video(self, video: Video, max_comments: int | None = None) -> int:
        """
        Fetch top comments for one video and replace stored rows.

        Returns number of comments saved.
        """
        if not self.is_available:
            return 0

        yt_id = TranscriptService.extract_video_id(
            video.video_url or ""
        ) or TranscriptService.extract_video_id(video.channel_url)
        if not yt_id:
            return 0

        limit = max_comments or self._settings.comments_max_per_video
        raw_items = await asyncio.to_thread(
            self._fetch_comments_sync, yt_id, limit
        )
        if not raw_items:
            return 0

        await self._db.execute(delete(Comment).where(Comment.video_id == video.id))

        saved = 0
        for item in raw_items:
            sentiment, tags = enrich_comment(item["text"])
            reply_count = int(item.get("reply_count") or 0)
            score = compute_comment_score(
                likes_count=item["likes"],
                reply_count=reply_count,
                is_pinned=False,
                is_hearted=False,
            )
            row = Comment(
                video_id=video.id,
                comment_text=item["text"],
                author_name=item["author"],
                likes_count=item["likes"],
                reply_count=reply_count,
                published_at=item["published_at"],
                # YouTube Data API gives exact timestamp, so no relative text.
                published_text=None,
                # Data API doesn't expose pinned/hearted on the snippet endpoint —
                # leave defaults; extension flow fills them when available.
                is_pinned=False,
                is_hearted=False,
                comment_score=score,
                sentiment=sentiment,
                emotional_tags=tags,
            )
            self._db.add(row)
            saved += 1

        await self._db.flush()
        return saved

    async def list_videos_without_comments(self, limit: int) -> list[Video]:
        """Videos eligible for comment fetch (no stored comments yet)."""
        stmt = (
            select(Video)
            .where(
                (Video.video_url.isnot(None)) | (Video.channel_url.isnot(None)),
                ~exists(select(Comment.id).where(Comment.video_id == Video.id)),
            )
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def enrich_missing(self) -> int:
        """
        After sync: fetch comments for videos that have none yet.

        Limited per run to keep the pipeline lightweight.
        """
        if not self.is_available:
            return 0

        limit = self._settings.comments_enrich_limit
        videos = await self.list_videos_without_comments(limit)

        total = 0
        for video in videos:
            total += await self.fetch_for_video(video)

        await self._db.commit()
        return total

    async def list_for_video(self, video_id: int, limit: int = 60) -> list[Comment]:
        """Top comments by composite score (was: pure likes) for a video.

        Default 60 lets the aggregator work with the full v0.2.9+ payload
        (50 saved) plus headroom for older 20-row videos still in the DB.
        Sort uses `comment_score DESC` (index `ix_comments_video_score`) and
        falls back to `likes_count` for tie-breaks.
        """
        stmt = (
            select(Comment)
            .where(Comment.video_id == video_id)
            .order_by(Comment.comment_score.desc(), Comment.likes_count.desc())
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def count_for_video(self, video_id: int) -> int:
        return int(
            await self._db.scalar(
                select(func.count()).select_from(Comment).where(Comment.video_id == video_id)
            )
            or 0
        )

    async def search_comment_text(self, query: str, limit: int = 20) -> list[Comment]:
        """Keyword search in comment bodies — used by semantic retrieval."""
        pattern = f"%{query}%"
        stmt = (
            select(Comment)
            .where(Comment.comment_text.ilike(pattern))
            .order_by(Comment.likes_count.desc())
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    def _fetch_comments_sync(
        self,
        youtube_video_id: str,
        max_results: int,
    ) -> list[dict]:
        """
        Blocking YouTube Data API call — top-level comments only.

        Requires YouTube Data API v3 enabled + API key with comment access.
        """
        api_key = self._settings.youtube_api_key
        youtube = build("youtube", "v3", developerKey=api_key, cache_discovery=False)

        response = (
            youtube.commentThreads()
            .list(
                part="snippet",
                videoId=youtube_video_id,
                order="relevance",
                maxResults=min(max_results, 100),
                textFormat="plainText",
            )
            .execute()
        )

        items: list[dict] = []
        for thread in response.get("items", []):
            thread_snippet = thread.get("snippet", {}) or {}
            snippet = thread_snippet.get("topLevelComment", {}).get("snippet", {}) or {}
            text = (snippet.get("textDisplay") or snippet.get("textOriginal") or "").strip()
            if not text or len(text) < 3:
                continue

            published = None
            raw_date = snippet.get("publishedAt")
            if raw_date:
                published = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))

            items.append(
                {
                    "text": text[:4000],
                    "author": snippet.get("authorDisplayName", "")[:255],
                    "likes": int(snippet.get("likeCount", 0)),
                    "reply_count": int(thread_snippet.get("totalReplyCount", 0) or 0),
                    "published_at": published,
                }
            )

        return items[:max_results]
