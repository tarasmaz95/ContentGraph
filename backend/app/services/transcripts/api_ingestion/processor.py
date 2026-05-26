"""Process one API ingestion job — fetch, save, embed, Sheets write-back."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api._errors import IpBlocked, RequestBlocked

from app.models.transcript_api_ingestion import TranscriptApiIngestionJob
from app.models.video import Video
from app.services.transcripts.api_ingestion.missing import video_has_transcript
from app.services.transcripts.transcript_service import TranscriptService
from google_sheets.writeback_service import SheetsTranscriptWritebackService

logger = logging.getLogger(__name__)


class TranscriptApiIngestionProcessor:
    """Fetch transcript via youtube-transcript-api and reuse existing save paths."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._transcripts = TranscriptService(db)

    async def process_job(self, job_id: int, *, fetch_retries: int) -> None:
        job = await self._load_job(job_id)
        if job is None or job.status != "processing":
            return

        video = await self._db.get(Video, job.video_id)
        if video is None:
            await self._finish_job(job, status="failed", error="Video not found")
            return

        if video_has_transcript(video):
            await self._finish_job(
                job,
                status="skipped_existing",
                error="Transcript already present",
                transcript_chars=len(video.transcript or ""),
            )
            logger.info("api_ingest_skip_existing job_id=%s video_id=%s", job.id, video.id)
            return

        yt_id = TranscriptService.extract_video_id(video.video_url or "")
        if not yt_id:
            yt_id = TranscriptService.extract_video_id(video.channel_url or "")
        if not yt_id:
            await self._finish_job(
                job,
                status="failed",
                error="No YouTube video ID in catalog URLs",
            )
            return

        raw, fetch_status, fetch_error = await self._fetch_with_retries(
            yt_id, retries=fetch_retries
        )
        if fetch_status == "ip_blocked":
            await self._finish_job(job, status="failed", error=fetch_error)
            return
        if fetch_status == "unavailable":
            await self._finish_job(job, status="unavailable", error=fetch_error)
            logger.info(
                "api_ingest_unavailable job_id=%s video_id=%s yt_id=%s",
                job.id,
                video.id,
                yt_id,
            )
            return
        if not raw:
            await self._finish_job(job, status="failed", error=fetch_error or "fetch_failed")
            return

        video.transcript = raw
        video.transcript_embedding = None
        await self._db.flush()

        embedded = False
        embed_error: str | None = None
        try:
            embedded = await self._transcripts.embed_transcript(video)
        except Exception as exc:
            embed_error = str(exc)[:500]
            logger.warning(
                "api_ingest_embed_failed job_id=%s video_id=%s error=%s",
                job.id,
                video.id,
                exc,
            )

        await self._db.commit()
        await self._db.refresh(video)

        wb = await SheetsTranscriptWritebackService(self._db).write_after_ingest(video)
        logger.info(
            "api_ingest_done job_id=%s video_id=%s chars=%s embedded=%s "
            "sheets_writeback=%s sheets_rows=%s",
            job.id,
            video.id,
            len(raw),
            embedded,
            wb.status,
            wb.rows_updated,
        )

        error_parts: list[str] = []
        if embed_error:
            error_parts.append(f"embedding: {embed_error}")
        if wb.status == "failed":
            error_parts.append(f"sheets: {wb.message}")

        await self._finish_job(
            job,
            status="success",
            transcript_chars=len(raw),
            embedding_created=embedded,
            sheets_rows_updated=wb.rows_updated,
            sheets_writeback=wb.status,
            error="; ".join(error_parts) if error_parts else None,
        )

    async def _fetch_with_retries(
        self, yt_id: str, *, retries: int
    ) -> tuple[str | None, str, str | None]:
        """
        Returns (text, status, error).

        status: ok | unavailable | ip_blocked | fetch_error
        """
        last_err: str | None = None
        for attempt in range(retries + 1):
            try:
                raw = await asyncio.to_thread(
                    self._transcripts._fetch_transcript_sync, yt_id
                )
                if raw:
                    return raw, "ok", None
                last_err = "transcript_unavailable_on_youtube"
                return None, "unavailable", last_err
            except (RequestBlocked, IpBlocked) as exc:
                return None, "ip_blocked", str(exc)[:500]
            except Exception as exc:
                last_err = str(exc)[:500]
                if attempt < retries:
                    await asyncio.sleep(2.0 * (attempt + 1))
        return None, "fetch_error", last_err

    async def _load_job(self, job_id: int) -> TranscriptApiIngestionJob | None:
        result = await self._db.execute(
            select(TranscriptApiIngestionJob).where(TranscriptApiIngestionJob.id == job_id)
        )
        return result.scalar_one_or_none()

    async def _finish_job(
        self,
        job: TranscriptApiIngestionJob,
        *,
        status: str,
        transcript_chars: int = 0,
        embedding_created: bool = False,
        sheets_rows_updated: int = 0,
        sheets_writeback: str = "skipped",
        error: str | None = None,
    ) -> None:
        job.status = status
        job.transcript_chars = transcript_chars
        job.embedding_created = embedding_created
        job.sheets_rows_updated = sheets_rows_updated
        job.sheets_writeback = sheets_writeback
        job.error_message = error
        job.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
