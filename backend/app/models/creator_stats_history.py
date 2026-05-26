"""Daily creator-level stats snapshot for growth analytics."""

from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CreatorStatsHistory(Base):
    """One row per creator per calendar day — sourced from synced catalog."""

    __tablename__ = "creator_stats_history"
    __table_args__ = (
        UniqueConstraint("creator_name", "snapshot_date", name="uq_creator_stats_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    creator_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    youtube_channel_id: Mapped[str] = mapped_column(String(128), default="", index=True)
    subscribers_count: Mapped[int] = mapped_column(BigInteger, default=0)
    total_views: Mapped[int] = mapped_column(BigInteger, default=0)
    total_videos: Mapped[int] = mapped_column(Integer, default=0)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
