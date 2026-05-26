"""Maps YouTube video IDs to 1-based Google Sheets row numbers (rebuilt on sync)."""

from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SheetVideoRowIndex(Base):
    """One row per (spreadsheet, video_id, sheet_row) — duplicates allowed."""

    __tablename__ = "sheet_video_row_index"
    __table_args__ = (
        UniqueConstraint(
            "spreadsheet_id",
            "youtube_video_id",
            "sheet_row_number",
            name="uq_sheet_video_row",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spreadsheet_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    youtube_video_id: Mapped[str] = mapped_column(String(11), nullable=False)
    sheet_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
