"""Background worker pool for API transcript ingestion."""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import BackgroundTasks

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.transcript_api_ingestion import TranscriptApiIngestionJob
from app.services.transcripts.api_ingestion.processor import TranscriptApiIngestionProcessor
from app.services.transcripts.api_ingestion.run_service import TranscriptApiIngestionRunService

logger = logging.getLogger(__name__)


async def execute_api_ingestion_run(run_id: int) -> None:
    """Process queued jobs with a bounded worker pool (post-response)."""
    started = time.monotonic()
    settings = get_settings()

    async with AsyncSessionLocal() as db:
        run_svc = TranscriptApiIngestionRunService(db)
        run = await run_svc.get_run(run_id)
        if run is None:
            logger.error("api_ingest_run_missing run_id=%s", run_id)
            return
        if run.status == "paused":
            logger.info("api_ingest_run_skip_paused run_id=%s", run_id)
            return
        worker_count = run.worker_count or settings.transcript_api_ingestion_workers
        fetch_retries = settings.transcript_api_ingestion_fetch_retries
        jobs_total = run.jobs_total
        if run.status == "queued":
            await run_svc.mark_running(run_id)

    logger.info(
        "api_ingest_run_started run_id=%s workers=%s jobs_total=%s",
        run_id,
        worker_count,
        jobs_total,
    )

    sem = asyncio.Semaphore(worker_count)

    async def worker_loop() -> None:
        while True:
            async with AsyncSessionLocal() as db:
                svc = TranscriptApiIngestionRunService(db)
                if await svc.is_paused(run_id):
                    await asyncio.sleep(1.5)
                    continue
                job = await svc.claim_next_job(run_id)
            if job is None:
                return
            async with sem:
                async with AsyncSessionLocal() as db:
                    processor = TranscriptApiIngestionProcessor(db)
                    try:
                        await processor.process_job(
                            job.id, fetch_retries=fetch_retries
                        )
                    except Exception as exc:
                        logger.exception(
                            "api_ingest_job_error run_id=%s job_id=%s",
                            run_id,
                            job.id,
                        )
                        job_row = await db.get(TranscriptApiIngestionJob, job.id)
                        if job_row and job_row.status == "processing":
                            job_row.status = "failed"
                            job_row.error_message = str(exc)[:500]
                            await db.commit()

    try:
        workers = [asyncio.create_task(worker_loop()) for _ in range(worker_count)]
        await asyncio.gather(*workers)

        async with AsyncSessionLocal() as db:
            svc = TranscriptApiIngestionRunService(db)
            pending = await svc.pending_count(run_id)
            run = await svc.get_run(run_id)
            if run and run.status == "paused":
                logger.info("api_ingest_run_paused run_id=%s pending=%s", run_id, pending)
                return
            if pending > 0:
                await asyncio.sleep(2.0)
                pending = await svc.pending_count(run_id)
            await svc.mark_completed(run_id, started_monotonic=started)
            logger.info("api_ingest_run_completed run_id=%s", run_id)
    except Exception as exc:
        logger.exception("api_ingest_run_failed run_id=%s", run_id)
        async with AsyncSessionLocal() as db:
            svc = TranscriptApiIngestionRunService(db)
            await svc.mark_completed(
                run_id, started_monotonic=started, error_message=str(exc)[:2000]
            )


def schedule_api_ingestion_run(background_tasks: BackgroundTasks, run_id: int) -> None:
    background_tasks.add_task(execute_api_ingestion_run, run_id)
