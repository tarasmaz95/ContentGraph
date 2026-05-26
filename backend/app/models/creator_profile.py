"""CreatorProfile — AI-generated intelligence for a YouTube creator."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CreatorProfile(Base):
    """
    Creator-level intelligence stored in Postgres.

    Generated from aggregated videos, titles, transcripts, and hooks.
    One row per unique creator_name.
    """

    __tablename__ = "creator_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    creator_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    content_style: Mapped[str] = mapped_column(Text, default="")
    top_topics: Mapped[list] = mapped_column(JSONB, default=list)
    hook_patterns: Mapped[list] = mapped_column(JSONB, default=list)
    communication_style: Mapped[str] = mapped_column(Text, default="")
    emotional_triggers: Mapped[list] = mapped_column(JSONB, default=list)
    audience_type: Mapped[str] = mapped_column(Text, default="")
    creator_summary: Mapped[str] = mapped_column(Text, default="")

    avg_views: Mapped[float] = mapped_column(Float, default=0.0)
    total_videos: Mapped[int] = mapped_column(Integer, default=0)
    total_views: Mapped[int] = mapped_column(BigInteger, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
