"""Deterministic intelligence coverage & health metrics from Postgres."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_settings import GLOBAL_SETTINGS_ID, AppSettings
from app.models.comment import Comment
from app.models.creator_profile import CreatorProfile
from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.models.video_stats_history import VideoStatsHistory
from app.schemas.intelligence_health import (
    CommentHealthSection,
    CreatorCommentVolume,
    CreatorCoverageRow,
    CreatorCoverageSection,
    DataFreshnessSection,
    FreshnessMetric,
    IntelligenceHealthResponse,
    IntelligenceOverview,
    SnapshotHealthSection,
    SnapshotRunRow,
    SystemStatusHeader,
    TranscriptHealthSection,
    TranscriptSourceCount,
)
from app.services.analytics.snapshot_run_service import SnapshotRunService
from app.services.intelligence.intelligence_health_warnings import (
    build_health_warnings,
    build_system_status,
)


def _pct(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(100.0 * numerator / denominator, 2)


def _freshness_severity(value: int, *, green_max: int, amber_max: int) -> str:
    if value <= green_max:
        return "green"
    if value <= amber_max:
        return "amber"
    return "red"


class IntelligenceHealthService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_health(self) -> IntelligenceHealthResponse:
        now = datetime.now(UTC)
        today = now.date()
        day_7_ago = today - timedelta(days=7)
        day_30_ago = today - timedelta(days=30)
        h24 = now - timedelta(hours=24)

        total_videos = int(
            await self._db.scalar(select(func.count()).select_from(Video)) or 0
        )
        with_transcript = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(Video.transcript.isnot(None), Video.transcript != "")
            )
            or 0
        )
        with_comments = int(
            await self._db.scalar(
                select(func.count(func.distinct(Comment.video_id)))
            )
            or 0
        )
        with_title_emb = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(Video.title_embedding.isnot(None))
            )
            or 0
        )
        with_transcript_emb = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(Video.transcript_embedding.isnot(None))
            )
            or 0
        )
        creators = int(
            await self._db.scalar(select(func.count(func.distinct(Video.creator_name))))
            or 0
        )
        hook_count = int(
            await self._db.scalar(select(func.count()).select_from(HookPattern)) or 0
        )

        snapshot_days = int(
            await self._db.scalar(
                select(func.count(func.distinct(VideoStatsHistory.snapshot_date)))
            )
            or 0
        )
        latest_snap = await self._db.scalar(
            select(func.max(VideoStatsHistory.snapshot_date))
        )

        settings = await self._db.get(AppSettings, GLOBAL_SETTINGS_ID)
        last_sync = settings.updated_at if settings else None

        last_comment = await self._db.scalar(select(func.max(Comment.created_at)))

        last_transcript_row = await self._db.scalar(
            select(func.max(Video.created_at)).where(
                Video.transcript.isnot(None), Video.transcript != ""
            )
        )

        overview = IntelligenceOverview(
            total_videos=total_videos,
            videos_with_transcripts=with_transcript,
            transcript_coverage_pct=_pct(with_transcript, total_videos),
            videos_with_comments=with_comments,
            comment_coverage_pct=_pct(with_comments, total_videos),
            videos_with_title_embeddings=with_title_emb,
            videos_with_transcript_embeddings=with_transcript_emb,
            embedding_coverage_pct=_pct(with_transcript_emb, total_videos),
            creators_tracked=creators,
            hook_patterns_indexed=hook_count,
            snapshot_days=snapshot_days,
            latest_snapshot_date=latest_snap,
            last_catalog_sync_at=last_sync,
            last_comment_ingest_at=last_comment,
            last_transcript_activity_at=last_transcript_row,
            last_transcript_activity_note=(
                "Proxy: latest video.created_at among rows with transcript — "
                "ingest timestamp is not stored separately."
            ),
        )

        videos_added_24h = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(Video.created_at >= h24)
            )
            or 0
        )
        comments_24h = int(
            await self._db.scalar(
                select(func.count()).select_from(Comment).where(Comment.created_at >= h24)
            )
            or 0
        )

        published_stale_7d = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(
                    Video.published_at.isnot(None),
                    Video.published_at < datetime.combine(
                        day_7_ago, datetime.min.time(), tzinfo=UTC
                    ),
                )
            )
            or 0
        )
        published_stale_30d = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(
                    Video.published_at.isnot(None),
                    Video.published_at < datetime.combine(
                        day_30_ago, datetime.min.time(), tzinfo=UTC
                    ),
                )
            )
            or 0
        )

        creators_stale_30d = int(
            await self._db.scalar(
                select(func.count())
                .select_from(CreatorProfile)
                .where(CreatorProfile.updated_at < datetime.combine(
                    day_30_ago, datetime.min.time(), tzinfo=UTC
                ))
            )
            or 0
        )

        freshness = DataFreshnessSection(
            metrics=[
                FreshnessMetric(
                    label="Videos added to catalog (24h)",
                    value=videos_added_24h,
                    severity=_freshness_severity(
                        videos_added_24h, green_max=10, amber_max=0
                    )
                    if videos_added_24h > 0
                    else "amber",
                    hint="New rows from Sheets sync (created_at).",
                ),
                FreshnessMetric(
                    label="Catalog videos published >7d ago",
                    value=published_stale_7d,
                    severity=_freshness_severity(
                        published_stale_7d,
                        green_max=total_videos // 2,
                        amber_max=int(total_videos * 0.85),
                    ),
                    hint="By published_at — not last sync time.",
                ),
                FreshnessMetric(
                    label="Catalog videos published >30d ago",
                    value=published_stale_30d,
                    severity="green" if published_stale_30d < total_videos else "amber",
                    hint="Older catalog slice by publish date.",
                ),
                FreshnessMetric(
                    label="Creator profiles stale >30d",
                    value=creators_stale_30d,
                    severity=_freshness_severity(
                        creators_stale_30d, green_max=5, amber_max=20
                    ),
                    hint="creator_profiles.updated_at.",
                ),
                FreshnessMetric(
                    label="Comments ingested (24h)",
                    value=comments_24h,
                    severity="green" if comments_24h > 0 else "amber",
                    hint="comments.created_at.",
                ),
            ]
        )

        creator_coverage = await self._creator_coverage(total_videos)
        transcripts = await self._transcript_health(total_videos, with_transcript)
        comments = await self._comment_health(total_videos, with_comments)
        snapshots = await self._snapshot_health(snapshot_days)

        last_run = snapshots.recent_runs[0] if snapshots.recent_runs else None
        if last_run:
            dur = last_run.duration_ms or 0
            freshness.metrics.append(
                FreshnessMetric(
                    label="Last snapshot duration (ms)",
                    value=dur,
                    severity="green" if last_run.status == "success" else "red",
                    hint=f"Status: {last_run.status} · source: {last_run.source}",
                )
            )

        hook_eligible = await self._count_eligible_hook_types()
        videos_delta = await self._videos_with_view_changes()

        warnings = build_health_warnings(
            overview,
            transcripts,
            comments,
            snapshots,
            hook_patterns_eligible=hook_eligible,
            videos_with_view_delta=videos_delta,
        )
        level, headline, summary = build_system_status(warnings, overview)

        return IntelligenceHealthResponse(
            generated_at=now,
            system_status=SystemStatusHeader(
                level=level, headline=headline, summary=summary
            ),
            overview=overview,
            freshness=freshness,
            creator_coverage=creator_coverage,
            transcripts=transcripts,
            comments=comments,
            snapshots=snapshots,
            warnings=warnings,
        )

    async def _creator_coverage(self, total_videos: int) -> CreatorCoverageSection:
        stmt = (
            select(
                Video.creator_name,
                func.count(func.distinct(Video.id)).label("video_count"),
                func.count(func.distinct(Video.id))
                .filter(Video.transcript.isnot(None), Video.transcript != "")
                .label("transcript_n"),
                func.count(func.distinct(Comment.video_id)).label("comment_n"),
                func.count(func.distinct(Video.id))
                .filter(Video.transcript_embedding.isnot(None))
                .label("embed_n"),
                func.max(Video.published_at).label("latest_pub"),
            )
            .outerjoin(Comment, Comment.video_id == Video.id)
            .group_by(Video.creator_name)
            .order_by(func.count(func.distinct(Video.id)).desc())
            .limit(100)
        )
        rows: list[CreatorCoverageRow] = []
        for r in (await self._db.execute(stmt)).all():
            vc = int(r.video_count or 0)
            rows.append(
                CreatorCoverageRow(
                    creator_name=r.creator_name,
                    video_count=vc,
                    transcript_pct=_pct(int(r.transcript_n or 0), vc),
                    comment_pct=_pct(int(r.comment_n or 0), vc),
                    embedding_pct=_pct(int(r.embed_n or 0), vc),
                    latest_video_published_at=r.latest_pub,
                )
            )

        if not rows:
            return CreatorCoverageSection()

        def coverage_score(row: CreatorCoverageRow) -> float:
            return row.transcript_pct + row.comment_pct + row.embedding_pct

        strongest = max(rows, key=coverage_score)
        weakest = min(rows, key=coverage_score)
        for row in rows:
            row.is_strongest_coverage = row.creator_name == strongest.creator_name
            row.is_weakest_coverage = row.creator_name == weakest.creator_name

        return CreatorCoverageSection(
            rows=rows,
            strongest_creator=strongest.creator_name,
            weakest_creator=weakest.creator_name,
        )

    async def _transcript_health(
        self, total_videos: int, with_transcript: int
    ) -> TranscriptHealthSection:
        avg_len = float(
            await self._db.scalar(
                select(func.avg(func.length(Video.transcript))).where(
                    Video.transcript.isnot(None), Video.transcript != ""
                )
            )
            or 0
        )
        missing_emb = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(
                    Video.transcript.isnot(None),
                    Video.transcript != "",
                    Video.transcript_embedding.is_(None),
                )
            )
            or 0
        )
        orphan_emb = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Video)
                .where(
                    Video.transcript_embedding.isnot(None),
                    (Video.transcript.is_(None) | (Video.transcript == "")),
                )
            )
            or 0
        )

        return TranscriptHealthSection(
            total_transcripts=with_transcript,
            avg_transcript_length=round(avg_len, 0),
            transcripts_missing_embeddings=missing_emb,
            orphan_transcript_embeddings=orphan_emb,
            videos_missing_transcript=total_videos - with_transcript,
            source_breakdown=[
                TranscriptSourceCount(source="unknown", count=with_transcript),
            ],
            source_tracking_note=(
                "Transcript source (extension vs batch) is not stored in Postgres — "
                "all transcripts are counted as unknown. Ingest uses POST /transcripts/ingest "
                "and Sheets sync enrich_missing."
            ),
        )

    async def _comment_health(
        self, total_videos: int, with_comments: int
    ) -> CommentHealthSection:
        total_comments = int(
            await self._db.scalar(select(func.count()).select_from(Comment)) or 0
        )
        avg_cpv = round(total_comments / with_comments, 2) if with_comments else 0.0

        tagged_videos = int(
            await self._db.scalar(
                text(
                    """
                    SELECT COUNT(DISTINCT video_id) FROM comments
                    WHERE emotional_tags IS NOT NULL
                      AND emotional_tags::text NOT IN ('[]', 'null')
                    """
                )
            )
            or 0
        )

        neutral_only = int(
            await self._db.scalar(
                text(
                    """
                    SELECT COUNT(*) FROM (
                        SELECT video_id FROM comments
                        GROUP BY video_id
                        HAVING COUNT(*) FILTER (WHERE sentiment != 'neutral') = 0
                    ) t
                    """
                )
            )
            or 0
        )
        neutral_pct = _pct(neutral_only, with_comments) if with_comments else 0.0

        top_vid_id = await self._db.scalar(
            select(Comment.video_id)
            .group_by(Comment.video_id)
            .order_by(func.count().desc())
            .limit(1)
        )
        top_vid_count = 0
        if top_vid_id is not None:
            top_vid_count = int(
                await self._db.scalar(
                    select(func.count())
                    .select_from(Comment)
                    .where(Comment.video_id == top_vid_id)
                )
                or 0
            )
        top_share = _pct(top_vid_count, total_comments) if total_comments else 0.0

        top_creators_stmt = (
            select(Video.creator_name, func.count().label("cnt"))
            .join(Comment, Comment.video_id == Video.id)
            .group_by(Video.creator_name)
            .order_by(func.count().desc())
            .limit(5)
        )
        top_creators = [
            CreatorCommentVolume(creator_name=name, comment_count=int(cnt))
            for name, cnt in (await self._db.execute(top_creators_stmt)).all()
        ]

        return CommentHealthSection(
            total_comments=total_comments,
            videos_with_comments=with_comments,
            avg_comments_per_video=avg_cpv,
            videos_with_emotional_tags=tagged_videos,
            emotional_tags_coverage_pct=_pct(tagged_videos, with_comments),
            neutral_only_pct=neutral_pct,
            top_video_comment_share_pct=top_share,
            top_synced_creators=top_creators,
        )

    async def _snapshot_health(self, snapshot_days: int) -> SnapshotHealthSection:
        status = await SnapshotRunService(self._db).get_status()
        history = await SnapshotRunService(self._db).get_history(limit=10)

        videos_changing = await self._videos_with_view_changes()

        runs = [
            SnapshotRunRow(
                id=r.id,
                started_at=r.started_at,
                finished_at=r.finished_at,
                status=r.status,
                creators_saved=r.creators_saved,
                videos_saved=r.videos_saved,
                duration_ms=r.duration_ms,
                error_message=r.error_message,
                source=r.source,
            )
            for r in history.items
        ]

        return SnapshotHealthSection(
            scheduler_enabled=status.scheduler_enabled,
            next_scheduled_at=status.next_scheduled_at,
            recent_runs=runs,
            videos_with_changing_snapshots=videos_changing,
            snapshot_days=snapshot_days,
        )

    async def _videos_with_view_changes(self) -> int:
        result = await self._db.scalar(
            text(
                """
                SELECT COUNT(*) FROM (
                    SELECT video_id FROM video_stats_history
                    GROUP BY video_id HAVING COUNT(DISTINCT views_count) > 1
                ) t
                """
            )
        )
        return int(result or 0)

    async def _count_eligible_hook_types(self) -> int:
        """Hook types that pass feed underused rule (median usage + ratio)."""
        import statistics

        rows = (
            await self._db.execute(
                select(HookPattern.hook_type, func.count().label("cnt"))
                .group_by(HookPattern.hook_type)
            )
        ).all()
        counts = [int(c or 0) for _, c in rows if int(c or 0) >= 3]
        if not counts:
            return 0
        median_usage = statistics.median(counts)
        global_avg = float(
            await self._db.scalar(select(func.avg(HookPattern.views_count))) or 0
        )
        if global_avg <= 0:
            return 0
        eligible = 0
        for hook_type, cnt in rows:
            count = int(cnt or 0)
            if count < 3 or count > median_usage:
                continue
            avg_v = float(
                await self._db.scalar(
                    select(func.avg(HookPattern.views_count)).where(
                        HookPattern.hook_type == hook_type
                    )
                )
                or 0
            )
            if avg_v / global_avg >= 1.2:
                eligible += 1
        return eligible
