"""Cached audience intelligence per video.

One row per video — regeneration replaces the row in place (upsert). No
background jobs; refresh is driven by the API endpoint with `?refresh=true`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AudienceInsight(Base):
    """Generated audience intelligence snapshot for a single video."""

    __tablename__ = "audience_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    top_topics: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    pain_points: Mapped[list[str]] = mapped_column(JSONB, default=list)
    desires: Mapped[list[str]] = mapped_column(JSONB, default=list)
    sentiment_distribution: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    top_comments_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    comment_count_at_generation: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    model_used: Mapped[str] = mapped_column(String(64), nullable=False, default="rules")
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
