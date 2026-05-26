"""Video entity — mirrors a row from the Google Sheets YouTube dataset."""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

_EMBED_DIM = 1536


class Video(Base):
    """
    One YouTube video row synced from Sheets.

    title_embedding / transcript_embedding: pgvector semantic search.
    """

    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    creator_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    channel_url: Mapped[str] = mapped_column(String(512), nullable=False)
    video_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    subscribers_count: Mapped[int] = mapped_column(BigInteger, default=0)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    views_count: Mapped[int] = mapped_column(BigInteger, default=0, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    title_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(_EMBED_DIM),
        nullable=True,
    )

    # Full transcript text (youtube-transcript-api)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Embedding of transcript for semantic retrieval
    transcript_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(_EMBED_DIM),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
