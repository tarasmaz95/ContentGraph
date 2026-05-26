"""Controlled batch transcript fetch + embed for top-viewed catalog videos."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from youtube_transcript_api._errors import IpBlocked, RequestBlocked

from app.services.transcripts.transcript_service import TranscriptService
from app.services.transcripts.youtube_video_resolver import YouTubeVideoResolver

# text-embedding-3-small: ~$0.02 / 1M tokens; rough 4 chars/token for English
_CHARS_PER_TOKEN_EST = 4
_EMBED_PRICE_PER_1M_TOKENS = 0.02


@dataclass
class VideoBatchResult:
    video_id: int
    title: str
    views_count: int
    status: Literal[
        "skipped_has_transcript",
        "success",
        "no_youtube_id",
        "unavailable",
        "ip_blocked",
        "embed_failed",
        "fetch_error",
    ]
    youtube_id: str | None = None
    transcript_chars: int = 0
    error: str | None = None


@dataclass
class BatchReport:
    limit: int
    delay_seconds: float
    results: list[VideoBatchResult] = field(default_factory=list)
    started_at: float = 0.0
    finished_at: float = 0.0

    @property
    def runtime_seconds(self) -> float:
        return max(0.0, self.finished_at - self.started_at)

    @property
    def success_count(self) -> int:
        return sum(1 for r in self.results if r.status == "success")

    @property
    def failure_count(self) -> int:
        return sum(
            1
            for r in self.results
            if r.status
            in ("unavailable", "no_youtube_id", "embed_failed", "fetch_error", "ip_blocked")
        )

    @property
    def unavailable_count(self) -> int:
        return sum(1 for r in self.results if r.status == "unavailable")

    @property
    def ip_blocked_count(self) -> int:
        return sum(1 for r in self.results if r.status == "ip_blocked")

    @property
    def skipped_count(self) -> int:
        return sum(1 for r in self.results if r.status == "skipped_has_transcript")

    @property
    def avg_transcript_chars(self) -> float:
        chars = [r.transcript_chars for r in self.results if r.transcript_chars > 0]
        return sum(chars) / len(chars) if chars else 0.0

    def estimated_embedding_cost_usd(self) -> float:
        total_chars = sum(r.transcript_chars for r in self.results if r.transcript_chars)
        tokens = total_chars / _CHARS_PER_TOKEN_EST
        return (tokens / 1_000_000) * _EMBED_PRICE_PER_1M_TOKENS

    def to_dict(self) -> dict:
        return {
            "limit": self.limit,
            "delay_seconds": self.delay_seconds,
            "runtime_seconds": round(self.runtime_seconds, 2),
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "unavailable_count": self.unavailable_count,
            "ip_blocked_count": self.ip_blocked_count,
            "skipped_count": self.skipped_count,
            "avg_transcript_chars": round(self.avg_transcript_chars, 1),
            "estimated_embedding_cost_usd": round(
                self.estimated_embedding_cost_usd(), 6
            ),
            "results": [
                {
                    "video_id": r.video_id,
                    "title": r.title[:80],
                    "views_count": r.views_count,
                    "status": r.status,
                    "youtube_id": r.youtube_id,
                    "transcript_chars": r.transcript_chars,
                    "error": r.error,
                }
                for r in self.results
            ],
        }


class TranscriptEnrichmentBatch:
    """
    Top-viewed transcript enrichment using existing TranscriptService storage.

    Throttled sequential processing — no queues or browser automation.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._transcripts = TranscriptService(db)
        self._resolver = YouTubeVideoResolver()

    async def run(
        self,
        *,
        limit: int = 10,
        delay_seconds: float = 0.5,
        retries: int = 1,
        skip_existing: bool = True,
    ) -> BatchReport:
        report = BatchReport(limit=limit, delay_seconds=delay_seconds)
        report.started_at = time.monotonic()

        videos = await self._select_top_viewed(limit, skip_existing=skip_existing)

        for video in videos:
            result = await self._process_one(video, retries=retries)
            report.results.append(result)
            await self._db.commit()
            if delay_seconds > 0:
                await asyncio.sleep(delay_seconds)

        report.finished_at = time.monotonic()
        return report

    async def _select_top_viewed(
        self, limit: int, *, skip_existing: bool
    ) -> list[Video]:
        stmt = select(Video).order_by(Video.views_count.desc()).limit(limit)
        if skip_existing:
            stmt = stmt.where(Video.transcript.is_(None))
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def _process_one(self, video: Video, *, retries: int) -> VideoBatchResult:
        base = VideoBatchResult(
            video_id=video.id,
            title=video.title,
            views_count=video.views_count,
            status="fetch_error",
        )

        if video.transcript:
            base.status = "skipped_has_transcript"
            base.transcript_chars = len(video.transcript)
            return base

        yt_id = await self._resolver.resolve_for_video(video)
        base.youtube_id = yt_id
        if not yt_id:
            base.status = "no_youtube_id"
            return base

        fetched = False
        last_err: str | None = None
        blocked = False
        for attempt in range(retries + 1):
            try:
                raw = await asyncio.to_thread(
                    self._transcripts._fetch_transcript_sync, yt_id
                )
                if raw:
                    video.transcript = raw
                    video.transcript_embedding = None
                    await self._db.flush()
                    fetched = True
                    break
                last_err = "transcript_unavailable"
            except (RequestBlocked, IpBlocked) as exc:
                blocked = True
                last_err = str(exc)[:200]
                break
            except Exception as exc:
                last_err = str(exc)[:200]
            if attempt < retries:
                await asyncio.sleep(2.0)

        if not fetched:
            base.status = "ip_blocked" if blocked else "unavailable"
            base.error = last_err
            return base

        base.transcript_chars = len(video.transcript or "")

        try:
            embedded = await self._transcripts.embed_transcript(video)
            if not embedded:
                base.status = "embed_failed"
                base.error = "embedding_not_created"
                return base
        except Exception as exc:
            base.status = "embed_failed"
            base.error = str(exc)[:200]
            return base

        base.status = "success"
        return base

    @staticmethod
    async def catalog_stats(db: AsyncSession) -> dict:
        """Snapshot counts for verification."""
        total = int(await db.scalar(select(func.count()).select_from(Video)) or 0)
        with_transcript = int(
            await db.scalar(
                select(func.count()).select_from(Video).where(Video.transcript.isnot(None))
            )
            or 0
        )
        with_embed = int(
            await db.scalar(
                select(func.count())
                .select_from(Video)
                .where(Video.transcript_embedding.isnot(None))
            )
            or 0
        )
        return {
            "videos_total": total,
            "with_transcript": with_transcript,
            "with_transcript_embedding": with_embed,
        }
