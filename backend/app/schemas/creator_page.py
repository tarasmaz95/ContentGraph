"""Schemas for creator intelligence pages — overview, sections, charts."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.analytics import (
    ChartPoint,
    HookAnalysis,
    HookTypeStat,
    KeywordStat,
    TitleAnalysis,
)
from app.schemas.creator import CreatorProfileRead
from app.schemas.video import VideoRead


class TopVideoSummary(BaseModel):
    """Best-performing video for creator overview header."""

    id: int
    title: str
    views_count: int
    published_at: datetime | None = None


class CreatorOverview(BaseModel):
    """High-level stats shown at top of creator page."""

    creator_name: str
    slug: str
    subscribers_count: int = 0
    channel_url: str = ""
    total_videos: int = 0
    avg_views: float = 0
    total_views: int = 0
    top_video: TopVideoSummary | None = None
    upload_timeline: list[ChartPoint] = Field(default_factory=list)


class CreatorCharts(BaseModel):
    """Recharts data — creator-scoped only."""

    views_over_time: list[ChartPoint] = Field(default_factory=list)
    hook_distribution: list[ChartPoint] = Field(default_factory=list)
    keyword_frequency: list[ChartPoint] = Field(default_factory=list)
    title_length_vs_views: list[ChartPoint] = Field(default_factory=list)
    upload_frequency: list[ChartPoint] = Field(default_factory=list)


class CreatorPageSections(BaseModel):
    """Deterministic analytics blocks for the creator page."""

    top_videos: list[VideoRead] = Field(default_factory=list)
    hook_analysis: HookAnalysis = Field(default_factory=HookAnalysis)
    topic_clusters: list[str] = Field(default_factory=list)
    viral_keywords: list[KeywordStat] = Field(default_factory=list)
    content_patterns: list[str] = Field(default_factory=list)
    title_structures: list[str] = Field(default_factory=list)
    title_analysis: TitleAnalysis = Field(default_factory=TitleAnalysis)
    best_hook_types: list[HookTypeStat] = Field(default_factory=list)


class CreatorPageAnalytics(BaseModel):
    """
    Full payload for GET /creators/{name}/analytics.

    Combines overview metrics, chart series, and section cards.
    """

    overview: CreatorOverview
    charts: CreatorCharts = Field(default_factory=CreatorCharts)
    sections: CreatorPageSections = Field(default_factory=CreatorPageSections)


class CreatorPageBundle(BaseModel):
    """Profile + analytics in one response (optional convenience)."""

    profile: CreatorProfileRead | None = None
    analytics: CreatorPageAnalytics
