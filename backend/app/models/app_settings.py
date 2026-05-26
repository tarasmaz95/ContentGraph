"""Global app settings — single row for internal configuration."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Singleton row id for global config (no multi-tenant)
GLOBAL_SETTINGS_ID = 1


class AppSettings(Base):
    """
    One global settings row.

    Google Sheets + OpenAI model override .env when DB fields are set.
    """

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_sheets_spreadsheet_id: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )
    google_sheets_range: Mapped[str | None] = mapped_column(String(128), nullable=True)
    google_sheets_column_map: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    openai_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
