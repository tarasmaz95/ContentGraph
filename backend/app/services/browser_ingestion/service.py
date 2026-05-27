"""Browser ingestion queue, workers, and dashboard."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.browser_ingestion import (
    BrowserIngestionJob,
    BrowserIngestionRun,
    BrowserIngestionWorker,
)
from app.models.video import Video
from app.schemas.browser_ingestion import (
    BrowserIngestionDashboard,
    BrowserIngestionHeartbeatRequest,
    BrowserIngestionJobClaimResponse,
    BrowserIngestionJobCompleteRequest,
    BrowserIngestionJobFailRequest,
    BrowserIngestionJobRead,
    BrowserIngestionJobsPage,
    BrowserIngestionRunRead,
    BrowserIngestionRunStats,
    BrowserIngestionStartRequest,
    BrowserIngestionWorkerRead,
    BrowserIngestionWorkerRegisterResponse,
)
from app.services.browser_ingestion.enqueue import select_videos_for_browser_run
from app.services.browser_ingestion.worker_auth import generate_worker_token, hash_worker_token
from app.services.transcripts.api_ingestion.missing import missing_transcript_clause

ACTIVE_RUN_STATUSES = ("queued", "running", "paused")
TERMINAL_JOB = ("success", "failed", "skipped")
STUCK_JOB_MINUTES = 15
HEARTBEAT_OFFLINE_SECONDS = 45


class BrowserIngestionService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def register_worker(self, name: str) -> BrowserIngestionWorkerRegisterResponse:
        token = generate_worker_token()
        worker = BrowserIngestionWorker(
            name=name.strip(),
            token_hash=hash_worker_token(token),
            status="offline",
            current_action="idle",
        )
        self._db.add(worker)
        await self._db.commit()
        await self._db.refresh(worker)
        return BrowserIngestionWorkerRegisterResponse(
            worker_id=worker.id,
            token=token,
            message="Save this token in worker .env as WORKER_TOKEN — shown once only.",
        )

    async def heartbeat(
        self,
        worker: BrowserIngestionWorker,
        body: BrowserIngestionHeartbeatRequest,
    ) -> BrowserIngestionWorkerRead:
        stats_prev = dict(worker.stats_json or {})
        clear_requested = bool(stats_prev.get("cooldown_clear_requested_at"))
        payload = body
        if clear_requested and (
            body.status == "cooldown"
            or body.cooldown_until
            or (body.consecutive_failures or 0) > 0
        ):
            payload = body.model_copy(
                update={
                    "status": "online",
                    "cooldown_until": None,
                    "consecutive_failures": 0,
                }
            )

        worker.status = payload.status
        worker.current_action = payload.current_action[:64]
        worker.current_job_id = payload.current_job_id
        worker.current_video_url = (payload.current_video_url or "")[:512] or None
        worker.last_heartbeat_at = datetime.now(timezone.utc)
        worker.stats_json = {
            **stats_prev,
            "processed_today": payload.processed_today,
            "success_today": payload.success_today,
            "failed_today": payload.failed_today,
            "jobs_per_min": payload.jobs_per_min,
            "current_phase": payload.current_phase,
            "consecutive_failures": payload.consecutive_failures,
            "max_jobs_per_day": payload.max_jobs_per_day,
            "daily_limit_reached": payload.daily_limit_reached,
            "cooldown_until": payload.cooldown_until,
            "extension_version": payload.extension_version,
            "required_extension_version": payload.required_extension_version,
            "memory_mb": payload.memory_mb,
            "uptime_seconds": payload.uptime_seconds,
            "last_screenshot_path": payload.last_screenshot_path,
            "last_success_at": payload.last_success_at,
            "restart_recommended": payload.restart_recommended,
            "processed_per_hour": payload.processed_per_hour,
        }
        await self._requeue_stuck_jobs()
        await self._db.commit()
        await self._db.refresh(worker)

        still_in_cooldown = (
            body.status == "cooldown" or body.cooldown_until or (body.consecutive_failures or 0) > 0
        )
        if clear_requested and not still_in_cooldown:
            stats = dict(worker.stats_json or {})
            stats.pop("cooldown_clear_requested_at", None)
            worker.stats_json = stats
            await self._db.commit()
            await self._db.refresh(worker)

        read = self._worker_read(worker)
        if clear_requested and still_in_cooldown:
            return read.model_copy(update={"clear_local_cooldown": True})
        return read

    async def reset_workers_cooldown(self) -> int:
        now = datetime.now(timezone.utc)
        result = await self._db.execute(select(BrowserIngestionWorker))
        count = 0
        for worker in result.scalars().all():
            stats = dict(worker.stats_json or {})
            stats["consecutive_failures"] = 0
            stats["cooldown_until"] = None
            stats["cooldown_clear_requested_at"] = now.isoformat()
            worker.stats_json = stats
            if worker.status == "cooldown":
                worker.status = "online"
                worker.current_action = "idle"
            count += 1
        await self._db.commit()
        return count

    async def _requeue_stuck_jobs(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=STUCK_JOB_MINUTES)
        result = await self._db.execute(
            select(BrowserIngestionJob).where(
                BrowserIngestionJob.status == "processing",
                BrowserIngestionJob.claimed_at < cutoff,
            )
        )
        for job in result.scalars().all():
            job.status = "queued"
            job.worker_id = None
            job.claimed_at = None
            job.error_message = "Requeued — processing timeout"
            job.updated_at = datetime.now(timezone.utc)

    async def start_run(self, body: BrowserIngestionStartRequest) -> BrowserIngestionRun:
        active = await self._get_active_run()
        if active is not None:
            raise ValueError(
                f"Run #{active.id} is already {active.status}. Pause or wait for completion."
            )

        run = BrowserIngestionRun(
            status="running",
            mode=body.mode,
            limit_count=body.limit,
            creator_filter=(body.creator_filter or "").strip() or None,
            latest_only=body.latest_only,
            only_missing=body.only_missing,
            message="Waiting for local worker",
        )
        self._db.add(run)
        await self._db.flush()

        videos = await select_videos_for_browser_run(
            self._db,
            mode=body.mode,
            limit=body.limit,
            creator_filter=run.creator_filter,
            latest_only=run.latest_only,
            only_missing=run.only_missing,
        )

        for video in videos:
            self._db.add(
                BrowserIngestionJob(
                    run_id=run.id,
                    video_id=video.id,
                    video_url=(video.video_url or "")[:512],
                    title=(video.title or "")[:512],
                    creator_name=(video.creator_name or "")[:255],
                    mode=body.mode,
                    status="queued",
                )
            )

        run.jobs_total = len(videos)
        run.message = f"Queued {len(videos)} video(s) for browser worker"
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def pause_run(self, run_id: int) -> BrowserIngestionRun:
        run = await self._require_run(run_id)
        if run.status not in ACTIVE_RUN_STATUSES:
            raise ValueError(f"Cannot pause run in status {run.status}")
        run.status = "paused"
        run.message = "Paused — worker should stop claiming"
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def resume_run(self, run_id: int) -> BrowserIngestionRun:
        run = await self._require_run(run_id)
        if run.status != "paused":
            raise ValueError(f"Cannot resume run in status {run.status}")
        run.status = "running"
        run.message = "Running"
        await self._db.commit()
        await self._db.refresh(run)
        return run

    async def retry_failed(self, run_id: int) -> int:
        run = await self._require_run(run_id)
        if run.status == "completed":
            run.status = "running"
            run.finished_at = None
        result = await self._db.execute(
            select(BrowserIngestionJob).where(
                BrowserIngestionJob.run_id == run_id,
                BrowserIngestionJob.status == "failed",
            )
        )
        jobs = list(result.scalars().all())
        for job in jobs:
            job.status = "queued"
            job.error_message = None
            job.worker_id = None
            job.claimed_at = None
            job.finished_at = None
            job.updated_at = datetime.now(timezone.utc)
        if run.status not in ACTIVE_RUN_STATUSES:
            run.status = "running"
        run.message = f"Re-queued {len(jobs)} failed job(s)"
        await self._db.commit()
        return len(jobs)

    async def clear_run(self, run_id: int) -> None:
        run = await self._require_run(run_id)
        await self._db.execute(delete(BrowserIngestionJob).where(BrowserIngestionJob.run_id == run_id))
        await self._db.delete(run)

        result = await self._db.execute(select(BrowserIngestionWorker))
        now = datetime.now(timezone.utc)
        for worker in result.scalars().all():
            if worker.current_job_id is not None:
                worker.current_job_id = None
                worker.current_video_url = None
                worker.current_action = "idle"
            stats = dict(worker.stats_json or {})
            stats["current_phase"] = "idle"
            stats["consecutive_failures"] = 0
            stats["cooldown_until"] = None
            worker.stats_json = stats
            worker.last_heartbeat_at = worker.last_heartbeat_at or now

        await self._db.commit()

    async def claim_job(self, worker: BrowserIngestionWorker) -> BrowserIngestionJobClaimResponse:
        if worker.status == "paused":
            return BrowserIngestionJobClaimResponse(job=None, run_paused=True)

        await self._requeue_stuck_jobs()

        run = await self._get_active_run()
        if run is None or run.status == "paused":
            return BrowserIngestionJobClaimResponse(job=None, run_paused=run is not None)

        stmt = (
            select(BrowserIngestionJob)
            .where(
                BrowserIngestionJob.run_id == run.id,
                BrowserIngestionJob.status == "queued",
            )
            .order_by(BrowserIngestionJob.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await self._db.execute(stmt)
        job = result.scalar_one_or_none()
        if job is None:
            await self._maybe_complete_run(run.id)
            await self._db.commit()
            return BrowserIngestionJobClaimResponse(job=None)

        now = datetime.now(timezone.utc)
        job.status = "processing"
        job.worker_id = worker.id
        job.claimed_at = now
        job.updated_at = now
        worker.current_job_id = job.id
        worker.current_video_url = job.video_url
        worker.current_action = "opening_youtube"
        await self._db.commit()
        await self._db.refresh(job)
        return BrowserIngestionJobClaimResponse(job=await self._job_read(job))

    async def complete_job(
        self,
        worker: BrowserIngestionWorker,
        job_id: int,
        body: BrowserIngestionJobCompleteRequest,
    ) -> BrowserIngestionJobRead:
        job = await self._require_job(job_id)
        if job.worker_id != worker.id:
            raise ValueError("Job not assigned to this worker")

        now = datetime.now(timezone.utc)
        job.status = "success"
        job.finished_at = now
        job.updated_at = now
        job.error_message = None
        if body.result:
            job.result_json = body.result.model_dump()

        worker.current_job_id = None
        worker.current_video_url = None
        worker.current_action = "idle"

        await self._maybe_complete_run(job.run_id)
        await self._db.commit()
        await self._db.refresh(job)
        return await self._job_read(job)

    async def fail_job(
        self,
        worker: BrowserIngestionWorker,
        job_id: int,
        body: BrowserIngestionJobFailRequest,
    ) -> BrowserIngestionJobRead:
        job = await self._require_job(job_id)
        if job.worker_id != worker.id:
            raise ValueError("Job not assigned to this worker")

        now = datetime.now(timezone.utc)
        job.error_message = body.error_message[:8000]
        if body.result:
            job.result_json = body.result.model_dump()

        if body.retryable and job.retry_count < job.max_retries:
            job.retry_count += 1
            job.status = "queued"
            job.worker_id = None
            job.claimed_at = None
            job.finished_at = None
        else:
            job.status = "failed"
            job.finished_at = now

        job.updated_at = now
        worker.current_job_id = None
        worker.current_video_url = None
        worker.current_action = "idle"

        await self._maybe_complete_run(job.run_id)
        await self._db.commit()
        await self._db.refresh(job)
        return await self._job_read(job)

    async def _maybe_complete_run(self, run_id: int) -> None:
        pending = int(
            await self._db.scalar(
                select(func.count())
                .select_from(BrowserIngestionJob)
                .where(
                    BrowserIngestionJob.run_id == run_id,
                    BrowserIngestionJob.status.in_(("queued", "processing")),
                )
            )
            or 0
        )
        if pending > 0:
            return
        run = await self._require_run(run_id)
        if run.status in ACTIVE_RUN_STATUSES:
            run.status = "completed"
            run.finished_at = datetime.now(timezone.utc)
            run.message = "All jobs finished"

    async def get_dashboard(self, run_id: int | None = None) -> BrowserIngestionDashboard:
        await self._mark_workers_offline()
        await self._requeue_stuck_jobs()
        await self._db.commit()

        total = int(await self._db.scalar(select(func.count()).select_from(Video)) or 0)
        missing_t = int(
            await self._db.scalar(
                select(func.count()).select_from(Video).where(missing_transcript_clause())
            )
            or 0
        )
        from app.services.browser_ingestion.enqueue import _missing_comments_clause

        missing_c = int(
            await self._db.scalar(
                select(func.count()).select_from(Video).where(_missing_comments_clause())
            )
            or 0
        )

        active = await self._get_active_run()
        rid = run_id or (active.id if active else None)

        workers_list = await self._list_dashboard_workers()
        per_worker_run_stats: dict[int, dict[str, int]] = {}
        if rid:
            result = await self._db.execute(
                select(
                    BrowserIngestionJob.worker_id,
                    BrowserIngestionJob.status,
                    func.count().label("n"),
                )
                .where(
                    BrowserIngestionJob.run_id == rid,
                    BrowserIngestionJob.worker_id.isnot(None),
                )
                .group_by(BrowserIngestionJob.worker_id, BrowserIngestionJob.status)
            )
            for row in result.all():
                bucket = per_worker_run_stats.setdefault(int(row.worker_id), {})
                bucket[row.status] = int(row.n)

        worker_reads: list[BrowserIngestionWorkerRead] = []
        for w in workers_list:
            read = self._worker_read(w)
            stats = per_worker_run_stats.get(w.id, {})
            read = read.model_copy(
                update={
                    "jobs_in_run_success": int(stats.get("success", 0)),
                    "jobs_in_run_failed": int(stats.get("failed", 0)),
                    "jobs_in_run_processing": int(stats.get("processing", 0)),
                }
            )
            worker_reads.append(read)

        primary_worker = next((w for w in worker_reads if w.status != "offline"), None)
        if primary_worker is None and worker_reads:
            primary_worker = worker_reads[0]

        run_read = None
        if rid:
            run = await self.get_run(rid)
            if run:
                run_read = await self.to_run_read(run, include_jobs=False)

        return BrowserIngestionDashboard(
            worker=primary_worker,
            workers=worker_reads,
            active_run_id=active.id if active else None,
            run=run_read,
            catalog_videos_total=total,
            catalog_missing_transcript=missing_t,
            catalog_missing_comments=missing_c,
        )

    async def _mark_workers_offline(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=HEARTBEAT_OFFLINE_SECONDS)
        result = await self._db.execute(
            select(BrowserIngestionWorker).where(
                BrowserIngestionWorker.status.in_(
                    ("online", "paused", "cooldown", "daily_limit", "incompatible_extension")
                ),
                BrowserIngestionWorker.last_heartbeat_at < cutoff,
            )
        )
        offline_workers = list(result.scalars().all())
        for w in offline_workers:
            w.status = "offline"
            w.current_action = "idle"
            await self._requeue_worker_jobs(w.id)

    async def _requeue_worker_jobs(self, worker_id: int) -> None:
        """Requeue processing jobs when worker goes offline (reboot / crash)."""
        result = await self._db.execute(
            select(BrowserIngestionJob).where(
                BrowserIngestionJob.worker_id == worker_id,
                BrowserIngestionJob.status == "processing",
            )
        )
        now = datetime.now(timezone.utc)
        for job in result.scalars().all():
            job.status = "queued"
            job.worker_id = None
            job.claimed_at = None
            job.error_message = "Requeued — worker offline"
            job.updated_at = now

    async def _list_dashboard_workers(self) -> list[BrowserIngestionWorker]:
        """All workers that ever sent a heartbeat, online ones first.

        Offline workers are included so the dashboard can show the full fleet
        (last-seen, last activity). _mark_workers_offline() is already called
        before this; offline ones simply have status == "offline" here.
        """
        now = datetime.now(timezone.utc)
        cutoff_recent = now - timedelta(hours=24)
        result = await self._db.execute(
            select(BrowserIngestionWorker)
            .where(
                (BrowserIngestionWorker.status != "offline")
                | (BrowserIngestionWorker.last_heartbeat_at >= cutoff_recent)
            )
            .order_by(
                BrowserIngestionWorker.status == "offline",
                BrowserIngestionWorker.last_heartbeat_at.desc().nullslast(),
            )
        )
        return list(result.scalars().all())

    async def _get_online_worker(self) -> BrowserIngestionWorker | None:
        result = await self._db.execute(
            select(BrowserIngestionWorker)
            .where(
                BrowserIngestionWorker.status.in_(
                    (
                        "online",
                        "paused",
                        "cooldown",
                        "daily_limit",
                        "incompatible_extension",
                    )
                )
            )
            .order_by(BrowserIngestionWorker.last_heartbeat_at.desc().nullslast())
            .limit(1)
        )
        w = result.scalar_one_or_none()
        if w and w.last_heartbeat_at:
            age = (datetime.now(timezone.utc) - w.last_heartbeat_at).total_seconds()
            if age > HEARTBEAT_OFFLINE_SECONDS:
                return None
        return w

    async def get_run(self, run_id: int) -> BrowserIngestionRun | None:
        return await self._db.get(BrowserIngestionRun, run_id)

    async def _get_active_run(self) -> BrowserIngestionRun | None:
        result = await self._db.execute(
            select(BrowserIngestionRun)
            .where(BrowserIngestionRun.status.in_(ACTIVE_RUN_STATUSES))
            .order_by(BrowserIngestionRun.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_jobs(
        self,
        run_id: int,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> BrowserIngestionJobsPage:
        limit = min(max(1, limit), 200)
        offset = max(0, offset)
        filters = [BrowserIngestionJob.run_id == run_id]
        if status and status != "all":
            filters.append(BrowserIngestionJob.status == status)

        total = int(
            await self._db.scalar(
                select(func.count()).select_from(BrowserIngestionJob).where(*filters)
            )
            or 0
        )
        result = await self._db.execute(
            select(BrowserIngestionJob)
            .where(*filters)
            .order_by(BrowserIngestionJob.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = [await self._job_read(j) for j in result.scalars().all()]
        return BrowserIngestionJobsPage(
            items=items,
            total=total,
            offset=offset,
            limit=limit,
            status_filter=status if status != "all" else None,
        )

    async def to_run_read(
        self,
        run: BrowserIngestionRun,
        *,
        include_jobs: bool = False,
        jobs_limit: int = 0,
    ) -> BrowserIngestionRunRead:
        stats = await self._run_stats(run.id)
        jobs: list[BrowserIngestionJobRead] = []
        if include_jobs and jobs_limit > 0:
            page = await self.list_jobs(run.id, offset=0, limit=jobs_limit)
            jobs = page.items
        return BrowserIngestionRunRead(
            id=run.id,
            status=run.status,
            mode=run.mode,
            limit_count=run.limit_count,
            creator_filter=run.creator_filter,
            latest_only=run.latest_only,
            only_missing=run.only_missing,
            jobs_total=run.jobs_total,
            message=run.message,
            error_message=run.error_message,
            started_at=run.started_at,
            finished_at=run.finished_at,
            run_stats=stats,
            jobs=jobs,
        )

    async def _run_stats(self, run_id: int) -> BrowserIngestionRunStats:
        result = await self._db.execute(
            select(BrowserIngestionJob.status, func.count().label("n"))
            .where(BrowserIngestionJob.run_id == run_id)
            .group_by(BrowserIngestionJob.status)
        )
        counts = {row.status: int(row.n) for row in result.all()}
        jobs_total = sum(counts.values())
        success = counts.get("success", 0)
        failed = counts.get("failed", 0)
        skipped = counts.get("skipped", 0)
        processed = success + failed + skipped
        progress = round((processed / jobs_total) * 100, 1) if jobs_total else 0.0
        success_pct = round((success / processed) * 100, 1) if processed else 0.0
        return BrowserIngestionRunStats(
            jobs_total=jobs_total,
            queued=counts.get("queued", 0),
            processing=counts.get("processing", 0),
            success=success,
            failed=failed,
            skipped=skipped,
            processed=processed,
            progress_pct=progress,
            success_pct=success_pct,
        )

    async def _job_read(self, job: BrowserIngestionJob) -> BrowserIngestionJobRead:
        video = await self._db.get(Video, job.video_id)
        rj = job.result_json or {}
        transcript_status = rj.get("transcript_status")
        comments_status = rj.get("comments_status")
        sheets_status = rj.get("sheets_transcript") or rj.get("sheets_comments")
        embedding_status = None
        if video:
            if video.transcript and str(video.transcript).strip():
                transcript_status = transcript_status or "in_db"
            if video.transcript_embedding is not None:
                embedding_status = "yes"
            elif video.transcript:
                embedding_status = "pending"

        transcript_outcome = _derive_transcript_outcome(
            job, rj, transcript_status, video
        )
        comments_outcome = _derive_comments_outcome(job, rj, comments_status)

        duration_seconds = None
        if rj.get("duration_ms"):
            duration_seconds = round(float(rj["duration_ms"]) / 1000.0, 1)
        elif job.claimed_at and job.finished_at:
            duration_seconds = round(
                (job.finished_at - job.claimed_at).total_seconds(), 1
            )

        worker_name = None
        if job.worker_id:
            worker = await self._db.get(BrowserIngestionWorker, job.worker_id)
            if worker:
                worker_name = worker.name

        return BrowserIngestionJobRead(
            id=job.id,
            run_id=job.run_id,
            video_id=job.video_id,
            video_url=job.video_url,
            title=job.title,
            creator_name=job.creator_name,
            mode=job.mode,
            status=job.status,
            retry_count=job.retry_count,
            error_message=job.error_message,
            result_json=job.result_json,
            transcript_status=transcript_status,
            comments_status=comments_status,
            transcript_outcome=transcript_outcome,
            comments_outcome=comments_outcome,
            sheets_status=sheets_status,
            embedding_status=embedding_status,
            failure_category=rj.get("failure_category"),
            duration_seconds=duration_seconds,
            worker_name=worker_name,
            screenshot_path=rj.get("screenshot_path"),
            current_phase=rj.get("current_phase"),
            retry_history=list(rj.get("retry_history") or []),
            updated_at=job.updated_at,
            finished_at=job.finished_at,
        )

    def _worker_read(self, worker: BrowserIngestionWorker) -> BrowserIngestionWorkerRead:
        stats = worker.stats_json or {}
        raw_max = stats.get("max_jobs_per_day")
        max_jobs_per_day: int | None
        try:
            max_jobs_per_day = int(raw_max) if raw_max is not None else None
        except (TypeError, ValueError):
            max_jobs_per_day = None
        if max_jobs_per_day is not None and max_jobs_per_day <= 0:
            max_jobs_per_day = 0
        daily_limit_reached = bool(stats.get("daily_limit_reached"))
        if not max_jobs_per_day or max_jobs_per_day <= 0:
            daily_limit_reached = False

        health = "healthy"
        if worker.status == "offline":
            health = "offline"
        elif worker.status == "incompatible_extension":
            health = "incompatible_extension"
        elif (
            max_jobs_per_day
            and max_jobs_per_day > 0
            and (worker.status == "daily_limit" or daily_limit_reached)
        ):
            health = "daily_limit"
        elif worker.status == "cooldown":
            health = "cooldown"
        elif stats.get("restart_recommended"):
            health = "restart_recommended"

        cooldown_until = None
        raw_cooldown = stats.get("cooldown_until")
        if raw_cooldown:
            try:
                cooldown_until = datetime.fromisoformat(
                    str(raw_cooldown).replace("Z", "+00:00")
                )
            except ValueError:
                cooldown_until = None

        last_success_at = None
        raw_success = stats.get("last_success_at")
        if raw_success:
            try:
                last_success_at = datetime.fromisoformat(
                    str(raw_success).replace("Z", "+00:00")
                )
            except ValueError:
                last_success_at = None

        return BrowserIngestionWorkerRead(
            id=worker.id,
            name=worker.name,
            status=worker.status,
            current_action=worker.current_action,
            current_phase=stats.get("current_phase"),
            current_job_id=worker.current_job_id,
            current_video_url=worker.current_video_url,
            last_heartbeat_at=worker.last_heartbeat_at,
            processed_today=int(stats.get("processed_today", 0)),
            success_today=int(stats.get("success_today", 0)),
            failed_today=int(stats.get("failed_today", 0)),
            jobs_per_min=stats.get("jobs_per_min"),
            consecutive_failures=int(stats.get("consecutive_failures", 0)),
            max_jobs_per_day=max_jobs_per_day,
            daily_limit_reached=daily_limit_reached,
            cooldown_until=cooldown_until,
            extension_version=stats.get("extension_version"),
            required_extension_version=stats.get("required_extension_version"),
            memory_mb=stats.get("memory_mb"),
            uptime_seconds=stats.get("uptime_seconds"),
            last_screenshot_path=stats.get("last_screenshot_path"),
            last_success_at=last_success_at,
            restart_recommended=bool(stats.get("restart_recommended")),
            processed_per_hour=stats.get("processed_per_hour"),
            health_status=health,
        )

    async def _require_run(self, run_id: int) -> BrowserIngestionRun:
        run = await self._db.get(BrowserIngestionRun, run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")
        return run

    async def _require_job(self, job_id: int) -> BrowserIngestionJob:
        job = await self._db.get(BrowserIngestionJob, job_id)
        if job is None:
            raise ValueError(f"Job {job_id} not found")
        return job


_TRANSCRIPT_OUTCOMES = {"ok", "unavailable", "failed", "skipped"}
_COMMENTS_OUTCOMES = {"ok", "disabled", "empty", "failed", "skipped"}


def _derive_transcript_outcome(
    job: BrowserIngestionJob,
    rj: dict[str, Any],
    transcript_status: str | None,
    video: Video | None,
) -> str | None:
    """Worker may now send `transcript_outcome` directly; legacy jobs derive from status text + DB."""
    raw = rj.get("transcript_outcome")
    if isinstance(raw, str) and raw in _TRANSCRIPT_OUTCOMES:
        return raw

    mode = (job.mode or "").lower()
    if mode == "comments":
        return "skipped"

    text = (transcript_status or "").lower()
    category = (rj.get("failure_category") or "").lower()

    if text and ("saved" in text or "in_db" in text or "characters extracted" in text):
        return "ok"
    if "unavailable" in text or "no transcript" in text or category == "transcript_unavailable":
        return "unavailable"
    if video and video.transcript and str(video.transcript).strip():
        return "ok"
    if job.status == "failed":
        return "failed"
    if job.status == "success":
        return "ok"
    return None


def _derive_comments_outcome(
    job: BrowserIngestionJob,
    rj: dict[str, Any],
    comments_status: str | None,
) -> str | None:
    raw = rj.get("comments_outcome")
    if isinstance(raw, str) and raw in _COMMENTS_OUTCOMES:
        return raw

    mode = (job.mode or "").lower()
    if mode == "transcript":
        return "skipped"

    text = (comments_status or "").lower()
    category = (rj.get("failure_category") or "").lower()

    if text and "saved" in text:
        return "ok"
    if category == "comments_disabled" or "disabled" in text or "turned off" in text:
        return "disabled"
    if "no comments" in text or "unavailable" in text:
        return "empty"
    if job.status == "failed":
        # Hard failure of the whole job — we cannot tell from legacy data which phase broke.
        # Leave null to avoid showing a misleading red "comments" badge.
        return None
    if job.status == "success":
        return "ok"
    return None
