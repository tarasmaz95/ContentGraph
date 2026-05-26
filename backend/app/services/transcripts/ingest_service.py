"""Save browser-extracted transcripts onto catalog videos (no queues/API)."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.schemas.transcript_ingest import TranscriptIngestRequest, TranscriptIngestResponse
from app.services.ingest.video_match import find_catalog_video
from app.services.transcripts.transcript_service import TranscriptService
from google_sheets.writeback_service import SheetsTranscriptWritebackService


class TranscriptIngestService:
    """Match extension payload to a Video row, save text, optional embedding + Sheets."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._transcripts = TranscriptService(db)

    async def ingest(self, payload: TranscriptIngestRequest) -> TranscriptIngestResponse:
        text = payload.transcript_text.strip()
        chars = len(text)

        video = await find_catalog_video(
            self._db,
            video_url=payload.video_url.strip(),
            title=payload.title.strip(),
            creator=payload.creator.strip(),
        )
        if video is None:
            return TranscriptIngestResponse(
                matched=False,
                transcript_saved=False,
                embedding_created=False,
                transcript_chars=chars,
                message=(
                    "No matching catalog video. Sync your sheet first, or check "
                    "title/creator match the catalog row."
                ),
                sheets_writeback="skipped",
            )

        video.transcript = text
        video.transcript_embedding = None
        await self._db.flush()

        embedded = await self._transcripts.embed_transcript(video)
        await self._db.commit()
        await self._db.refresh(video)

        wb = await SheetsTranscriptWritebackService(self._db).write_after_ingest(video)
        logger.info(
            "transcript_ingest_done video_id=%s sheets_writeback=%s sheets_rows_updated=%s "
            "sheets_message=%r",
            video.id,
            wb.status,
            wb.rows_updated,
            wb.message,
        )

        return TranscriptIngestResponse(
            video_id=video.id,
            matched=True,
            transcript_saved=True,
            embedding_created=embedded,
            transcript_chars=chars,
            message="Transcript saved to catalog video.",
            sheets_rows_updated=wb.rows_updated,
            sheets_writeback=wb.status,
            sheets_message=wb.message or None,
            full_transcript_url=wb.full_transcript_url,
        )
