"""Structured analytics schemas — Pydantic models for API and LangGraph state."""

from pydantic import BaseModel, Field

from app.schemas.common import ChartPoint, HookTypeStat, KeywordStat, PatternStat
from app.schemas.creator import CreatorComparisonResult, CreatorProfileIntel
from app.schemas.hooks import HookComparisonIntel, HookGenerationIntel
from app.schemas.scripts import ScriptAnalysisIntel, ScriptGenerationIntel
from app.schemas.video_intelligence import (
    AudienceAnalysisIntel,
    CommentsAnalysisIntel,
    TranscriptAnalysisIntel,
    VideoBreakdownIntel,
    ViralAnalysisIntel,
)

# Re-export shared types for backward compatibility
__all__ = [
    "KeywordStat",
    "PatternStat",
    "HookTypeStat",
    "ChartPoint",
]


class CreatorStat(BaseModel):
    creator_name: str
    video_count: int
    total_views: int
    avg_views: float


class AnalyticsMetrics(BaseModel):
    """Computed metrics passed through LangGraph state and chat responses."""

    total_videos: int = 0
    avg_views: float = 0
    median_views: float = 0
    max_views: int = 0
    avg_title_length: float = 0
    titles_with_numbers_pct: float = 0
    how_to_titles_pct: float = 0
    curiosity_titles_pct: float = 0
    emotional_titles_pct: float = 0


# --- Analysis-type structured outputs ---


class TitleAnalysis(BaseModel):
    top_patterns: list[str] = Field(default_factory=list)
    emotional_keywords: list[str] = Field(default_factory=list)
    best_performing_keywords: list[KeywordStat] = Field(default_factory=list)
    common_structures: list[str] = Field(default_factory=list)
    avg_views: float = 0
    recommendations: list[str] = Field(default_factory=list)


class CreatorAnalysis(BaseModel):
    creator_name: str = ""
    top_topics: list[str] = Field(default_factory=list)
    best_hooks: list[str] = Field(default_factory=list)
    content_style: str = ""
    avg_views: float = 0
    top_performing_titles: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class TrendAnalysis(BaseModel):
    trending_topics: list[str] = Field(default_factory=list)
    rising_keywords: list[KeywordStat] = Field(default_factory=list)
    fastest_growing_creators: list[str] = Field(default_factory=list)
    viral_patterns: list[str] = Field(default_factory=list)


class HookAnalysis(BaseModel):
    hook_types: list[HookTypeStat] = Field(default_factory=list)
    top_hooks: list[str] = Field(default_factory=list)
    curiosity_patterns: list[PatternStat] = Field(default_factory=list)
    transformation_hooks: list[PatternStat] = Field(default_factory=list)
    urgency_hooks: list[PatternStat] = Field(default_factory=list)
    avg_views: float = 0
    recommendations: list[str] = Field(default_factory=list)


class StructuredAnalytics(BaseModel):
    """One active analysis payload + shared metrics (chat + graph state)."""

    analysis_type: str
    metrics: AnalyticsMetrics = Field(default_factory=AnalyticsMetrics)
    title: TitleAnalysis | None = None
    creator: CreatorAnalysis | None = None
    trend: TrendAnalysis | None = None
    hook: HookAnalysis | None = None
    # Creator intelligence layer
    creator_profile: CreatorProfileIntel | None = None
    creator_comparison: CreatorComparisonResult | None = None
    # Hook intelligence layer
    hook_generation: HookGenerationIntel | None = None
    hook_comparison: HookComparisonIntel | None = None
    script_generation: ScriptGenerationIntel | None = None
    script_analysis: ScriptAnalysisIntel | None = None
    video_breakdown: VideoBreakdownIntel | None = None
    transcript_analysis: TranscriptAnalysisIntel | None = None
    viral_analysis: ViralAnalysisIntel | None = None
    audience_analysis: AudienceAnalysisIntel | None = None
    comments_analysis: CommentsAnalysisIntel | None = None


# --- Dashboard / charts ---


class DashboardCharts(BaseModel):
    views_distribution: list[ChartPoint] = Field(default_factory=list)
    keyword_frequency: list[ChartPoint] = Field(default_factory=list)
    creator_comparison: list[ChartPoint] = Field(default_factory=list)
    hook_type_distribution: list[ChartPoint] = Field(default_factory=list)
    title_length_vs_views: list[ChartPoint] = Field(default_factory=list)


class DashboardAnalytics(BaseModel):
    """Aggregate analytics for /analytics page and dashboard cards."""

    metrics: AnalyticsMetrics
    top_patterns: list[str] = Field(default_factory=list)
    viral_keywords: list[KeywordStat] = Field(default_factory=list)
    best_hook_types: list[HookTypeStat] = Field(default_factory=list)
    top_creators: list[CreatorStat] = Field(default_factory=list)
    trending_topics: list[str] = Field(default_factory=list)
    charts: DashboardCharts = Field(default_factory=DashboardCharts)
    title_analysis: TitleAnalysis = Field(default_factory=TitleAnalysis)
    hook_analysis: HookAnalysis = Field(default_factory=HookAnalysis)
    trend_analysis: TrendAnalysis = Field(default_factory=TrendAnalysis)
