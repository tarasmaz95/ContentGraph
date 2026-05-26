"""Pydantic schemas for Comments Intelligence."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ChartPoint


class CommentRead(BaseModel):
    """One stored YouTube comment."""

    id: int
    video_id: int
    comment_text: str
    author_name: str
    likes_count: int
    published_at: datetime | None = None
    sentiment: str
    emotional_tags: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class CommentCharts(BaseModel):
    """Recharts series for comments section on video page."""

    sentiment_distribution: list[ChartPoint] = Field(default_factory=list)
    emotional_triggers: list[ChartPoint] = Field(default_factory=list)
    question_frequency: list[ChartPoint] = Field(default_factory=list)
    recurring_phrases: list[ChartPoint] = Field(default_factory=list)


class CommentsIntelligence(BaseModel):
    """Audience intelligence payload for /videos/[id]."""

    total_comments: int = 0
    top_comments: list[CommentRead] = Field(default_factory=list)
    audience_reactions: list[str] = Field(default_factory=list)
    emotional_patterns: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    audience_desires: list[str] = Field(default_factory=list)
    confusion_points: list[str] = Field(default_factory=list)
    recurring_phrases: list[str] = Field(default_factory=list)
    positive_pct: float = 0.0
    negative_pct: float = 0.0
    neutral_pct: float = 0.0
    charts: CommentCharts = Field(default_factory=CommentCharts)
    summary: str = ""

