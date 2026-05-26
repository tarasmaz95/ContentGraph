"""Best-effort Google Sheets transcript preview + full transcript URL write-back."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.video import Video
from app.services.settings import AppSettingsService
from app.services.transcripts.transcript_service import TranscriptService
from google_sheets.a1 import cell_a1
from google_sheets.client import GoogleSheetsClient
from google_sheets.column_detect import FULL_TRANSCRIPT_HEADER
from google_sheets.row_index import get_sheet_rows_for_video
from google_sheets.transcript_preview import build_transcript_preview

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SheetsWritebackResult:
    rows_updated: int = 0
    status: str = "skipped"  # ok | failed | skipped | no_rows
    message: str = ""
    full_transcript_url: str | None = None


class SheetsTranscriptWritebackService:
    """Update Transcript preview + Full Transcript URL cells after extension ingest."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._settings = get_settings()

    def _public_transcript_url(self, video_id: int) -> str:
        base = self._settings.tm1_public_url.rstrip("/")
        return f"{base}/transcripts/{video_id}"

    async def write_after_ingest(self, video: Video) -> SheetsWritebackResult:
        """Best-effort — never raises to caller."""
        transcript_url = self._public_transcript_url(video.id)
        logger.info(
            "sheets_writeback_start video_id=%s video_url=%r",
            video.id,
            (video.video_url or "")[:80],
        )

        if not self._settings.sheets_writeback_enabled:
            logger.info("sheets_writeback_skip video_id=%s reason=feature_disabled", video.id)
            return SheetsWritebackResult(
                status="skipped",
                message="Sheets write-back disabled",
                full_transcript_url=transcript_url,
            )

        text = (video.transcript or "").strip()
        if not text:
            logger.info("sheets_writeback_skip video_id=%s reason=no_transcript_text", video.id)
            return SheetsWritebackResult(
                status="skipped",
                message="No transcript text",
                full_transcript_url=transcript_url,
            )

        try:
            config = await AppSettingsService(self._db).resolve_sheets()
        except ValueError as exc:
            logger.info(
                "sheets_writeback_skip video_id=%s reason=config_error detail=%s",
                video.id,
                exc,
            )
            return SheetsWritebackResult(
                status="skipped",
                message=str(exc),
                full_transcript_url=transcript_url,
            )

        yt_id = TranscriptService.extract_video_id(video.video_url or "")
        if not yt_id or len(yt_id) != 11:
            yt_id = TranscriptService.extract_video_id(video.channel_url or "")
        logger.info(
            "sheets_writeback_lookup video_id=%s yt_id=%s spreadsheet_id=%s range=%s",
            video.id,
            yt_id,
            config.spreadsheet_id[:20] + "…" if len(config.spreadsheet_id) > 20 else config.spreadsheet_id,
            config.range,
        )
        if not yt_id or len(yt_id) != 11:
            logger.info(
                "sheets_writeback_stop video_id=%s reason=no_youtube_id_in_db_urls",
                video.id,
            )
            return SheetsWritebackResult(
                status="no_rows",
                message="No YouTube video ID for sheet lookup",
                full_transcript_url=transcript_url,
            )

        row_numbers = await get_sheet_rows_for_video(
            self._db, config.spreadsheet_id, yt_id
        )
        logger.info(
            "sheets_writeback_index video_id=%s yt_id=%s row_numbers=%s",
            video.id,
            yt_id,
            row_numbers,
        )
        if not row_numbers:
            logger.warning(
                "sheets_writeback_stop video_id=%s yt_id=%s reason=empty_row_index "
                "(run Quick Sync to rebuild sheet_video_row_index)",
                video.id,
                yt_id,
            )
            return SheetsWritebackResult(
                status="no_rows",
                message=f"No sheet rows indexed for video {yt_id}",
                full_transcript_url=transcript_url,
            )

        try:
            mapping = await AppSettingsService(self._db).resolve_column_mapping()
            client = GoogleSheetsClient(
                spreadsheet_id=config.spreadsheet_id,
                sheets_range=config.range,
                column_mapping=mapping,
            )
            col_map = client.get_column_index_map()
            logger.info(
                "sheets_writeback_columns video_id=%s col_map=%s",
                video.id,
                {k: col_map[k] for k in ("transcript", "video_url", "title") if k in col_map},
            )
            transcript_idx = col_map.get("transcript")
            if transcript_idx is None:
                logger.warning(
                    "sheets_writeback_stop video_id=%s reason=transcript_column_not_mapped",
                    video.id,
                )
                return SheetsWritebackResult(
                    status="failed",
                    message="Transcript column not mapped in sheet",
                    full_transcript_url=transcript_url,
                )

            full_idx = client.ensure_full_transcript_column(
                transcript_col_index=transcript_idx,
                full_header=FULL_TRANSCRIPT_HEADER,
            )

            sheet_name = client._sheet_name_from_range()  # noqa: SLF001
            if not sheet_name:
                raise ValueError("Sheet name missing from range")

            preview, truncated = build_transcript_preview(text)
            batch_data: list[dict[str, object]] = []
            for row_num in row_numbers:
                batch_data.append(
                    {
                        "range": cell_a1(sheet_name, transcript_idx, row_num),
                        "values": [[preview]],
                    }
                )
                batch_data.append(
                    {
                        "range": cell_a1(sheet_name, full_idx, row_num),
                        "values": [[transcript_url]],
                    }
                )

            sample_ranges = [str(d["range"]) for d in batch_data[:4]]
            logger.info(
                "sheets_writeback_batch video_id=%s rows=%s preview_len=%s truncated=%s "
                "ranges_sample=%s",
                video.id,
                len(row_numbers),
                len(preview),
                truncated,
                sample_ranges,
            )

            client.batch_update_values(batch_data)

            logger.info(
                "sheets_writeback_ok video_id=%s yt_id=%s sheets_rows_updated=%s url=%s",
                video.id,
                yt_id,
                len(row_numbers),
                transcript_url,
            )
            return SheetsWritebackResult(
                rows_updated=len(row_numbers),
                status="ok",
                message=f"Updated {len(row_numbers)} sheet row(s)",
                full_transcript_url=transcript_url,
            )
        except Exception as exc:
            logger.warning(
                "sheets_writeback_failed video_id=%s yt_id=%s error=%s",
                video.id,
                yt_id,
                exc,
                exc_info=True,
            )
            return SheetsWritebackResult(
                status="failed",
                message=str(exc)[:500],
                full_transcript_url=transcript_url,
            )
