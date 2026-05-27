"""Pydantic schemas for the Audience Intelligence layer.

Distinct from `CommentsIntelligence` (which is computed on every page load).
These objects are **persisted** in the `audience_insights` table and refreshed
lazily via the dedicated endpoint.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AudienceTopic(BaseModel):
    """One topic detected in the comments — `weight` is a relative score."""

    label: str
    weight: float = 0.0


class AudienceSentimentDistribution(BaseModel):
    """Percentage breakdown across coarse sentiment buckets."""

    positive: float = 0.0
    neutral: float = 0.0
    negative: float = 0.0


class AudienceComment(BaseModel):
    """Minimal comment snapshot stored alongside the insight.

    We avoid full `CommentRead` here so the cached blob stays compact and
    survives DB row deletes (snapshot is self-contained).
    """

    id: int | None = None
    author: str = ""
    text: str
    likes_count: int = 0
    reply_count: int = 0
    is_pinned: bool = False
    is_hearted: bool = False
    score: int = 0
    sentiment: str = "neutral"
    published_text: str | None = None


class AudienceInsights(BaseModel):
    """Persisted audience intelligence for a single video."""

    video_id: int
    summary: str = ""
    top_topics: list[AudienceTopic] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    desires: list[str] = Field(default_factory=list)
    sentiment_distribution: AudienceSentimentDistribution = Field(
        default_factory=AudienceSentimentDistribution
    )
    top_comments: list[AudienceComment] = Field(default_factory=list)
    comment_count_at_generation: int = 0
    total_comments: int = 0
    model_used: str = "rules"
    generated_at: datetime | None = None
    # True when no cached row exists yet and refresh wasn't requested — UI
    # shows the empty-state CTA.
    is_empty: bool = False


class AudienceInsightsRefreshResponse(AudienceInsights):
    """Same shape as the GET response; explicit alias for future divergence."""

    pass
