"""
Research briefing feed — ranked, explainable signals from synced catalog.

No keyword cards, no catalog-leader dumps, no LLM.
See docs/FEED_INTELLIGENCE_AUDIT.md
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.models.video_stats_history import VideoStatsHistory
from app.models.creator_stats_history import CreatorStatsHistory
from app.schemas.copilot import (
    FeedBriefingMeta,
    FeedEvidenceVideo,
    FeedItem,
    IntelligenceFeedResponse,
)
from app.services.analytics.growth_analytics_service import GrowthAnalyticsService
from app.services.copilot.feed_scoring import (
    score_audience_theme,
    score_breakout,
    score_creator_growth,
    score_creator_strength,
    score_hook_pattern,
)
from app.services.copilot.feed_signal_classifier import (
    AUDIENCE_THEMES,
    CATEGORY_AUDIENCE,
    CATEGORY_BREAKOUT,
    CATEGORY_CREATOR_GROWTH,
    CATEGORY_CREATOR_STRENGTH,
    CATEGORY_HOOK_PATTERN,
    audience_theme_label,
    hook_label,
)
from app.services.copilot.feed_signal_ranker import (
    DEFAULT_BRIEFING_LIMIT,
    MAX_BRIEFING_LIMIT,
    MIN_FINAL_SCORE,
    item_from_parts,
    rank_feed_signals,
)


def _dedupe_evidence_videos(
    rows: list[tuple[int, str, str]],
    limit: int = 3,
) -> list[FeedEvidenceVideo]:
    seen: set[int] = set()
    out: list[FeedEvidenceVideo] = []
    for vid, vtitle, creator in rows:
        if vid in seen:
            continue
        seen.add(vid)
        out.append(
            FeedEvidenceVideo(
                video_id=vid,
                title=vtitle,
                creator_name=creator,
            )
        )
        if len(out) >= limit:
            break
    return out


class FeedService:
    """Builds a daily research briefing: collect → score → rank → cap."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_feed(self, limit: int = DEFAULT_BRIEFING_LIMIT) -> IntelligenceFeedResponse:
        catalog_total = int(
            await self._db.scalar(select(func.count()).select_from(Video)) or 0
        )
        comment_count = int(
            await self._db.scalar(select(func.count()).select_from(Comment)) or 0
        )
        snapshot_meta = await self._snapshot_meta()

        candidates: list[FeedItem] = []
        candidates.extend(await self._collect_breakouts(snapshot_meta))
        candidates.extend(await self._collect_creator_growth(snapshot_meta))
        candidates.extend(await self._collect_creator_strength())
        candidates.extend(await self._collect_audience_themes())
        candidates.extend(await self._collect_hook_patterns())

        cap = max(3, min(limit, MAX_BRIEFING_LIMIT))
        ranked = rank_feed_signals(candidates, limit=cap)

        return IntelligenceFeedResponse(
            items=ranked,
            catalog_video_count=catalog_total,
            briefing=FeedBriefingMeta(
                signals_considered=len(candidates),
                signals_selected=len(ranked),
                min_final_score=MIN_FINAL_SCORE,
                snapshot_date_latest=snapshot_meta.get("latest_date"),
                snapshot_days_max=snapshot_meta.get("max_days"),
                comment_count=comment_count,
                has_snapshot_history=snapshot_meta.get("has_history", False),
            ),
        )

    async def _snapshot_meta(self) -> dict:
        latest = await self._db.scalar(
            select(func.max(VideoStatsHistory.snapshot_date))
        )
        if latest is None:
            latest = await self._db.scalar(
                select(func.max(CreatorStatsHistory.snapshot_date))
            )
        max_days = 0
        if latest:
            video_days = await self._db.scalar(
                select(func.count(func.distinct(VideoStatsHistory.snapshot_date)))
            )
            creator_days = await self._db.scalar(
                select(func.count(func.distinct(CreatorStatsHistory.snapshot_date)))
            )
            max_days = max(int(video_days or 0), int(creator_days or 0))
        return {
            "latest_date": latest.isoformat() if isinstance(latest, date) else None,
            "max_days": max_days or None,
            "has_history": max_days >= 2,
        }

    async def _collect_breakouts(self, snapshot_meta: dict) -> list[FeedItem]:
        if not snapshot_meta.get("has_history"):
            return []

        growth = GrowthAnalyticsService(self._db)
        breakouts = await growth.get_video_breakouts(limit=12)
        items: list[FeedItem] = []

        for v in breakouts.items:
            if v.views_delta_7d <= 0 and v.growth_7d_pct <= 0:
                continue

            snap_days = snapshot_meta.get("max_days") or 0
            scores = score_breakout(
                views_delta_7d=v.views_delta_7d,
                growth_7d_pct=v.growth_7d_pct,
                breakout_score=v.breakout_score,
                snapshot_days=snap_days,
            )

            window_label = (
                "7d" if (snap_days or 0) >= 7 else f"{max(snap_days or 1, 1)}d snapshot window"
            )
            accel = (
                f"{v.growth_7d_pct:.0f}%"
                if v.growth_7d_pct > 0
                else f"+{v.views_delta_7d:,} views"
            )
            title = (
                f"{v.creator_name}: view momentum accelerated ({accel} over {window_label})"
                if v.creator_name
                else f"Video momentum accelerated ({accel} over {window_label})"
            )
            short_title = (v.title[:56] + "…") if len(v.title) > 58 else v.title

            items.append(
                item_from_parts(
                    id=f"breakout-{v.video_id}",
                    category=CATEGORY_BREAKOUT,
                    title=title,
                    summary=(
                        f"+{v.views_delta_7d:,} views ({window_label}) · "
                        f"{v.velocity_views_per_day:,.0f}/day · "
                        f"now {v.views_now:,} total"
                    ),
                    description=(
                        f"“{short_title}” gained traction in your snapshot window — "
                        f"worth a breakdown while velocity is elevated."
                    ),
                    why_appeared=(
                        f"Views delta over {window_label} and breakout score "
                        f"({v.breakout_score:.1f}) ranked in top snapshot movers."
                    ),
                    why_matters=(
                        "Breakouts in your library are the fastest path to “what to study today” "
                        "— title, hook, and audience fit."
                    ),
                    href=f"/videos/{v.video_id}",
                    badge="7d momentum",
                    creator_name=v.creator_name,
                    views_count=v.views_now,
                    confidence_score=scores.confidence_score,
                    importance_score=scores.importance_score,
                    actionability_score=scores.actionability_score,
                    freshness_score=scores.freshness_score,
                    final_score=scores.final_score,
                    evidence_count=1,
                    supporting_videos=[
                        FeedEvidenceVideo(
                            video_id=v.video_id,
                            title=v.title,
                            creator_name=v.creator_name,
                            views_count=v.views_now,
                        )
                    ],
                    supporting_creators=[v.creator_name] if v.creator_name else [],
                    time_window=window_label,
                    snapshot_days=snap_days,
                )
            )
        return items

    async def _collect_creator_growth(self, snapshot_meta: dict) -> list[FeedItem]:
        if not snapshot_meta.get("has_history"):
            return []

        growth = GrowthAnalyticsService(self._db)
        creators = await growth.get_creator_growth(limit=10)
        items: list[FeedItem] = []
        snap_days = snapshot_meta.get("max_days") or 0
        window_label = (
            "7d" if snap_days >= 7 else f"{max(snap_days, 1)}d snapshot window"
        )

        for c in creators.items:
            if c.growth_7d_pct <= 0 and c.subscribers_delta_7d <= 0 and c.views_delta_7d <= 0:
                continue

            scores = score_creator_growth(
                growth_7d_pct=max(c.growth_7d_pct, 0),
                views_delta_7d=c.views_delta_7d,
                subscribers_delta_7d=c.subscribers_delta_7d,
                snapshot_days=snap_days,
            )

            items.append(
                item_from_parts(
                    id=f"growth-{c.creator_name}",
                    category=CATEGORY_CREATOR_GROWTH,
                    title=f"{c.creator_name}: channel momentum up over {window_label}",
                    summary=(
                        f"+{c.subscribers_delta_7d:,} subs · "
                        f"{c.growth_7d_pct:.1f}% sub growth · "
                        f"{c.velocity_views_per_day:,.0f} catalog views/day"
                    ),
                    description=(
                        "Subscriber and catalog view velocity improved in the latest "
                        "snapshot window — prioritize this creator while acceleration holds."
                    ),
                    why_appeared=(
                        f"Creator ranked in top snapshot growth ({window_label}, "
                        f"{snap_days} snapshot days in history)."
                    ),
                    why_matters=(
                        "Growth signals are rare in a static Sheets catalog; they show "
                        "what changed since your last sync cycle."
                    ),
                    href=f"/creators/{c.creator_name}",
                    badge="Creator growth",
                    creator_name=c.creator_name,
                    confidence_score=scores.confidence_score,
                    importance_score=scores.importance_score,
                    actionability_score=scores.actionability_score,
                    freshness_score=scores.freshness_score,
                    final_score=scores.final_score,
                    evidence_count=c.snapshot_days,
                    supporting_videos=[],
                    supporting_creators=[c.creator_name],
                    time_window=window_label,
                    snapshot_days=snap_days,
                )
            )
        return items

    async def _collect_creator_strength(self) -> list[FeedItem]:
        views = list(
            (await self._db.execute(select(Video.views_count))).scalars().all()
        )
        if not views:
            return []

        catalog_median = float(statistics.median(views))
        if catalog_median <= 0:
            catalog_median = 1.0

        stmt = (
            select(
                Video.creator_name,
                func.avg(Video.views_count).label("avg_v"),
                func.count().label("cnt"),
            )
            .group_by(Video.creator_name)
            .having(func.count() >= 3)
        )
        items: list[FeedItem] = []

        for name, avg_v, cnt in (await self._db.execute(stmt)).all():
            avg_f = float(avg_v or 0)
            count = int(cnt or 0)
            ratio = avg_f / catalog_median
            if ratio < 1.35:
                continue

            scores = score_creator_strength(
                performance_ratio=ratio,
                video_count=count,
                catalog_median_views=catalog_median,
            )

            items.append(
                item_from_parts(
                    id=f"strength-{name}",
                    category=CATEGORY_CREATOR_STRENGTH,
                    title=(
                        f"{name} consistently exceeds catalog median "
                        f"({ratio:.1f}× across {count} videos)"
                    ),
                    summary=(
                        f"{int(avg_f):,} avg views · {count} videos · "
                        f"catalog median {int(catalog_median):,}"
                    ),
                    description=(
                        "This creator’s catalog averages sit well above your synced median — "
                        "a stable outlier worth deep comparison, not a one-off viral title."
                    ),
                    why_appeared=(
                        f"Average views ≥135% of catalog median with ≥3 indexed videos "
                        f"(ratio {ratio:.2f})."
                    ),
                    why_matters=(
                        "Strong baselines help you study repeatable title and hook patterns "
                        "without chasing single-video noise."
                    ),
                    href=f"/creators/{name}",
                    badge="Catalog outlier",
                    creator_name=name,
                    avg_views=int(avg_f),
                    video_count=count,
                    performance_ratio=round(ratio, 2),
                    confidence_score=scores.confidence_score,
                    importance_score=scores.importance_score,
                    actionability_score=scores.actionability_score,
                    freshness_score=scores.freshness_score,
                    final_score=scores.final_score,
                    evidence_count=count,
                    supporting_videos=[],
                    supporting_creators=[name],
                    time_window="full catalog",
                    snapshot_days=None,
                )
            )

        items.sort(key=lambda x: x.final_score or 0, reverse=True)
        return items[:6]

    async def _collect_audience_themes(self) -> list[FeedItem]:
        stmt = (
            select(Comment, Video.id, Video.title, Video.creator_name)
            .join(Video, Video.id == Comment.video_id)
            .order_by(Comment.likes_count.desc())
            .limit(80)
        )
        rows = (await self._db.execute(stmt)).all()
        if not rows:
            return []

        buckets: dict[str, list[tuple]] = defaultdict(list)

        for comment, vid, vtitle, creator in rows:
            tags = comment.emotional_tags or []
            theme = None
            for tag in tags:
                if tag in AUDIENCE_THEMES:
                    theme = tag
                    break
            if theme is None:
                if comment.sentiment == "negative":
                    theme = "negative"
                elif comment.sentiment == "positive":
                    theme = "positive"
                else:
                    continue  # skip neutral-only

            buckets[theme].append((comment, vid, vtitle, creator))

        items: list[FeedItem] = []
        for theme, group in buckets.items():
            if len(group) < 2 and max(c.likes_count for c, *_ in group) < 50:
                continue

            total_likes = sum(c.likes_count for c, *_ in group)
            scores = score_audience_theme(
                comment_count=len(group),
                total_likes=total_likes,
                theme=theme,
            )

            top = group[0]
            comment, vid, vtitle, creator = top
            label = audience_theme_label(theme)
            creators = list({c for _, _, _, c in group})[:4]
            n_comments = len(group)
            n_creators = len(creators)

            items.append(
                item_from_parts(
                    id=f"audience-theme-{theme}",
                    category=CATEGORY_AUDIENCE,
                    title=(
                        f"Audience theme: {label} "
                        f"({n_comments} synced comments in theme)"
                    ),
                    summary=(
                        f"{total_likes:,} combined likes · "
                        f"lead video: {vtitle[:48]}…"
                    ),
                    description=(
                        f"Synced comments in your catalog cluster around {label} "
                        f"({n_comments} comments"
                        + (
                            f", signals across {n_creators} creators"
                            if n_creators >= 2
                            else ""
                        )
                        + ") — useful for hooks and positioning."
                    ),
                    why_appeared=(
                        f"{n_comments} comments in top-80 synced pool tagged {theme} "
                        f"(or strong positive/negative sentiment); ≥2 required."
                    ),
                    why_matters=(
                        "Audience language validates what resonates beyond view counts — "
                        "especially for interview and longform formats."
                    ),
                    href=f"/videos/{vid}",
                    badge="Audience",
                    creator_name=creator,
                    audience_theme=theme,
                    confidence_score=scores.confidence_score,
                    importance_score=scores.importance_score,
                    actionability_score=scores.actionability_score,
                    freshness_score=scores.freshness_score,
                    final_score=scores.final_score,
                    evidence_count=len(group),
                    supporting_videos=_dedupe_evidence_videos(
                        [
                            (vid, vtitle, creator)
                            for _, vid, vtitle, creator in group[:5]
                        ]
                    ),
                    supporting_creators=creators,
                    time_window="synced comments",
                    snapshot_days=None,
                )
            )

        items.sort(key=lambda x: x.final_score or 0, reverse=True)
        return items[:4]

    async def _collect_hook_patterns(self) -> list[FeedItem]:
        global_avg = float(
            await self._db.scalar(select(func.avg(HookPattern.views_count))) or 0
        )
        if global_avg <= 0:
            return []

        stmt = (
            select(
                HookPattern.hook_type,
                func.avg(HookPattern.views_count).label("avg_v"),
                func.count().label("cnt"),
            )
            .group_by(HookPattern.hook_type)
        )
        rows = (await self._db.execute(stmt)).all()
        usage_counts = [int(cnt or 0) for _, _, cnt in rows if int(cnt or 0) >= 3]
        if not usage_counts:
            return []

        median_usage = float(statistics.median(usage_counts))

        items: list[FeedItem] = []

        for hook_type, avg_v, cnt in rows:
            count = int(cnt or 0)
            avg_f = float(avg_v or 0)
            if count < 3:
                continue
            # Underused vs catalog: at or below median indexed usage per hook type
            if count > median_usage:
                continue
            ratio = avg_f / global_avg
            if ratio < 1.2:
                continue

            examples = list(
                (
                    await self._db.execute(
                        select(HookPattern)
                        .where(HookPattern.hook_type == hook_type)
                        .order_by(HookPattern.views_count.desc())
                        .limit(3)
                    )
                ).scalars().all()
            )
            distinct_videos = len({p.video_id for p in examples if p.video_id})

            scores = score_hook_pattern(
                indexed_count=count,
                performance_ratio=ratio,
                distinct_videos=distinct_videos,
            )

            label = hook_label(hook_type)
            items.append(
                item_from_parts(
                    id=f"hook-{hook_type}",
                    category=CATEGORY_HOOK_PATTERN,
                    title=(
                        f"{label} hooks outperform catalog hook average "
                        f"({ratio:.1f}×, {count} indexed)"
                    ),
                    summary=(
                        f"{count} patterns · {int(avg_f):,} avg views · "
                        f"{distinct_videos} top videos"
                    ),
                    description=(
                        f"Titles using {label} punch above your indexed hook baseline "
                        "without being overused — a repeatable format to test."
                    ),
                    why_appeared=(
                        f"≥3 indexed patterns, avg views ≥120% of hook mean, "
                        f"usage {count} ≤ catalog median usage ({int(median_usage)})."
                    ),
                    why_matters=(
                        "Hook patterns are the most direct creative lever in your catalog — "
                        "especially when evidence spans multiple videos."
                    ),
                    href="/hooks",
                    badge="Hook pattern",
                    hook_type=hook_type,
                    video_count=count,
                    avg_views=int(avg_f),
                    performance_ratio=round(ratio, 2),
                    confidence_score=scores.confidence_score,
                    importance_score=scores.importance_score,
                    actionability_score=scores.actionability_score,
                    freshness_score=scores.freshness_score,
                    final_score=scores.final_score,
                    evidence_count=count,
                    supporting_videos=[
                        FeedEvidenceVideo(
                            video_id=p.video_id or 0,
                            title=p.video_title[:80],
                            creator_name=p.creator_name,
                            views_count=p.views_count,
                        )
                        for p in examples
                        if p.video_id
                    ],
                    supporting_creators=list({p.creator_name for p in examples})[:4],
                    time_window="indexed hooks",
                    snapshot_days=None,
                )
            )

        items.sort(key=lambda x: x.final_score or 0, reverse=True)
        return items[:5]
