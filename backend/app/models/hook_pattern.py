"""HookPattern — indexed viral hooks from titles and transcripts."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HookPattern(Base):
    """
    One extracted hook instance linked to a video.

    Rebuilt on Sheets sync via HookExtractionService.
    """

    __tablename__ = "hook_patterns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    hook_text: Mapped[str] = mapped_column(Text, nullable=False)
    hook_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    creator_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    views_count: Mapped[int] = mapped_column(BigInteger, default=0)
    video_title: Mapped[str] = mapped_column(Text, nullable=False)
    effectiveness_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    keywords: Mapped[list] = mapped_column(JSONB, default=list)
    emotional_triggers: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
