"""Browser automation ingestion — local worker + extension queue."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.browser_ingestion import BrowserIngestionWorker
from app.schemas.browser_ingestion import (
    BrowserIngestionDashboard,
    BrowserIngestionHeartbeatRequest,
    BrowserIngestionJobClaimResponse,
    BrowserIngestionJobCompleteRequest,
    BrowserIngestionJobFailRequest,
    BrowserIngestionJobRead,
    BrowserIngestionJobsPage,
    BrowserIngestionRunRead,
    BrowserIngestionStartRequest,
    BrowserIngestionStartResponse,
    BrowserIngestionWorkerRead,
    BrowserIngestionWorkerRegisterRequest,
    BrowserIngestionWorkerRegisterResponse,
)
from app.services.browser_ingestion.service import BrowserIngestionService
from app.services.browser_ingestion.worker_auth import verify_worker_token

router = APIRouter(prefix="/browser-ingestion", tags=["browser-ingestion"])


@router.get("/dashboard", response_model=BrowserIngestionDashboard)
async def get_dashboard(
    run_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionDashboard:
    return await BrowserIngestionService(db).get_dashboard(run_id=run_id)


@router.post("/workers/register", response_model=BrowserIngestionWorkerRegisterResponse)
async def register_worker(
    body: BrowserIngestionWorkerRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionWorkerRegisterResponse:
    return await BrowserIngestionService(db).register_worker(body.name)


@router.post("/workers/heartbeat", response_model=BrowserIngestionWorkerRead)
async def worker_heartbeat(
    body: BrowserIngestionHeartbeatRequest,
    worker: BrowserIngestionWorker = Depends(verify_worker_token),
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionWorkerRead:
    return await BrowserIngestionService(db).heartbeat(worker, body)


@router.post("/workers/reset-cooldown", response_model=BrowserIngestionDashboard)
async def reset_workers_cooldown(
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionDashboard:
    await BrowserIngestionService(db).reset_workers_cooldown()
    return await BrowserIngestionService(db).get_dashboard(run_id=None)


@router.post("/runs/start", response_model=BrowserIngestionStartResponse)
async def start_run(
    body: BrowserIngestionStartRequest,
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionStartResponse:
    svc = BrowserIngestionService(db)
    try:
        run = await svc.start_run(body)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    run_read = await svc.to_run_read(run)
    return BrowserIngestionStartResponse(run=run_read, message=run.message or "Run started")


@router.get("/runs/{run_id}", response_model=BrowserIngestionRunRead)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)) -> BrowserIngestionRunRead:
    svc = BrowserIngestionService(db)
    run = await svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return await svc.to_run_read(run, include_jobs=False)


@router.post("/runs/{run_id}/pause", response_model=BrowserIngestionRunRead)
async def pause_run(run_id: int, db: AsyncSession = Depends(get_db)) -> BrowserIngestionRunRead:
    svc = BrowserIngestionService(db)
    try:
        run = await svc.pause_run(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await svc.to_run_read(run)


@router.post("/runs/{run_id}/resume", response_model=BrowserIngestionRunRead)
async def resume_run(run_id: int, db: AsyncSession = Depends(get_db)) -> BrowserIngestionRunRead:
    svc = BrowserIngestionService(db)
    try:
        run = await svc.resume_run(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await svc.to_run_read(run)


@router.post("/runs/{run_id}/retry-failed", response_model=BrowserIngestionRunRead)
async def retry_failed(run_id: int, db: AsyncSession = Depends(get_db)) -> BrowserIngestionRunRead:
    svc = BrowserIngestionService(db)
    await svc.retry_failed(run_id)
    run = await svc.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return await svc.to_run_read(run)


@router.post("/runs/{run_id}/clear", response_model=BrowserIngestionDashboard)
async def clear_run(run_id: int, db: AsyncSession = Depends(get_db)) -> BrowserIngestionDashboard:
    svc = BrowserIngestionService(db)
    try:
        await svc.clear_run(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return await svc.get_dashboard(run_id=None)


@router.get("/runs/{run_id}/jobs", response_model=BrowserIngestionJobsPage)
async def list_jobs(
    run_id: int,
    status: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionJobsPage:
    return await BrowserIngestionService(db).list_jobs(run_id, status=status, offset=offset, limit=limit)


@router.post("/jobs/claim", response_model=BrowserIngestionJobClaimResponse)
async def claim_job(
    worker: BrowserIngestionWorker = Depends(verify_worker_token),
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionJobClaimResponse:
    return await BrowserIngestionService(db).claim_job(worker)


@router.post("/jobs/{job_id}/complete", response_model=BrowserIngestionJobRead)
async def complete_job(
    job_id: int,
    body: BrowserIngestionJobCompleteRequest,
    worker: BrowserIngestionWorker = Depends(verify_worker_token),
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionJobRead:
    svc = BrowserIngestionService(db)
    try:
        return await svc.complete_job(worker, job_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/jobs/{job_id}/fail", response_model=BrowserIngestionJobRead)
async def fail_job(
    job_id: int,
    body: BrowserIngestionJobFailRequest,
    worker: BrowserIngestionWorker = Depends(verify_worker_token),
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionJobRead:
    svc = BrowserIngestionService(db)
    try:
        return await svc.fail_job(worker, job_id, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
