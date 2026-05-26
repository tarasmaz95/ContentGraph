"""Schemas for AI chat endpoint — includes structured analytics."""

from pydantic import BaseModel, Field

from app.schemas.analytics import StructuredAnalytics


class ChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class VideoSnapshotOut(BaseModel):
    id: int
    creator_name: str
    title: str
    views_count: int
    subscribers_count: int
    has_transcript: bool = False
    transcript_snippet: str | None = None
    match_source: str | None = None
    similarity_score: float | None = None


class ChatResult(BaseModel):
    reply: str
    analysis_type: str
    relevant_videos: list[VideoSnapshotOut]
    insights: list[str]
    structured: StructuredAnalytics
    context_videos_used: int
    suggestions: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    analysis_type: str
    relevant_videos: list[VideoSnapshotOut]
    insights: list[str]
    structured: StructuredAnalytics
    context_videos_used: int
    suggestions: list[str] = Field(default_factory=list)
