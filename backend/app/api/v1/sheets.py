"""Google Sheets sync endpoint."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from googleapiclient.errors import HttpError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video

from app.core.google_credentials import get_service_account_email
from app.db.session import get_db
from app.schemas.sheets_discovery import (
    ParseSheetsUrlRequest,
    ParseSheetsUrlResponse,
    SheetPreviewResponse,
)
from app.schemas.sync_run import (
    LastSyncStatus,
    SyncRunRead,
    SyncRunStartResponse,
    SyncStartRequest,
)
from app.services.sheets.sync_run_mapper import to_sync_run_read
from app.services.sheets.sync_run_service import SyncRunService
from app.services.sheets.sync_runner import schedule_sync_run
from google_sheets.discovery import SheetsDiscoveryError, SheetsDiscoveryService

router = APIRouter(prefix="/sheets", tags=["sheets"])


def _discovery_http(exc: SheetsDiscoveryError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/parse-url", response_model=ParseSheetsUrlResponse)
async def parse_sheets_url(body: ParseSheetsUrlRequest) -> ParseSheetsUrlResponse:
    """Extract spreadsheet ID and list tabs from a Google Sheets URL."""
    try:
        data = SheetsDiscoveryService().inspect_url(body.url)
        return ParseSheetsUrlResponse(**data)
    except SheetsDiscoveryError as exc:
        raise _discovery_http(exc) from exc
    except HttpError as exc:
        if exc.resp.status == 403:
            email = get_service_account_email()
            raise HTTPException(
                status_code=403,
                detail=(
                    f"We can't access this spreadsheet. Share it with {email} "
                    f"(Editor or Viewer) in Google Sheets → Share."
                ),
            ) from exc
        raise


@router.get("/{spreadsheet_id}/tabs", response_model=list[str])
async def list_sheet_tabs(spreadsheet_id: str) -> list[str]:
    try:
        return SheetsDiscoveryService().list_tabs(spreadsheet_id)
    except SheetsDiscoveryError as exc:
        raise _discovery_http(exc) from exc
    except HttpError as exc:
        if exc.resp.status == 403:
            email = get_service_account_email()
            raise HTTPException(status_code=403, detail=f"Share the spreadsheet with {email}.") from exc
        raise


@router.get("/{spreadsheet_id}/preview", response_model=SheetPreviewResponse)
async def preview_sheet_tab(
    spreadsheet_id: str,
    sheet_name: str,
) -> SheetPreviewResponse:
    try:
        data = SheetsDiscoveryService().preview_tab(spreadsheet_id, sheet_name)
        return SheetPreviewResponse(**data)
    except SheetsDiscoveryError as exc:
        raise _discovery_http(exc) from exc
    except HttpError as exc:
        if exc.resp.status == 403:
            email = get_service_account_email()
            raise HTTPException(status_code=403, detail=f"Share the spreadsheet with {email}.") from exc
        raise


@router.post("/sync", response_model=SyncRunStartResponse, status_code=202)
async def start_sheets_sync(
    background_tasks: BackgroundTasks,
    body: SyncStartRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> SyncRunStartResponse:
    """
    Start a background Sheets sync. Poll GET /sheets/sync/runs/{id} for progress.

    mode=quick: catalog + title patterns (fast).
    mode=full: includes transcripts, comments, deep enrichment.
    """
    mode = (body.mode if body else "quick")
    if mode not in ("quick", "full"):
        raise HTTPException(status_code=400, detail="mode must be 'quick' or 'full'")

    run_svc = SyncRunService(db)
    active = await run_svc.get_active_run()
    if active is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A sync is already running (run_id={active.id}). Wait for it to finish.",
        )

    run = await run_svc.create_queued(mode=mode)
    schedule_sync_run(background_tasks, run.id)
    return SyncRunStartResponse(run_id=run.id, status="queued", mode=mode)


@router.get("/sync/runs/last", response_model=LastSyncStatus | None)
async def get_last_sheets_sync(
    db: AsyncSession = Depends(get_db),
) -> LastSyncStatus | None:
    """Latest completed sync for dashboard/settings badges."""
    run_svc = SyncRunService(db)
    run = await run_svc.get_last_completed()
    if run is None or run.finished_at is None:
        return None
    result = run.result_json or {}
    catalog_video_count = int(result.get("catalog_video_count") or 0)
    if catalog_video_count <= 0:
        catalog_video_count = int(
            await db.scalar(select(func.count()).select_from(Video)) or 0
        )
    return LastSyncStatus(
        run_id=run.id,
        mode=run.mode if run.mode in ("quick", "full") else "full",  # type: ignore[arg-type]
        finished_at=run.finished_at,
        duration_seconds=run.duration_seconds,
        catalog_video_count=catalog_video_count,
        sheet_rows=int(result.get("sheet_rows") or result.get("total_rows") or 0),
        warning_count=run.warning_count,
    )


@router.get("/sync/runs/active", response_model=SyncRunRead | None)
async def get_active_sheets_sync(
    db: AsyncSession = Depends(get_db),
) -> SyncRunRead | None:
    """Return the current queued/running sync, if any (for page reload recovery)."""
    run_svc = SyncRunService(db)
    active = await run_svc.get_active_run()
    if active is None:
        return None
    return to_sync_run_read(active)


@router.get("/sync/runs/{run_id}", response_model=SyncRunRead)
async def get_sheets_sync_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> SyncRunRead:
    """Poll sync progress and final result."""
    run_svc = SyncRunService(db)
    run = await run_svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Sync run not found")
    return to_sync_run_read(run)
