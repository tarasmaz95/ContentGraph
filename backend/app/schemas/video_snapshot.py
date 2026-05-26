"""Serializable video row for LangGraph state."""

from typing import TypedDict


class VideoSnapshot(TypedDict, total=False):
    id: int
    creator_name: str
    channel_url: str
    title: str
    views_count: int
    subscribers_count: int
    published_at: str | None
    has_transcript: bool
    transcript_snippet: str | None
    match_source: str | None
    similarity_score: float | None
