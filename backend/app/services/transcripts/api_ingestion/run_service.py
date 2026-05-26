"""CRUD and queue operations for API transcript ingestion runs."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.transcript_api_ingestion import (
    TranscriptApiIngestionJob,
    TranscriptApiIngestionRun,
)
from app.models.video import Video
from app.schemas.transcript_api_ingestion import (
    CatalogCoverageStats,
    RunJobStats,
    TranscriptApiIngestionDashboardStats,
    TranscriptApiIngestionJobRead,
    TranscriptApiIngestionJobsPage,
    TranscriptApiIngestionRunRead,
    TranscriptApiIngestionStartRequest,
)
from app.services.transcripts.api_ingestion.missing import missing_transcript_clause

ACTIVE_RUN_STATUSES = ("queued", "running", "paused")
TERMINAL_JOB_STATUSES = ("success", "failed", "unavailable", "skipped_existing")


class TranscriptApiIngestionRunService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._settings = get_settings()

    async def get_active_run(self) -> TranscriptApiIngestionRun | None:
        result = await self._db.execute(
            select(TranscriptApiIngestionRun)
            .where(TranscriptApiIngestionRun.status.in_(ACTIVE_RUN_STATUSES))
            .order_by(TranscriptApiIngestionRun.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_run(self, run_id: int) -> TranscriptApiIngestionRun | None:
        return await self._db.get(TranscriptApiIngestionRun, run_id)

    async def catalog_coverage(self) -> CatalogCoverageStats:
        total = int(await self._db.scalar(select(func.count()).select_from(Video)) or 0)
        without = int(
            await self._db.scalar(
                select(func.count()).select_from(Video).where(missing_transcript_clause())
            )
            or 0
        )
        with_transcript = total - without
        with_embed = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(Video.transcript_embedding.isnot(None))
            )
            or 0
        )
        transcript_pct = round((with_transcript / total) * 100, 1) if total else 0.0
        embed_pct = (
            round((with_embed / with_transcript) * 100, 1) if with_transcript else 0.0
        )
        return CatalogCoverageStats(
            total_videos=total,
            with_transcript=with_transcript,
            without_transcript=without,
            with_transcript_embedding=with_embed,
            transcript_coverage_pct=transcript_pct,
            embedding_coverage_pct=embed_pct,
        )

    async def dashboard_stats(self) -> TranscriptApiIngestionDashboardStats:
        catalog = await self.catalog_coverage()
        active = await self.get_active_run()
        return TranscriptApiIngestionDashboardStats(
            catalog=catalog,
            active_run_id=active.id if active else None,
        )

    def _build_run_job_stats(
        self, jobs_total: int, counts: dict[str, int]
    ) -> RunJobStats:
        success = counts.get("success", 0)
        failed = counts.get("failed", 0)
        unavailable = counts.get("unavailable", 0)
        skipped = counts.get("skipped_existing", 0)
        processed = success + failed + unavailable + skipped
        progress_pct = round((processed / jobs_total) * 100, 1) if jobs_total else 0.0
        success_pct = round((success / processed) * 100, 1) if processed else 0.0
        unavailable_pct = round((unavailable / processed) * 100, 1) if processed else 0.0
        return RunJobStats(
            jobs_total=jobs_total,
            queued=counts.get("queued", 0),
            processing=counts.get("processing", 0),
            success=success,
            failed=failed,
            unavailable=unavailable,
            skipped_existing=skipped,
            processed=processed,
            progress_pct=progress_pct,
            success_pct=success_pct,
            unavailable_pct=unavailable_pct,
        )

    async def start_run(
        self, body: TranscriptApiIngestionStartRequest
    ) -> TranscriptApiIngestionRun:
        active = await self.get_active_run()
        if active is not None:
            raise ValueError(
                f"Run #{active.id} is already {active.status}. Pause or wait for completion."
            )

        settings = self._settings
        worker_count = min(
            max(1, body.worker_count),
            settings.transcript_api_ingestion_max_workers,
        )
        limit = min(body.limit, 5000)

        run = TranscriptApiIngestionRun(
            status="queued",
            worker_count=worker_count,
            limit_count=limit,
            creator_filter=(body.creator_filter or "").strip() or None,
            latest_only=body.latest_only,
            only_missing=body.only_missing,
        )
        self._db.add(run)
        await self._db.flush()

        videos = await self._select_videos_for_run(run)
        for video in videos:
            self._db.add(
                TranscriptApiIngestionJob(
                    run_id=run.id,
                    video_id=video.id,
                    status="queued",
                    title=(video.title or "")[:512],
                    creator_name=(video.creator_name or "")[:255],
                )
            )

        run.jobs_total = len(videos)
        run.message = f"Queued {len(videos)} video(s)"
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def _select_videos_for_run(self, run: TranscriptApiIngestionRun) -> list[Video]:
        stmt = select(Video)
        if run.only_missing:
            stmt = stmt.where(missing_transcript_clause())
        if run.creator_filter:
            stmt = stmt.where(
                func.lower(Video.creator_name) == run.creator_filter.lower()
            )
        if run.latest_only:
            stmt = stmt.order_by(Video.published_at.desc().nullslast(), Video.id.desc())
        else:
            stmt = stmt.order_by(Video.views_count.desc(), Video.id.desc())
        if run.limit_count:
            stmt = stmt.limit(run.limit_count)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def mark_running(self, run_id: int) -> None:
        run = await self._require_run(run_id)
        run.status = "running"
        run.message = "Processing"
        await self._db.commit()

    async def pause_run(self, run_id: int) -> TranscriptApiIngestionRun:
        run = await self._require_run(run_id)
        if run.status not in ("running", "queued"):
            raise ValueError(f"Cannot pause run in status {run.status}")
        run.status = "paused"
        run.message = "Paused"
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def resume_run(self, run_id: int) -> TranscriptApiIngestionRun:
        run = await self._require_run(run_id)
        if run.status != "paused":
            raise ValueError(f"Cannot resume run in status {run.status}")
        run.status = "running"
        run.message = "Resumed"
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def retry_failed(self, run_id: int) -> int:
        run = await self._require_run(run_id)
        if run.status in ("completed",):
            run.status = "running"
            run.finished_at = None
            run.duration_seconds = None
        result = await self._db.execute(
            select(TranscriptApiIngestionJob).where(
                TranscriptApiIngestionJob.run_id == run_id,
                TranscriptApiIngestionJob.status == "failed",
            )
        )
        jobs = list(result.scalars().all())
        for job in jobs:
            job.status = "queued"
            job.error_message = None
            job.updated_at = datetime.now(timezone.utc)
        if run.status == "paused":
            pass
        elif run.status not in ACTIVE_RUN_STATUSES:
            run.status = "running"
        run.message = f"Re-queued {len(jobs)} failed job(s)"
        await self._db.commit()
        return len(jobs)

    async def is_paused(self, run_id: int) -> bool:
        run = await self._db.get(TranscriptApiIngestionRun, run_id)
        return run is not None and run.status == "paused"

    async def claim_next_job(self, run_id: int) -> TranscriptApiIngestionJob | None:
        stmt = (
            select(TranscriptApiIngestionJob)
            .where(
                TranscriptApiIngestionJob.run_id == run_id,
                TranscriptApiIngestionJob.status == "queued",
            )
            .order_by(TranscriptApiIngestionJob.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await self._db.execute(stmt)
        job = result.scalar_one_or_none()
        if job is None:
            return None
        job.status = "processing"
        job.updated_at = datetime.now(timezone.utc)
        await self._db.commit()
        return job

    async def pending_count(self, run_id: int) -> int:
        queued = int(
            await self._db.scalar(
                select(func.count())
                .select_from(TranscriptApiIngestionJob)
                .where(
                    TranscriptApiIngestionJob.run_id == run_id,
                    TranscriptApiIngestionJob.status == "queued",
                )
            )
            or 0
        )
        processing = int(
            await self._db.scalar(
                select(func.count())
                .select_from(TranscriptApiIngestionJob)
                .where(
                    TranscriptApiIngestionJob.run_id == run_id,
                    TranscriptApiIngestionJob.status == "processing",
                )
            )
            or 0
        )
        return queued + processing

    async def mark_completed(
        self, run_id: int, *, started_monotonic: float, error_message: str | None = None
    ) -> None:
        run = await self._require_run(run_id)
        finished = datetime.now(timezone.utc)
        run.finished_at = finished
        run.duration_seconds = max(1, int(time.monotonic() - started_monotonic))
        if error_message:
            run.status = "failed"
            run.error_message = error_message
            run.message = "Run failed"
        else:
            run.status = "completed"
            run.message = "Run completed"
        await self._db.commit()

    async def list_jobs(
        self,
        run_id: int,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> TranscriptApiIngestionJobsPage:
        limit = min(max(1, limit), 200)
        offset = max(0, offset)
        filters = [TranscriptApiIngestionJob.run_id == run_id]
        if status and status != "all":
            filters.append(TranscriptApiIngestionJob.status == status)

        total = int(
            await self._db.scalar(
                select(func.count())
                .select_from(TranscriptApiIngestionJob)
                .where(*filters)
            )
            or 0
        )
        result = await self._db.execute(
            select(TranscriptApiIngestionJob)
            .where(*filters)
            .order_by(TranscriptApiIngestionJob.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = [
            TranscriptApiIngestionJobRead.model_validate(j) for j in result.scalars().all()
        ]
        return TranscriptApiIngestionJobsPage(
            items=items,
            total=total,
            offset=offset,
            limit=limit,
            status_filter=status if status and status != "all" else None,
        )

    async def to_run_read(
        self,
        run: TranscriptApiIngestionRun,
        *,
        include_jobs: bool = False,
        jobs_limit: int = 0,
    ) -> TranscriptApiIngestionRunRead:
        catalog = await self.catalog_coverage()
        job_counts = await self._job_counts_for_run(run.id)
        run_stats = self._build_run_job_stats(run.jobs_total, job_counts)
        jobs: list[TranscriptApiIngestionJobRead] = []
        if include_jobs and jobs_limit > 0:
            page = await self.list_jobs(run.id, offset=0, limit=jobs_limit)
            jobs = page.items
        return TranscriptApiIngestionRunRead(
            id=run.id,
            status=run.status,
            worker_count=run.worker_count,
            limit_count=run.limit_count,
            creator_filter=run.creator_filter,
            latest_only=run.latest_only,
            only_missing=run.only_missing,
            jobs_total=run.jobs_total,
            message=run.message,
            error_message=run.error_message,
            started_at=run.started_at,
            finished_at=run.finished_at,
            duration_seconds=run.duration_seconds,
            catalog=catalog,
            run_stats=run_stats,
            jobs=jobs,
        )

    async def _job_counts_for_run(self, run_id: int) -> dict[str, int]:
        result = await self._db.execute(
            select(
                TranscriptApiIngestionJob.status,
                func.count().label("n"),
            )
            .where(TranscriptApiIngestionJob.run_id == run_id)
            .group_by(TranscriptApiIngestionJob.status)
        )
        counts = {row.status: int(row.n) for row in result.all()}
        return {
            "queued": counts.get("queued", 0),
            "processing": counts.get("processing", 0),
            "success": counts.get("success", 0),
            "failed": counts.get("failed", 0),
            "unavailable": counts.get("unavailable", 0),
            "skipped_existing": counts.get("skipped_existing", 0),
        }

    async def _require_run(self, run_id: int) -> TranscriptApiIngestionRun:
        run = await self._db.get(TranscriptApiIngestionRun, run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")
        return run
