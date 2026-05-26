"""Background execution for Sheets sync runs."""

from __future__ import annotations

import logging
import time

from fastapi import BackgroundTasks

from app.db.session import AsyncSessionLocal
from app.services.sheets.sync_progress import SyncProgressBridge
from app.services.sheets.sync_run_service import SyncRunService
from google_sheets.sync_service import SheetsSyncService

logger = logging.getLogger(__name__)


async def execute_sync_run(run_id: int) -> None:
    """Run full sync pipeline in a dedicated DB session (post-response)."""
    started = time.monotonic()
    async with AsyncSessionLocal() as db:
        run_svc = SyncRunService(db)
        try:
            run = await run_svc.get_run(run_id)
            if run is None:
                raise ValueError(f"SyncRun {run_id} not found")
            mode = run.mode if run.mode in ("quick", "full") else "quick"

            await run_svc.mark_running(run_id)
            bridge = SyncProgressBridge(run_svc, run_id)
            sync_svc = SheetsSyncService(db)
            result, summary = await sync_svc.sync(progress=bridge, mode=mode)  # type: ignore[arg-type]

            payload = {
                **result.model_dump(),
                **summary,
            }
            await run_svc.mark_completed(
                run_id,
                result=payload,
                started_monotonic=started,
            )
            logger.info("Sync run %s completed: %s rows", run_id, result.total_rows)
        except Exception as exc:
            logger.exception("Sync run %s failed", run_id)
            await run_svc.mark_failed(
                run_id,
                error_message=str(exc),
                started_monotonic=started,
            )


def schedule_sync_run(background_tasks: BackgroundTasks, run_id: int) -> None:
    background_tasks.add_task(execute_sync_run, run_id)
