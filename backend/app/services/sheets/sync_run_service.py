"""CRUD and progress updates for sync_runs."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync_run import SyncRun

ACTIVE_STATUSES = ("queued", "running")


class SyncRunService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_active_run(self) -> SyncRun | None:
        result = await self._db.execute(
            select(SyncRun)
            .where(SyncRun.status.in_(ACTIVE_STATUSES))
            .order_by(SyncRun.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_queued(self, *, mode: str = "quick") -> SyncRun:
        run = SyncRun(
            status="queued",
            stage="queued",
            mode=mode,
            processed=0,
            total=None,
        )
        self._db.add(run)
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def mark_running(self, run_id: int) -> None:
        run = await self._get(run_id)
        run.status = "running"
        run.stage = "reading_sheet"
        run.processed = 0
        run.total = None
        run.message = None
        await self._db.commit()

    async def update_progress(
        self,
        run_id: int,
        *,
        stage: str,
        processed: int = 0,
        total: int | None = None,
        message: str | None = None,
        current_entity_name: str | None = None,
    ) -> None:
        run = await self._get(run_id)
        run.stage = stage
        run.processed = processed
        if total is not None:
            run.total = total
        run.message = message
        run.current_entity_name = (
            (current_entity_name[:255] if current_entity_name else None)
        )
        await self._db.commit()

    async def add_warning(
        self,
        run_id: int,
        *,
        code: str,
        detail: str,
    ) -> None:
        run = await self._get(run_id)
        warnings: list[dict[str, str]] = list(run.warnings_json or [])
        warnings.append({"code": code, "detail": detail[:500]})
        run.warnings_json = warnings
        run.warning_count = len(warnings)
        await self._db.commit()

    async def mark_completed(
        self,
        run_id: int,
        *,
        result: dict[str, Any],
        started_monotonic: float,
    ) -> None:
        run = await self._get(run_id)
        finished = datetime.now(timezone.utc)
        run.status = "completed"
        run.stage = "finalizing"
        run.result_json = result
        run.finished_at = finished
        run.duration_seconds = max(1, int(time.monotonic() - started_monotonic))
        run.message = None
        run.current_entity_name = None
        await self._db.commit()

    async def mark_failed(
        self,
        run_id: int,
        *,
        error_message: str,
        started_monotonic: float,
        partial_result: dict[str, Any] | None = None,
    ) -> None:
        run = await self._get(run_id)
        run.status = "failed"
        run.error_message = error_message[:4000]
        run.finished_at = datetime.now(timezone.utc)
        run.duration_seconds = max(1, int(time.monotonic() - started_monotonic))
        if partial_result:
            run.result_json = partial_result
        await self._db.commit()

    async def get_run(self, run_id: int) -> SyncRun | None:
        return await self._db.get(SyncRun, run_id)

    async def get_last_completed(self) -> SyncRun | None:
        result = await self._db.execute(
            select(SyncRun)
            .where(SyncRun.status == "completed")
            .order_by(SyncRun.finished_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _get(self, run_id: int) -> SyncRun:
        run = await self._db.get(SyncRun, run_id)
        if run is None:
            raise ValueError(f"SyncRun {run_id} not found")
        return run
