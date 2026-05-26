"""Historical growth analytics API schemas."""

from datetime import date

from pydantic import BaseModel, Field


class CreatorGrowthItem(BaseModel):
    creator_name: str
    youtube_channel_id: str = ""
    subscribers_now: int = 0
    subscribers_delta_7d: int = 0
    subscribers_delta_30d: int = 0
    growth_7d_pct: float = 0.0
    growth_30d_pct: float = 0.0
    total_views_now: int = 0
    views_delta_7d: int = 0
    velocity_views_per_day: float = 0.0
    snapshot_days: int = 0


class CreatorGrowthResponse(BaseModel):
    items: list[CreatorGrowthItem] = Field(default_factory=list)
    snapshot_date_latest: date | None = None


class VideoBreakoutItem(BaseModel):
    video_id: int
    title: str = ""
    creator_name: str = ""
    views_now: int = 0
    views_delta_7d: int = 0
    growth_7d_pct: float = 0.0
    velocity_views_per_day: float = 0.0
    breakout_score: float = 0.0


class VideoBreakoutsResponse(BaseModel):
    items: list[VideoBreakoutItem] = Field(default_factory=list)


class VelocityItem(BaseModel):
    video_id: int
    title: str = ""
    creator_name: str = ""
    views_now: int = 0
    velocity_views_per_day: float = 0.0
    views_delta_7d: int = 0


class VelocityResponse(BaseModel):
    items: list[VelocityItem] = Field(default_factory=list)

