"""Creator intelligence dashboard — growth, hooks, audience, semantic, momentum."""

from datetime import date

from pydantic import BaseModel, Field

from app.schemas.analytics import ChartPoint, HookAnalysis, KeywordStat
from app.schemas.comments import CommentRead
from app.schemas.creator_page import CreatorOverview, CreatorPageSections
from app.schemas.growth import VideoBreakoutItem
from app.schemas.video import VideoRead


class CreatorGrowthMetrics(BaseModel):
    """Point-in-time growth from snapshots."""

    growth_7d_pct: float = 0.0
    growth_30d_pct: float = 0.0
    subscribers_delta_7d: int = 0
    views_delta_7d: int = 0
    velocity_views_per_day: float = 0.0
    snapshot_days: int = 0
    accelerating: bool = False
    slowing: bool = False


class CreatorGrowthIntel(BaseModel):
    metrics: CreatorGrowthMetrics = Field(default_factory=CreatorGrowthMetrics)
    subscriber_history: list[ChartPoint] = Field(default_factory=list)
    views_history: list[ChartPoint] = Field(default_factory=list)
    upload_momentum: list[ChartPoint] = Field(default_factory=list)
    latest_snapshot_date: date | None = None


class CreatorHookMix(BaseModel):
    """Title hook mix percentages for one creator."""

    curiosity_pct: float = 0.0
    transformation_pct: float = 0.0
    urgency_pct: float = 0.0
    numbers_pct: float = 0.0
    emotional_pct: float = 0.0
    authority_pct: float = 0.0
    how_to_pct: float = 0.0
    identity_pct: float = 0.0


class CreatorHookIntel(BaseModel):
    mix: CreatorHookMix = Field(default_factory=CreatorHookMix)
    analysis: HookAnalysis = Field(default_factory=HookAnalysis)
    best_performing_hooks: list[str] = Field(default_factory=list)


class CreatorAudienceIntel(BaseModel):
    total_comments: int = 0
    top_comments: list[CommentRead] = Field(default_factory=list)
    repeated_phrases: list[str] = Field(default_factory=list)
    emotional_patterns: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    top_reactions: list[str] = Field(default_factory=list)


class NearestCreator(BaseModel):
    creator_name: str
    overlap_score: float = 0.0
    shared_topics: list[str] = Field(default_factory=list)


class CreatorSemanticIntel(BaseModel):
    dominant_keywords: list[KeywordStat] = Field(default_factory=list)
    themes: list[str] = Field(default_factory=list)
    positioning_summary: str = ""
    nearest_creators: list[NearestCreator] = Field(default_factory=list)


class CreatorMomentumIntel(BaseModel):
    breakout_videos: list[VideoBreakoutItem] = Field(default_factory=list)
    fastest_growing: list[VideoBreakoutItem] = Field(default_factory=list)
    latest_uploads: list[VideoRead] = Field(default_factory=list)


class CreatorIntelligence(BaseModel):
    """Full GET /creators/{name}/intelligence payload."""

    overview: CreatorOverview
    growth: CreatorGrowthIntel = Field(default_factory=CreatorGrowthIntel)
    hooks: CreatorHookIntel = Field(default_factory=CreatorHookIntel)
    audience: CreatorAudienceIntel = Field(default_factory=CreatorAudienceIntel)
    semantic: CreatorSemanticIntel = Field(default_factory=CreatorSemanticIntel)
    momentum: CreatorMomentumIntel = Field(default_factory=CreatorMomentumIntel)
    sections: CreatorPageSections = Field(default_factory=CreatorPageSections)
