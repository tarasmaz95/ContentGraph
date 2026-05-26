"""Best-effort Google Sheets Comments column write-back after extension ingest."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.video import Video
from app.services.settings import AppSettingsService
from app.services.transcripts.transcript_service import TranscriptService
from google_sheets.a1 import cell_a1
from google_sheets.client import GoogleSheetsClient
from google_sheets.comments_format import format_comments_for_sheet
from google_sheets.row_index import get_sheet_rows_for_video
from google_sheets.writeback_service import SheetsWritebackResult

logger = logging.getLogger(__name__)


class SheetsCommentsWritebackService:
    """Update Comments column on matching sheet rows (same index as transcripts)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._settings = get_settings()

    async def write_after_ingest(
        self,
        video: Video,
        comments: list[dict[str, object]],
    ) -> SheetsWritebackResult:
        """Best-effort — never raises to caller."""
        logger.info(
            "sheets_comments_writeback_start video_id=%s comment_count=%s",
            video.id,
            len(comments),
        )

        if not self._settings.sheets_writeback_enabled:
            return SheetsWritebackResult(
                status="skipped",
                message="Sheets write-back disabled",
            )

        cell_text, _ = format_comments_for_sheet(comments)
        if not cell_text:
            return SheetsWritebackResult(
                status="skipped",
                message="No comments text to write",
            )

        try:
            config = await AppSettingsService(self._db).resolve_sheets()
        except ValueError as exc:
            return SheetsWritebackResult(
                status="skipped",
                message=str(exc),
            )

        yt_id = TranscriptService.extract_video_id(video.video_url or "")
        if not yt_id or len(yt_id) != 11:
            yt_id = TranscriptService.extract_video_id(video.channel_url or "")
        if not yt_id or len(yt_id) != 11:
            logger.info(
                "sheets_comments_writeback_stop video_id=%s reason=no_youtube_id",
                video.id,
            )
            return SheetsWritebackResult(
                status="no_rows",
                message="No YouTube video ID for sheet lookup",
            )

        row_numbers = await get_sheet_rows_for_video(
            self._db, config.spreadsheet_id, yt_id
        )
        logger.info(
            "sheets_comments_writeback_index video_id=%s yt_id=%s row_numbers=%s",
            video.id,
            yt_id,
            row_numbers,
        )
        if not row_numbers:
            logger.warning(
                "sheets_comments_writeback_stop video_id=%s yt_id=%s reason=empty_row_index",
                video.id,
                yt_id,
            )
            return SheetsWritebackResult(
                status="no_rows",
                message=f"No sheet rows indexed for video {yt_id}",
            )

        try:
            mapping = await AppSettingsService(self._db).resolve_column_mapping()
            client = GoogleSheetsClient(
                spreadsheet_id=config.spreadsheet_id,
                sheets_range=config.range,
                column_mapping=mapping,
            )
            col_map = client.get_column_index_map()
            comments_idx = col_map.get("comments")
            if comments_idx is None:
                logger.warning(
                    "sheets_comments_writeback_stop video_id=%s reason=comments_column_not_mapped",
                    video.id,
                )
                return SheetsWritebackResult(
                    status="failed",
                    message='Comments column not mapped in sheet (map "Comments" in Settings)',
                )

            sheet_name = client._sheet_name_from_range()  # noqa: SLF001
            if not sheet_name:
                raise ValueError("Sheet name missing from range")

            batch_data: list[dict[str, object]] = []
            for row_num in row_numbers:
                batch_data.append(
                    {
                        "range": cell_a1(sheet_name, comments_idx, row_num),
                        "values": [[cell_text]],
                    }
                )

            sample_ranges = [str(d["range"]) for d in batch_data[:3]]
            logger.info(
                "sheets_comments_writeback_batch video_id=%s rows=%s text_len=%s ranges=%s",
                video.id,
                len(row_numbers),
                len(cell_text),
                sample_ranges,
            )

            client.batch_update_values(batch_data)

            logger.info(
                "sheets_comments_writeback_ok video_id=%s yt_id=%s sheets_rows_updated=%s",
                video.id,
                yt_id,
                len(row_numbers),
            )
            return SheetsWritebackResult(
                rows_updated=len(row_numbers),
                status="ok",
                message=f"Updated {len(row_numbers)} sheet row(s)",
            )
        except Exception as exc:
            logger.warning(
                "sheets_comments_writeback_failed video_id=%s error=%s",
                video.id,
                exc,
                exc_info=True,
            )
            return SheetsWritebackResult(
                status="failed",
                message=str(exc)[:500],
            )
