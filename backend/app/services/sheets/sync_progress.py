"""Progress bridge from SheetsSyncService → sync_runs row."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.sheets.sync_run_service import SyncRunService


class SyncProgressBridge:
    """Updates sync_runs for polling clients."""

    def __init__(self, run_service: SyncRunService, run_id: int) -> None:
        self._svc = run_service
        self._run_id = run_id

    async def stage(
        self,
        stage: str,
        *,
        processed: int = 0,
        total: int | None = None,
        message: str | None = None,
        current_entity_name: str | None = None,
    ) -> None:
        await self._svc.update_progress(
            self._run_id,
            stage=stage,
            processed=processed,
            total=total,
            message=message,
            current_entity_name=current_entity_name,
        )

    async def warning(self, code: str, detail: str) -> None:
        await self._svc.add_warning(self._run_id, code=code, detail=detail)
