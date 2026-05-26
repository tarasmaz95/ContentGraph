"""Global app settings — Google Sheets + OpenAI model (DB first, .env fallback)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.google_credentials import get_service_account_email
from app.models.app_settings import GLOBAL_SETTINGS_ID, AppSettings
from google_sheets.sheet_range import parse_sheet_from_range, spreadsheet_edit_url

from app.schemas.settings import (
    ALLOWED_OPENAI_MODELS,
    DEFAULT_OPENAI_MODEL,
    DataSourceSettingsRead,
    DataSourceSettingsUpdate,
    SettingsSource,
)


@dataclass(frozen=True)
class DataSourceConfig:
    """Resolved spreadsheet id + range used by sync."""

    spreadsheet_id: str
    range: str


class AppSettingsService:
    """Single global row in app_settings; empty DB fields fall back to .env."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_display(self) -> DataSourceSettingsRead:
        """Values shown in Settings UI (effective config)."""
        sheets, sheet_source = await self._resolve_sheets_with_source()
        model, model_source = await self._resolve_model_with_source()
        col_map = await self._resolve_column_map()
        sheet_id = sheets.spreadsheet_id
        return DataSourceSettingsRead(
            spreadsheet_id=sheet_id,
            range=sheets.range,
            sheet_url=spreadsheet_edit_url(sheet_id) if sheet_id else "",
            sheet_tab=parse_sheet_from_range(sheets.range) if sheets.range else None,
            column_mapping=col_map,
            openai_model=model,
            service_account_email=get_service_account_email(),
            source=sheet_source,
            model_source=model_source,
        )

    async def resolve_sheets(self) -> DataSourceConfig:
        """Config used by Google Sheets sync."""
        sheets, _ = await self._resolve_sheets_with_source()
        if not sheets.spreadsheet_id:
            raise ValueError(
                "Google Sheets spreadsheet ID is not configured. "
                "Set it in Settings or GOOGLE_SHEETS_SPREADSHEET_ID in .env."
            )
        if not sheets.range:
            raise ValueError(
                "Google Sheets range is not configured. "
                "Set it in Settings or GOOGLE_SHEETS_RANGE in .env."
            )
        return sheets

    async def resolve_openai_model(self) -> str:
        """Chat model used by LangChain OpenAI integrations."""
        model, _ = await self._resolve_model_with_source()
        if model not in ALLOWED_OPENAI_MODELS:
            return DEFAULT_OPENAI_MODEL
        return model

    async def upsert(self, payload: DataSourceSettingsUpdate) -> DataSourceSettingsRead:
        """Persist settings to the global row."""
        row = await self._get_row()
        if row is None:
            row = AppSettings(id=GLOBAL_SETTINGS_ID)
            self._db.add(row)

        row.google_sheets_spreadsheet_id = payload.spreadsheet_id
        row.google_sheets_range = payload.range
        row.google_sheets_column_map = payload.column_mapping or None
        row.openai_model = payload.openai_model
        row.updated_at = datetime.now(UTC)
        await self._db.commit()
        await self._db.refresh(row)
        return await self.get_display()

    async def _resolve_sheets_with_source(self) -> tuple[DataSourceConfig, SettingsSource]:
        env = get_settings()
        row = await self._get_row()

        db_id = (row.google_sheets_spreadsheet_id or "").strip() if row else ""
        db_range = (row.google_sheets_range or "").strip() if row else ""
        env_id = env.google_sheets_spreadsheet_id.strip()
        env_range = env.google_sheets_range.strip()

        spreadsheet_id = db_id or env_id
        sheets_range = db_range or env_range

        if db_id and db_range:
            source: SettingsSource = "database"
        elif db_id or db_range:
            source = "database+env"
        else:
            source = "env"

        return (
            DataSourceConfig(spreadsheet_id=spreadsheet_id, range=sheets_range),
            source,
        )

    async def _resolve_model_with_source(self) -> tuple[str, SettingsSource]:
        env = get_settings()
        row = await self._get_row()

        db_model = (row.openai_model or "").strip() if row else ""
        env_model = env.openai_model.strip() or DEFAULT_OPENAI_MODEL

        if db_model:
            return db_model, "database"
        return env_model, "env"

    async def resolve_column_mapping(self) -> dict[str, str] | None:
        """Optional header overrides for sync."""
        col = await self._resolve_column_map()
        return col or None

    async def _resolve_column_map(self) -> dict[str, str]:
        row = await self._get_row()
        raw = row.google_sheets_column_map if row else None
        if isinstance(raw, dict) and raw:
            return {str(k): str(v) for k, v in raw.items()}
        return {}

    async def _get_row(self) -> AppSettings | None:
        result = await self._db.execute(
            select(AppSettings).where(AppSettings.id == GLOBAL_SETTINGS_ID)
        )
        return result.scalar_one_or_none()


# Backward-compatible alias used by sheets sync
DataSourceSettingsService = AppSettingsService
