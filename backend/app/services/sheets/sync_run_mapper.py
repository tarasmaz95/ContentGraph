"""Map SyncRun ORM → API schema."""

from app.models.sync_run import SyncRun
from app.schemas.sync_run import SyncRunRead


def to_sync_run_read(run: SyncRun) -> SyncRunRead:
    return SyncRunRead(
        id=run.id,
        mode=(
            run.mode if getattr(run, "mode", None) in ("quick", "full") else "full"
        ),  # type: ignore[arg-type]
        status=run.status,  # type: ignore[arg-type]
        stage=run.stage,
        processed=run.processed,
        total=run.total,
        message=run.message,
        current_entity_name=run.current_entity_name,
        warning_count=run.warning_count,
        warnings=list(run.warnings_json or []),
        result=run.result_json,
        error_message=run.error_message,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_seconds=run.duration_seconds,
    )
