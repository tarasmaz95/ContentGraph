"""Rebuild and query sheet row index (video_id → sheet rows)."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sheet_video_row_index import SheetVideoRowIndex
from app.services.transcripts.transcript_service import TranscriptService
from google_sheets.client import SheetRow


def sheet_row_number_for_data_index(data_index: int, *, header_row: int = 1) -> int:
    """Data row 0 → sheet row 2 when header is row 1."""
    return data_index + header_row + 1


async def rebuild_sheet_row_index(
    db: AsyncSession,
    spreadsheet_id: str,
    sheet_rows: list[SheetRow],
) -> int:
    """
    Rebuild index from synced sheet rows.

    Uses Video URL column only (11-char YouTube ID).
    """
    await db.execute(
        delete(SheetVideoRowIndex).where(
            SheetVideoRowIndex.spreadsheet_id == spreadsheet_id
        )
    )

    count = 0
    for idx, row in enumerate(sheet_rows):
        yt_id = TranscriptService.extract_video_id(row.get("video_url") or "")
        if not yt_id or len(yt_id) != 11:
            continue
        db.add(
            SheetVideoRowIndex(
                spreadsheet_id=spreadsheet_id,
                youtube_video_id=yt_id,
                sheet_row_number=sheet_row_number_for_data_index(idx),
            )
        )
        count += 1

    await db.commit()
    return count


async def get_sheet_rows_for_video(
    db: AsyncSession,
    spreadsheet_id: str,
    youtube_video_id: str,
) -> list[int]:
    """All 1-based sheet row numbers for a video ID (includes duplicate URLs)."""
    if len(youtube_video_id) != 11:
        return []
    result = await db.execute(
        select(SheetVideoRowIndex.sheet_row_number)
        .where(
            SheetVideoRowIndex.spreadsheet_id == spreadsheet_id,
            SheetVideoRowIndex.youtube_video_id == youtube_video_id,
        )
        .order_by(SheetVideoRowIndex.sheet_row_number.asc())
    )
    return list(result.scalars().all())
