"""API-based transcript ingestion — scalable queue without browser/extension."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.transcript_api_ingestion import (
    TranscriptApiIngestionDashboardStats,
    TranscriptApiIngestionJobsPage,
    TranscriptApiIngestionRunRead,
    TranscriptApiIngestionStartRequest,
    TranscriptApiIngestionStartResponse,
)
from app.services.transcripts.api_ingestion.run_service import TranscriptApiIngestionRunService
from app.services.transcripts.api_ingestion.runner import schedule_api_ingestion_run

router = APIRouter(prefix="/transcripts/api-ingestion", tags=["transcript-api-ingestion"])


@router.get("/stats", response_model=TranscriptApiIngestionDashboardStats)
async def get_ingestion_stats(
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionDashboardStats:
    """Catalog coverage only (not merged with run job counts)."""
    return await TranscriptApiIngestionRunService(db).dashboard_stats()


@router.get("/runs/active", response_model=TranscriptApiIngestionRunRead | None)
async def get_active_run(db: AsyncSession = Depends(get_db)) -> TranscriptApiIngestionRunRead | None:
    svc = TranscriptApiIngestionRunService(db)
    run = await svc.get_active_run()
    if run is None:
        return None
    return await svc.to_run_read(run, include_jobs=False)


@router.get("/runs/{run_id}", response_model=TranscriptApiIngestionRunRead)
async def get_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionRunRead:
    svc = TranscriptApiIngestionRunService(db)
    run = await svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return await svc.to_run_read(run, include_jobs=False)


@router.get("/runs/{run_id}/jobs", response_model=TranscriptApiIngestionJobsPage)
async def list_run_jobs(
    run_id: int,
    status: str | None = Query(default=None, description="Filter by job status or 'all'"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionJobsPage:
    svc = TranscriptApiIngestionRunService(db)
    run = await svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return await svc.list_jobs(run_id, status=status, offset=offset, limit=limit)


@router.post("/runs/start", response_model=TranscriptApiIngestionStartResponse)
async def start_run(
    body: TranscriptApiIngestionStartRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionStartResponse:
    """Enqueue videos missing transcripts and start background workers."""
    svc = TranscriptApiIngestionRunService(db)
    try:
        run = await svc.start_run(body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    schedule_api_ingestion_run(background_tasks, run.id)
    run_read = await svc.to_run_read(run, include_jobs=False)
    return TranscriptApiIngestionStartResponse(
        run=run_read,
        message=run.message or "Ingestion started",
    )


@router.post("/runs/{run_id}/pause", response_model=TranscriptApiIngestionRunRead)
async def pause_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionRunRead:
    svc = TranscriptApiIngestionRunService(db)
    try:
        run = await svc.pause_run(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await svc.to_run_read(run, include_jobs=False)


@router.post("/runs/{run_id}/resume", response_model=TranscriptApiIngestionRunRead)
async def resume_run(
    run_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionRunRead:
    svc = TranscriptApiIngestionRunService(db)
    try:
        run = await svc.resume_run(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    schedule_api_ingestion_run(background_tasks, run.id)
    return await svc.to_run_read(run, include_jobs=False)


@router.post("/runs/{run_id}/retry-failed", response_model=TranscriptApiIngestionRunRead)
async def retry_failed(
    run_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TranscriptApiIngestionRunRead:
    svc = TranscriptApiIngestionRunService(db)
    try:
        count = await svc.retry_failed(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if count > 0:
        schedule_api_ingestion_run(background_tasks, run_id)
    run = await svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return await svc.to_run_read(run, include_jobs=False)
