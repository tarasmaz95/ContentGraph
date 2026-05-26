"""Settings API schemas — Google Sheets + OpenAI model (internal tool)."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Titles!A:F or 'My Tab'!A:Z
SHEETS_RANGE_PATTERN = re.compile(
    r"^(?:'(?:[^']|'')*'|[^!']+)![A-Za-z]+\d*:[A-Za-z]+\d*$",
)

DEFAULT_OPENAI_MODEL = "gpt-5.4"

# Static allowlist — matches internal model selector (no dynamic discovery)
ALLOWED_OPENAI_MODELS: tuple[str, ...] = (
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.3-instant",
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
)

SettingsSource = Literal["database", "env", "database+env"]


class DataSourceSettingsRead(BaseModel):
    """Effective app settings (DB with .env fallback)."""

    spreadsheet_id: str
    range: str
    sheet_url: str = ""
    sheet_tab: str | None = None
    column_mapping: dict[str, str] = Field(default_factory=dict)
    openai_model: str
    service_account_email: str = Field(
        description="Add this email in Google Sheets → Share for sync to work",
    )
    source: SettingsSource = Field(description="Google Sheets config source")
    model_source: SettingsSource = Field(description="OpenAI model config source")


class DataSourceSettingsUpdate(BaseModel):
    """Payload for PUT /settings/data-source."""

    spreadsheet_id: str = Field(min_length=1, max_length=128)
    range: str = Field(min_length=1, max_length=128)
    column_mapping: dict[str, str] | None = None
    openai_model: str = Field(min_length=1, max_length=64)

    @field_validator("spreadsheet_id")
    @classmethod
    def strip_spreadsheet_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Spreadsheet ID is required")
        return trimmed

    @field_validator("range")
    @classmethod
    def validate_range(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Range is required")
        if not SHEETS_RANGE_PATTERN.match(trimmed):
            raise ValueError(
                "Range must look like Titles!A:Z (tab name and column span)"
            )
        return trimmed

    @field_validator("column_mapping")
    @classmethod
    def normalize_column_mapping(
        cls, value: dict[str, str] | None,
    ) -> dict[str, str] | None:
        if not value:
            return None
        return {k: v.strip() for k, v in value.items() if v and str(v).strip()}

    @field_validator("openai_model")
    @classmethod
    def validate_openai_model(cls, value: str) -> str:
        trimmed = value.strip()
        if trimmed not in ALLOWED_OPENAI_MODELS:
            allowed = ", ".join(ALLOWED_OPENAI_MODELS)
            raise ValueError(f"Model must be one of: {allowed}")
        return trimmed
