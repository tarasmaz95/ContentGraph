"""Pydantic schemas for video API responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VideoRead(BaseModel):
    """Public video shape for list, search, and semantic endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    creator_name: str
    channel_url: str
    video_url: str = ""
    subscribers_count: int
    title: str
    views_count: int
    published_at: datetime | None
    created_at: datetime

    has_transcript: bool = False
    transcript_preview: str | None = None

    # Semantic search scores (pgvector)
    similarity_score: float | None = None
    title_similarity: float | None = None
    transcript_similarity: float | None = None
    match_source: str | None = None  # title | transcript | both | keyword

    # LangGraph retrieval snippet
    transcript_snippet: str | None = None
    comment_snippet: str | None = None


class VideoDetail(VideoRead):
    """Single video — includes full transcript."""

    transcript: str | None = None


class CatalogStats(BaseModel):
    """Embedding coverage for runtime-aware UI copy."""

    video_count: int
    title_embedding_count: int
    transcript_embedding_count: int


class VideoListResponse(BaseModel):
    videos: list[VideoRead]
    total: int


class SyncResult(BaseModel):
    created: int
    updated: int
    total_rows: int
    embeddings_created: int = 0
    transcripts_fetched: int = 0
    transcript_embeddings_created: int = 0
    hooks_indexed: int = 0
    comments_fetched: int = 0
