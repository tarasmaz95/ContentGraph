"""Pydantic schemas for Hook Intelligence API."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ChartPoint, HookTypeStat, PatternStat


class HookPatternRead(BaseModel):
    """One hook in the database."""

    id: int
    video_id: int | None = None
    hook_text: str
    hook_type: str
    creator_name: str
    views_count: int
    video_title: str
    effectiveness_score: float
    confidence_score: float
    keywords: list[str] = Field(default_factory=list)
    emotional_triggers: list[str] = Field(default_factory=list)
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class HookCharts(BaseModel):
    hook_type_distribution: list[ChartPoint] = Field(default_factory=list)
    avg_views_by_type: list[ChartPoint] = Field(default_factory=list)
    creator_hook_comparison: list[ChartPoint] = Field(default_factory=list)
    emotional_trigger_frequency: list[ChartPoint] = Field(default_factory=list)


class HookWorkspace(BaseModel):
    """Full /hooks page payload."""

    top_hooks: list[HookPatternRead] = Field(default_factory=list)
    viral_patterns: list[PatternStat] = Field(default_factory=list)
    best_performing: list[HookPatternRead] = Field(default_factory=list)
    categories: list[HookTypeStat] = Field(default_factory=list)
    emotional_triggers: list[PatternStat] = Field(default_factory=list)
    trends: list[str] = Field(default_factory=list)
    charts: HookCharts = Field(default_factory=HookCharts)
    total_hooks: int = 0


class HookSearchResult(BaseModel):
    """Semantic / keyword hook search hit."""

    pattern: HookPatternRead
    relevance: float = 0.0


class HookGenerateRequest(BaseModel):
    """Inputs for AI hook generator."""

    creator_name: str = ""
    topic: str = Field(..., min_length=2)
    hook_type: str = "curiosity"
    tone: str = "bold"


class HookGenerateResult(BaseModel):
    """10 AI-generated hook lines."""

    creator_name: str
    topic: str
    hook_type: str
    tone: str
    hooks: list[str] = Field(default_factory=list)
    style_notes: str = ""
    used_placeholder: bool = Field(
        default=False,
        description="True when OpenAI returned no hooks and placeholders were filled in.",
    )


class HookCompareRequest(BaseModel):
    """Compare creators or hook types."""

    creators: list[str] = Field(default_factory=list, max_length=4)
    hook_types: list[str] = Field(default_factory=list, max_length=6)


class HookCompareResult(BaseModel):
    """Side-by-side hook effectiveness comparison."""

    summary: str = ""
    creator_stats: list[dict] = Field(default_factory=list)
    hook_type_stats: list[HookTypeStat] = Field(default_factory=list)
    top_triggers: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class HookGenerationIntel(BaseModel):
    """Structured output for LangGraph hook_generation."""

    hooks: list[str] = Field(
        ...,
        min_length=10,
        max_length=10,
        description=(
            "Exactly 10 distinct YouTube title hooks. "
            "Each item is one complete hook line (no numbering inside the string)."
        ),
    )
    style_notes: str = Field(
        default="",
        description="One or two sentences explaining the style choices for these hooks.",
    )
    topic: str = ""
    hook_type: str = ""
    recommendations: list[str] = Field(default_factory=list)


class HookComparisonIntel(BaseModel):
    """Structured output for LangGraph hook_comparison."""

    summary: str = ""
    hook_type_stats: list[HookTypeStat] = Field(default_factory=list)
    creator_leaders: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


