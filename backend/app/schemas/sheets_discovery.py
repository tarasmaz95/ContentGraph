"""Schemas for Sheets connection UX (inspect URL, tabs, preview)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ParseSheetsUrlRequest(BaseModel):
    url: str = Field(min_length=8, max_length=512)


class ParseSheetsUrlResponse(BaseModel):
    spreadsheet_id: str
    spreadsheet_url: str
    tabs: list[str]


class SheetPreviewResponse(BaseModel):
    sheet_name: str
    headers: list[str]
    preview_rows: list[list[str]]
    column_mapping: dict[str, str]
    missing_required: list[str]
    suggested_range: str
