"""Schemas for AI Copilot — proactive insights, briefs, feed, suggestions."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class SmartInsight(BaseModel):
    """One proactive, scannable insight for the copilot panel."""

    id: str
    text: str
    category: str  # hooks | audience | trend | creator | video
    priority: str = "medium"  # high | medium | low
    href: str | None = None
    # Structured fields for dynamic UI (optional — text remains for backwards compat)
    hook_type: str | None = None
    outperform_pct: int | None = None
    avg_views: int | None = None
    baseline_avg_views: int | None = None
    pattern_count: int | None = None
    topic: str | None = None
    keyword: str | None = None
    keyword_video_count: int | None = None
    creator_name: str | None = None


class CopilotRecommendation(BaseModel):
    """Actionable next step — video, hook, topic, or analysis."""

    label: str
    description: str
    href: str
    kind: str  # video | hook | topic | analysis | creator


class AIBrief(BaseModel):
    """Short scannable summary — creator, video, audience, or trend."""

    brief_type: str
    title: str
    headline: str
    bullets: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    catalog_total: int | None = None
    sample_size: int | None = None


class CopilotPanelResponse(BaseModel):
    """Persistent sidebar payload — context-aware."""

    context: str
    smart_insights: list[SmartInsight] = Field(default_factory=list)
    recommendations: list[CopilotRecommendation] = Field(default_factory=list)
    brief: AIBrief | None = None
    catalog_video_count: int = 0
    hook_patterns_count: int = 0
    analytics_sample_size: int = 200


class FeedEvidenceVideo(BaseModel):
    """Supporting video row for briefing explainability."""

    video_id: int
    title: str
    creator_name: str
    views_count: int | None = None


class FeedItem(BaseModel):
    """Ranked research briefing signal — deterministic, explainable."""

    id: str
    category: str  # breakout | creator_growth | creator_strength | audience | hook_pattern
    section: str  # breakouts | creators | audience | hooks
    title: str
    summary: str  # metric line
    description: str = ""
    why_appeared: str = ""
    why_matters: str = ""
    href: str | None = None
    badge: str | None = None
    created_label: str = "Today"
    creator_name: str | None = None
    views_count: int | None = None
    video_count: int | None = None
    avg_views: int | None = None
    hook_type: str | None = None
    performance_ratio: float | None = None
    audience_theme: str | None = None
    # Scoring (0–1)
    confidence_score: float = 0.0
    importance_score: float = 0.0
    actionability_score: float = 0.0
    freshness_score: float = 0.0
    final_score: float = 0.0
    # Evidence
    evidence_count: int = 0
    supporting_videos: list[FeedEvidenceVideo] = Field(default_factory=list)
    supporting_creators: list[str] = Field(default_factory=list)
    time_window: str = "catalog"
    snapshot_days: int | None = None
    # Legacy — unused by briefing feed
    keyword: str | None = None


class FeedBriefingMeta(BaseModel):
    """How the briefing was built — transparency for trust."""

    signals_considered: int = 0
    signals_selected: int = 0
    min_final_score: float = 0.42
    snapshot_date_latest: str | None = None
    snapshot_days_max: int | None = None
    comment_count: int = 0
    has_snapshot_history: bool = False


class IntelligenceFeedResponse(BaseModel):
    items: list[FeedItem] = Field(default_factory=list)
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    catalog_video_count: int = 0
    briefing: FeedBriefingMeta = Field(default_factory=FeedBriefingMeta)
    # Deprecated — always 0; keywords removed from feed
    keyword_sample_size: int = 0


class PersonalizationInput(BaseModel):
    """
    Lightweight client-side signals (localStorage).

    No user accounts — session-local preferences only.
    """

    recent_searches: list[str] = Field(default_factory=list)
    viewed_creators: list[str] = Field(default_factory=list)
    saved_tags: list[str] = Field(default_factory=list)
    viewed_video_ids: list[int] = Field(default_factory=list)


class ResearchAssistantHints(BaseModel):
    """Related research suggestions for /research."""

    related_insights: list[str] = Field(default_factory=list)
    suggested_tags: list[str] = Field(default_factory=list)
    related_creators: list[str] = Field(default_factory=list)
    related_video_ids: list[int] = Field(default_factory=list)
