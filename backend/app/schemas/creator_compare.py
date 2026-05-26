"""Creator A vs B compare — deterministic, reuses intelligence payloads."""

from pydantic import BaseModel, Field

from app.schemas.analytics import ChartPoint
from app.schemas.creator_intelligence import (
    CreatorAudienceIntel,
    CreatorGrowthIntel,
    CreatorHookIntel,
    CreatorIntelligence,
    CreatorMomentumIntel,
)
from app.schemas.growth import VideoBreakoutItem


class CreatorCompareOverviewRow(BaseModel):
    """One metric row in the overview table."""

    signal: str
    value_a: str
    value_b: str
    winner: str | None = None  # "a", "b", or None for tie


class TitleBattleItem(BaseModel):
    video_id: int
    title: str
    views_count: int
    hook_type: str
    title_length: int
    curiosity_score: int  # count of curiosity tags (0–3+)


class SemanticOverlapCompare(BaseModel):
    shared_themes: list[str] = Field(default_factory=list)
    unique_a: list[str] = Field(default_factory=list)
    unique_b: list[str] = Field(default_factory=list)
    overlap_score: float = 0.0
    summary: str = ""


class GrowthCompareSeries(BaseModel):
    """Aligned dates for overlay charts."""

    subscriber_overlay: list[ChartPoint] = Field(default_factory=list)
    views_overlay: list[ChartPoint] = Field(default_factory=list)
    # value = A, count = B (recharts dual series hack) — use dedicated points instead
    subscriber_a: list[ChartPoint] = Field(default_factory=list)
    subscriber_b: list[ChartPoint] = Field(default_factory=list)
    views_a: list[ChartPoint] = Field(default_factory=list)
    views_b: list[ChartPoint] = Field(default_factory=list)


class CreatorCompareResult(BaseModel):
    creator_a: str
    creator_b: str
    intelligence_a: CreatorIntelligence
    intelligence_b: CreatorIntelligence
    overview_rows: list[CreatorCompareOverviewRow] = Field(default_factory=list)
    growth_compare: GrowthCompareSeries = Field(default_factory=GrowthCompareSeries)
    semantic_overlap: SemanticOverlapCompare = Field(default_factory=SemanticOverlapCompare)
    title_battle_a: list[TitleBattleItem] = Field(default_factory=list)
    title_battle_b: list[TitleBattleItem] = Field(default_factory=list)
    momentum_winner: str | None = None
    growth_winner: str | None = None
    hooks_winner: str | None = None
