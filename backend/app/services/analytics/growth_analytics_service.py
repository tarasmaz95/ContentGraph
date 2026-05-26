"""Growth, velocity, and breakout metrics from daily snapshots."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.creator_stats_history import CreatorStatsHistory
from app.models.video import Video
from app.models.video_stats_history import VideoStatsHistory
from app.schemas.growth import (
    CreatorGrowthItem,
    CreatorGrowthResponse,
    VelocityItem,
    VelocityResponse,
    VideoBreakoutItem,
    VideoBreakoutsResponse,
)


def _pct_delta(current: int, past: int) -> float:
    if past <= 0:
        return 100.0 if current > 0 else 0.0
    return round(100.0 * (current - past) / past, 2)


def _snapshot_on_or_before(
    snapshots: list[tuple[date, int]], target: date
) -> int | None:
    """Latest value with snapshot_date <= target."""
    val = None
    for snap_date, value in sorted(snapshots, key=lambda x: x[0]):
        if snap_date <= target:
            val = value
    return val


def _snapshot_on_or_before_with_date(
    snapshots: list[tuple[date, int]], target: date
) -> tuple[date, int] | None:
    """Latest (date, value) with snapshot_date <= target."""
    found: tuple[date, int] | None = None
    for snap_date, value in sorted(snapshots, key=lambda x: x[0]):
        if snap_date <= target:
            found = (snap_date, value)
    return found


def _baseline_views(
    view_snaps: list[tuple[date, int]],
    latest_date: date,
    day_7: date,
) -> tuple[date, int, int]:
    """
    Baseline for growth: snapshot on/before day_7, else earliest snapshot.

    Avoids `or views_now` fallback that zeroes delta when history < 7 days.
    """
    views_now = _snapshot_on_or_before(view_snaps, latest_date) or 0
    anchor = _snapshot_on_or_before_with_date(view_snaps, day_7)
    if anchor is None and view_snaps:
        anchor = min(view_snaps, key=lambda x: x[0])
    if anchor is None:
        return latest_date, views_now, views_now
    baseline_date, views_baseline = anchor
    return baseline_date, views_baseline, views_now


class GrowthAnalyticsService:
    """Deterministic growth math — no LLM."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_creator_growth(self, limit: int = 20) -> CreatorGrowthResponse:
        latest_date = await self._db.scalar(
            select(func.max(CreatorStatsHistory.snapshot_date))
        )
        if latest_date is None:
            return CreatorGrowthResponse()

        day_7 = latest_date - timedelta(days=7)
        day_30 = latest_date - timedelta(days=30)

        creators = list(
            (
                await self._db.execute(
                    select(CreatorStatsHistory.creator_name).distinct()
                )
            ).scalars()
        )

        items: list[CreatorGrowthItem] = []
        for name in creators:
            rows = list(
                (
                    await self._db.execute(
                        select(
                            CreatorStatsHistory.snapshot_date,
                            CreatorStatsHistory.subscribers_count,
                            CreatorStatsHistory.total_views,
                            CreatorStatsHistory.youtube_channel_id,
                        )
                        .where(CreatorStatsHistory.creator_name == name)
                        .order_by(CreatorStatsHistory.snapshot_date)
                    )
                ).all()
            )
            if not rows:
                continue

            sub_snaps = [(r[0], int(r[1] or 0)) for r in rows]
            view_snaps = [(r[0], int(r[2] or 0)) for r in rows]
            channel_id = rows[-1][3] or ""

            _, subs_baseline, subs_now = _baseline_views(
                sub_snaps, latest_date, day_7
            )
            subs_30 = _snapshot_on_or_before(sub_snaps, day_30) or subs_baseline
            baseline_date, views_baseline, views_now = _baseline_views(
                view_snaps, latest_date, day_7
            )

            delta_7 = subs_now - subs_baseline
            delta_30 = subs_now - subs_30
            views_delta_7 = views_now - views_baseline
            span_days = max((latest_date - baseline_date).days, 1)
            velocity = round(views_delta_7 / span_days, 2) if views_delta_7 else 0.0

            items.append(
                CreatorGrowthItem(
                    creator_name=name,
                    youtube_channel_id=channel_id,
                    subscribers_now=subs_now,
                    subscribers_delta_7d=delta_7,
                    subscribers_delta_30d=delta_30,
                    growth_7d_pct=_pct_delta(subs_now, subs_baseline),
                    growth_30d_pct=_pct_delta(subs_now, subs_30),
                    total_views_now=views_now,
                    views_delta_7d=views_delta_7,
                    velocity_views_per_day=velocity,
                    snapshot_days=len(rows),
                )
            )

        items.sort(key=lambda x: x.growth_7d_pct, reverse=True)
        return CreatorGrowthResponse(
            items=items[:limit],
            snapshot_date_latest=latest_date,
        )

    async def get_video_breakouts(self, limit: int = 20) -> VideoBreakoutsResponse:
        latest_date = await self._db.scalar(
            select(func.max(VideoStatsHistory.snapshot_date))
        )
        if latest_date is None:
            return VideoBreakoutsResponse()

        day_7 = latest_date - timedelta(days=7)
        items: list[VideoBreakoutItem] = []

        video_ids = list(
            (await self._db.execute(select(VideoStatsHistory.video_id).distinct())).scalars()
        )

        for vid in video_ids:
            snaps = list(
                (
                    await self._db.execute(
                        select(VideoStatsHistory.snapshot_date, VideoStatsHistory.views_count)
                        .where(VideoStatsHistory.video_id == vid)
                        .order_by(VideoStatsHistory.snapshot_date)
                    )
                ).all()
            )
            if not snaps:
                continue

            view_snaps = [(s[0], int(s[1] or 0)) for s in snaps]
            baseline_date, views_baseline, views_now = _baseline_views(
                view_snaps, latest_date, day_7
            )
            delta_7 = views_now - views_baseline
            growth_pct = _pct_delta(views_now, views_baseline)
            span_days = max((latest_date - baseline_date).days, 1)
            velocity = round(delta_7 / span_days, 2)
            # Breakout: strong % growth on meaningful absolute gain
            breakout_score = round(growth_pct * max(delta_7, 1) ** 0.25, 2)

            if delta_7 <= 0 and growth_pct <= 0:
                continue

            video = await self._db.get(Video, vid)
            items.append(
                VideoBreakoutItem(
                    video_id=vid,
                    title=video.title if video else "",
                    creator_name=video.creator_name if video else "",
                    views_now=views_now,
                    views_delta_7d=delta_7,
                    growth_7d_pct=growth_pct,
                    velocity_views_per_day=velocity,
                    breakout_score=breakout_score,
                )
            )

        items.sort(key=lambda x: x.breakout_score, reverse=True)
        return VideoBreakoutsResponse(items=items[:limit])

    async def get_velocity(self, limit: int = 20) -> VelocityResponse:
        breakouts = await self.get_video_breakouts(limit=500)
        items = [
            VelocityItem(
                video_id=b.video_id,
                title=b.title,
                creator_name=b.creator_name,
                views_now=b.views_now,
                velocity_views_per_day=b.velocity_views_per_day,
                views_delta_7d=b.views_delta_7d,
            )
            for b in breakouts.items
        ]
        items.sort(key=lambda x: x.velocity_views_per_day, reverse=True)
        return VelocityResponse(items=items[:limit])
