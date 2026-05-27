"""YouTube comment — audience reactions linked to a video.

Structured per-row storage. Each comment is its own row with explicit columns
for likes / replies / author / pinned / hearted, plus the legacy `comment_text`
that downstream code (semantic search, Sheets writeback, intelligence) keeps
reading. New metadata fields are additive and default to safe zero values so
older rows continue to work.
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Comment(Base):
    """
    Top YouTube comment on a synced video.

    Fetched via YouTube Data API (relevance order, max ~25 per video) or via the
    Chrome extension (Top sort, capped at 20, sorted by likes desc on save).
    """

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    author_name: Mapped[str] = mapped_column(String(255), default="")
    likes_count: Mapped[int] = mapped_column(BigInteger, default=0)
    # Number of direct replies on the comment thread (0 when no replies).
    reply_count: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    # Exact UTC timestamp when known (e.g. YouTube Data API). Extension fills it
    # only when YouTube exposes ISO time; otherwise relative `published_text` is set.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Relative time string as shown by YouTube ("2 days ago"). Best-effort, optional.
    published_text: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Pinned / hearted flags as displayed under the comment.
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    is_hearted: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    # Persisted composite ranking — set on every insert via compute_comment_score.
    # Indexed (video_id, comment_score DESC) for fast top-N audience queries.
    comment_score: Mapped[int] = mapped_column(
        BigInteger, default=0, server_default="0", nullable=False, index=False
    )
    sentiment: Mapped[str] = mapped_column(String(32), default="neutral", index=True)
    emotional_tags: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
