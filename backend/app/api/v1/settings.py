"""Lightweight settings API — Google Sheets data source only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.settings import DataSourceSettingsRead, DataSourceSettingsUpdate
from app.services.settings import AppSettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/data-source", response_model=DataSourceSettingsRead)
async def get_data_source_settings(
    db: AsyncSession = Depends(get_db),
) -> DataSourceSettingsRead:
    """Return effective Google Sheets source (DB → .env fallback)."""
    service = AppSettingsService(db)
    return await service.get_display()


@router.put("/data-source", response_model=DataSourceSettingsRead)
async def update_data_source_settings(
    payload: DataSourceSettingsUpdate,
    db: AsyncSession = Depends(get_db),
) -> DataSourceSettingsRead:
    """Persist spreadsheet id and range to the global settings row."""
    service = AppSettingsService(db)
    try:
        return await service.upsert(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
