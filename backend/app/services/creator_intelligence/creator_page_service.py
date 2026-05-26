"""Creator intelligence page — overview, charts, sections (deterministic, fast)."""

from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.schemas.analytics import (
    ChartPoint,
    HookAnalysis,
    HookTypeStat,
    KeywordStat,
    PatternStat,
    TitleAnalysis,
)
from app.schemas.creator_page import (
    CreatorCharts,
    CreatorOverview,
    CreatorPageAnalytics,
    CreatorPageSections,
    TopVideoSummary,
)
from app.schemas.video import VideoRead
from app.services.analytics._video_data import (
    compute_base_metrics,
    keyword_stats_from_titles,
    title_length_vs_views_chart,
)
from app.services.analytics.hook_analytics import HookAnalyticsService
from app.services.analytics.pattern_detection import extract_title_features
from app.services.analytics.title_analytics import TitleAnalyticsService
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.retrieval_service import HybridRetrievalService
from app.services.video_helpers import video_to_read
from app.utils.creator_slug import slugify_creator_name, slug_to_search_terms


class CreatorPageService:
    """
    Builds creator-centric analytics from Postgres video rows.

    No LLM on page load — keeps /creators/[name] fast. AI profile is separate endpoint.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._profiles = CreatorProfileService(db)
        self._hook_svc = HookAnalyticsService()
        self._title_svc = TitleAnalyticsService()
        self._retrieval = HybridRetrievalService(db)

    async def resolve_creator_name(self, slug_or_name: str) -> str | None:
        """
        Match URL slug or raw name to a creator in the videos table.

        Tries: exact ilike, then slug-derived spaced name.
        """
        raw = slug_or_name.strip()
        if not raw:
            return None

        # Exact match first
        stmt = select(Video.creator_name).where(Video.creator_name.ilike(raw)).limit(1)
        hit = (await self._db.execute(stmt)).scalar_one_or_none()
        if hit:
            return hit

        # Slug form: dan-koe -> Dan Koe style lookup
        spaced = slug_to_search_terms(raw)
        pattern = f"%{spaced}%"
        stmt = (
            select(Video.creator_name, func.count(Video.id).label("cnt"))
            .where(Video.creator_name.ilike(pattern))
            .group_by(Video.creator_name)
            .order_by(func.count(Video.id).desc())
            .limit(1)
        )
        row = (await self._db.execute(stmt)).first()
        return row[0] if row else None

    async def get_analytics(self, slug_or_name: str) -> CreatorPageAnalytics | None:
        """Full analytics payload for one creator."""
        creator_name = await self.resolve_creator_name(slug_or_name)
        if not creator_name:
            return None

        videos = await self._profiles.get_videos_for_creator(creator_name, limit=200)
        if not videos:
            return None

        overview = self._build_overview(creator_name, videos)
        charts = self._build_charts(videos)
        sections = self._build_sections(creator_name, videos)

        return CreatorPageAnalytics(
            overview=overview,
            charts=charts,
            sections=sections,
        )

    async def semantic_search(
        self,
        slug_or_name: str,
        query: str,
        limit: int = 20,
    ) -> list[VideoRead]:
        """Semantic search scoped to one creator's videos only."""
        creator_name = await self.resolve_creator_name(slug_or_name)
        if not creator_name:
            return []

        return await self._retrieval.semantic_search_for_creator(
            creator_name=creator_name,
            query=query,
            limit=limit,
        )

    def _build_overview(self, creator_name: str, videos: list[VideoRead]) -> CreatorOverview:
        """Header stats: subscribers, totals, top video, upload timeline."""
        total_views = sum(v.views_count for v in videos)
        avg_views = round(total_views / len(videos), 1) if videos else 0.0
        subscribers = max((v.subscribers_count for v in videos), default=0)
        channel_url = videos[0].channel_url if videos else ""

        top = max(videos, key=lambda v: v.views_count)
        top_video = TopVideoSummary(
            id=top.id,
            title=top.title,
            views_count=top.views_count,
            published_at=top.published_at,
        )

        return CreatorOverview(
            creator_name=creator_name,
            slug=slugify_creator_name(creator_name),
            subscribers_count=subscribers,
            channel_url=channel_url,
            total_videos=len(videos),
            avg_views=avg_views,
            total_views=total_views,
            top_video=top_video,
            upload_timeline=self._upload_timeline(videos),
        )

    def _build_charts(self, videos: list[VideoRead]) -> CreatorCharts:
        """Recharts series — all computed from this creator's videos only."""
        hook_det = self._hook_svc.compute_deterministic(videos)
        keywords = keyword_stats_from_titles(videos, 12)

        hook_chart = [
            ChartPoint(
                label=h["hook_type"],
                value=float(h["avg_views"]),
                count=h["count"],
            )
            for h in hook_det.get("hook_types", [])[:10]
        ]

        return CreatorCharts(
            views_over_time=self._views_over_time(videos),
            hook_distribution=hook_chart,
            keyword_frequency=[
                ChartPoint(label=k.keyword, value=float(k.avg_views), count=k.count)
                for k in keywords[:12]
            ],
            title_length_vs_views=title_length_vs_views_chart(videos),
            upload_frequency=self._upload_frequency(videos),
        )

    def _build_sections(
        self,
        creator_name: str,
        videos: list[VideoRead],
    ) -> CreatorPageSections:
        """Analytics cards: hooks, topics, keywords, patterns, top videos."""
        hook_det = self._hook_svc.compute_deterministic(videos)
        title_det = self._title_svc.compute_deterministic(videos)
        keywords = keyword_stats_from_titles(videos, 15)
        metrics = compute_base_metrics(videos)

        hook_analysis = HookAnalysis(
            hook_types=[HookTypeStat(**h) for h in hook_det.get("hook_types", [])[:10]],
            top_hooks=[h["hook_type"] for h in hook_det.get("hook_types", [])[:6]],
            curiosity_patterns=[PatternStat(**p) for p in hook_det.get("curiosity", [])[:6]],
            transformation_hooks=[
                PatternStat(**p) for p in hook_det.get("transformation", [])[:6]
            ],
            urgency_hooks=[PatternStat(**p) for p in hook_det.get("urgency", [])[:6]],
            avg_views=metrics.avg_views,
        )

        title_analysis = TitleAnalysis(
            top_patterns=[p["pattern"] for p in title_det.get("patterns", [])[:8]],
            emotional_keywords=_emotional_keywords(videos),
            best_performing_keywords=keywords[:10],
            common_structures=title_det.get("structures", [])[:8],
            avg_views=metrics.avg_views,
        )

        # Topic clusters = top keywords + profile topics merged in UI; here use keywords + hooks
        topic_clusters = _infer_topic_clusters(keywords, hook_det)

        content_patterns = [
            f"{p['pattern']} ({p['count']} videos, {p['avg_views']:,.0f} avg views)"
            for p in title_det.get("patterns", [])[:8]
        ]

        sorted_videos = sorted(videos, key=lambda v: v.views_count, reverse=True)

        return CreatorPageSections(
            top_videos=sorted_videos[:12],
            hook_analysis=hook_analysis,
            topic_clusters=topic_clusters,
            viral_keywords=keywords[:15],
            content_patterns=content_patterns,
            title_structures=title_det.get("structures", [])[:8],
            title_analysis=title_analysis,
            best_hook_types=hook_analysis.hook_types[:8],
        )

    @staticmethod
    def _views_over_time(videos: list[VideoRead]) -> list[ChartPoint]:
        """Average views per publish month (views over time proxy)."""
        buckets: dict[str, list[int]] = defaultdict(list)
        for video in videos:
            if not video.published_at:
                continue
            label = video.published_at.strftime("%Y-%m")
            buckets[label].append(video.views_count)

        ordered = sorted(buckets.keys())
        return [
            ChartPoint(
                label=label,
                value=round(sum(buckets[label]) / len(buckets[label]), 1),
                count=len(buckets[label]),
            )
            for label in ordered
        ]

    @staticmethod
    def _upload_frequency(videos: list[VideoRead]) -> list[ChartPoint]:
        """Video count per month — upload cadence."""
        counts: dict[str, int] = defaultdict(int)
        for video in videos:
            if not video.published_at:
                continue
            counts[video.published_at.strftime("%Y-%m")] += 1

        return [
            ChartPoint(label=label, value=float(count), count=count)
            for label, count in sorted(counts.items())
        ]

    @staticmethod
    def _upload_timeline(videos: list[VideoRead]) -> list[ChartPoint]:
        """Same as upload frequency — used in overview strip."""
        return CreatorPageService._upload_frequency(videos)


def _emotional_keywords(videos: list[VideoRead]) -> list[str]:
    """Unique emotional words found across creator titles."""
    seen: set[str] = set()
    for video in videos:
        feat = extract_title_features(video.title)
        for word in feat.emotional_words:
            seen.add(word)
    return sorted(seen)[:12]


def _infer_topic_clusters(
    keywords: list[KeywordStat],
    hook_det: dict,
) -> list[str]:
    """
    Lightweight topic clusters from top keywords + dominant hooks.

    No ML clustering — fast keyword + hook fusion for the UI.
    """
    clusters: list[str] = []
    for kw in keywords[:6]:
        clusters.append(f"{kw.keyword.title()} ({kw.count} videos)")
    for hook in hook_det.get("hook_types", [])[:4]:
        tag = hook["hook_type"].replace("curiosity:", "").replace("transformation:", "")
        label = f"Hook: {tag} ({hook['count']}×)"
        if label not in clusters:
            clusters.append(label)
    return clusters[:10]
