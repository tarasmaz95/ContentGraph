"""Pydantic schemas for creator intelligence API and LangGraph."""

from datetime import datetime

from pydantic import BaseModel, Field


class CreatorProfileRead(BaseModel):
    """Public creator profile returned by API."""

    creator_name: str
    content_style: str = ""
    top_topics: list[str] = Field(default_factory=list)
    hook_patterns: list[str] = Field(default_factory=list)
    communication_style: str = ""
    emotional_triggers: list[str] = Field(default_factory=list)
    audience_type: str = ""
    creator_summary: str = ""
    avg_views: float = 0
    total_videos: int = 0
    total_views: int = 0
    updated_at: datetime | None = None


class CreatorProfileIntel(BaseModel):
    """Structured creator intelligence for chat / LangGraph state."""

    creator_name: str
    content_style: str = ""
    top_topics: list[str] = Field(default_factory=list)
    hook_patterns: list[str] = Field(default_factory=list)
    communication_style: str = ""
    emotional_triggers: list[str] = Field(default_factory=list)
    audience_type: str = ""
    creator_summary: str = ""
    strategic_insights: list[str] = Field(default_factory=list)
    avg_views: float = 0
    total_videos: int = 0


class CreatorComparisonRequest(BaseModel):
    creators: list[str] = Field(..., min_length=2, max_length=4)


class CreatorComparisonResult(BaseModel):
    """Side-by-side creator comparison output."""

    creators: list[str]
    summary: str = ""
    style_comparison: str = ""
    hook_comparison: list[str] = Field(default_factory=list)
    topic_comparison: list[str] = Field(default_factory=list)
    positioning_comparison: list[str] = Field(default_factory=list)
    communication_comparison: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class CreatorListItem(BaseModel):
    """Summary row for /creators listing."""

    creator_name: str
    total_videos: int
    avg_views: float
    has_profile: bool
    creator_summary: str = ""
