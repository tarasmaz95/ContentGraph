"""Dashboard analytics — aggregate all videos for /analytics page."""

from collections import defaultdict

from app.schemas.analytics import (
    ChartPoint,
    DashboardAnalytics,
    DashboardCharts,
    HookAnalysis,
    HookTypeStat,
    PatternStat,
    TitleAnalysis,
    TrendAnalysis,
)
from app.schemas.video import VideoRead
from app.services.analytics.catalog_metrics import fetch_catalog_metrics
from app.services.analytics._video_data import (
    creator_stats,
    keyword_stats_from_titles,
    title_length_vs_views_chart,
    views_distribution_chart,
)
from app.services.analytics.hook_analytics import HookAnalyticsService
from app.services.analytics.pattern_detection import extract_title_features
from app.services.analytics.title_analytics import TitleAnalyticsService
from app.services.analytics.trend_analytics import TrendAnalyticsService
from app.services.video_service import VideoService


class DashboardAnalyticsService:
    """Builds full dashboard payload from Postgres (no LLM — fast load)."""

    def __init__(self, video_service: VideoService) -> None:
        self._videos = video_service
        self._title_svc = TitleAnalyticsService()
        self._hook_svc = HookAnalyticsService()
        self._trend_svc = TrendAnalyticsService()

    async def get_dashboard(self, charts_limit: int = 200) -> DashboardAnalytics:
        """Summary metrics = full catalog; charts/trends use top-N sample for speed."""
        metrics = await fetch_catalog_metrics(self._videos._db)

        videos, _ = await self._videos.list_videos(limit=charts_limit, offset=0)
        if not videos:
            return DashboardAnalytics(
                metrics=metrics,
                charts=DashboardCharts(),
            )
        keywords = keyword_stats_from_titles(videos, 12)
        creators = creator_stats(videos, 8)

        title_det = self._title_svc.compute_deterministic(videos)
        hook_det = self._hook_svc.compute_deterministic(videos)
        trend_det = self._trend_svc.compute_deterministic(videos)

        # Map deterministic output to schema objects for dashboard cards
        title_analysis = TitleAnalysis(
            top_patterns=[p["pattern"] for p in title_det.get("patterns", [])[:6]],
            emotional_keywords=_extract_emotional_keywords(videos),
            best_performing_keywords=keywords[:8],
            common_structures=title_det.get("structures", [])[:6],
            avg_views=metrics.avg_views,
            recommendations=_default_title_recommendations(title_det, metrics),
        )

        hook_analysis = HookAnalysis(
            hook_types=[HookTypeStat(**h) for h in hook_det.get("hook_types", [])[:8]],
            top_hooks=[h["hook_type"] for h in hook_det.get("hook_types", [])[:5]],
            curiosity_patterns=[PatternStat(**p) for p in hook_det.get("curiosity", [])[:5]],
            transformation_hooks=[
                PatternStat(**p) for p in hook_det.get("transformation", [])[:5]
            ],
            urgency_hooks=[PatternStat(**p) for p in hook_det.get("urgency", [])[:5]],
            avg_views=metrics.avg_views,
            recommendations=_default_hook_recommendations(hook_det),
        )

        trend_analysis = TrendAnalysis(
            trending_topics=_infer_topics(keywords),
            rising_keywords=keywords[:6],
            fastest_growing_creators=trend_det.get("rising_creators", []),
            viral_patterns=[f"\"{t}\"" for t in trend_det.get("viral_titles", [])[:5]],
        )

        hook_chart = [
            {"label": h["hook_type"], "value": float(h["avg_views"]), "count": h["count"]}
            for h in hook_det.get("hook_types", [])[:8]
        ]
        charts = DashboardCharts(
            views_distribution=views_distribution_chart(videos),
            keyword_frequency=[
                ChartPoint(label=k.keyword, value=float(k.count), count=k.count)
                for k in keywords[:10]
            ],
            creator_comparison=[
                ChartPoint(
                    label=c.creator_name,
                    value=c.avg_views,
                    count=c.video_count,
                )
                for c in creators[:8]
            ],
            hook_type_distribution=[
                ChartPoint(label=p["label"], value=p["value"], count=p["count"])
                for p in hook_chart
            ],
            title_length_vs_views=title_length_vs_views_chart(videos),
        )

        return DashboardAnalytics(
            metrics=metrics,
            top_patterns=title_analysis.top_patterns,
            viral_keywords=keywords[:10],
            best_hook_types=hook_analysis.hook_types,
            top_creators=creators,
            trending_topics=trend_analysis.trending_topics,
            charts=charts,
            title_analysis=title_analysis,
            hook_analysis=hook_analysis,
            trend_analysis=trend_analysis,
        )


def _extract_emotional_keywords(videos: list[VideoRead]) -> list[str]:
    counts: dict[str, int] = defaultdict(int)
    for video in videos:
        feat = extract_title_features(video.title)
        for word in feat.emotional_words:
            counts[word] += 1
    return [w for w, _ in sorted(counts.items(), key=lambda x: -x[1])[:10]]


def _infer_topics(keywords: list) -> list[str]:
    return [k.keyword for k in keywords[:8]]


def _default_title_recommendations(det: dict, metrics) -> list[str]:
    recs = []
    if metrics.how_to_titles_pct > 20:
        recs.append("How-to titles are common — test more specific outcomes in titles.")
    if metrics.titles_with_numbers_pct < 30:
        recs.append("Add numbers to titles — lists and metrics often boost CTR.")
    if det.get("patterns"):
        top = det["patterns"][0]
        recs.append(f"Strongest pattern: {top['pattern']} (avg {top['avg_views']:,.0f} views).")
    return recs[:4] or ["Sync more videos from Google Sheets for richer patterns."]


def _default_hook_recommendations(det: dict) -> list[str]:
    hooks = det.get("hook_types", [])
    if not hooks:
        return ["Add more videos to analyze hook performance."]
    best = max(hooks, key=lambda h: h["avg_views"])
    return [
        f"Best performing hook type: {best['hook_type']} ({best['avg_views']:,.0f} avg views).",
        "Test curiosity hooks (?, why, secret) on your next uploads.",
    ]
