"""Request/response for Chrome extension comments ingestion.

Schema is backward-compatible. Older extensions (≤ v0.2.7) send `likes` only;
newer extensions (≥ v0.2.8) send the full structured payload — extra metadata
fields are optional and fall back to safe defaults.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class CommentIngestItem(BaseModel):
    """One YouTube comment from the extension parser.

    Legacy field `likes` is preserved; new clients may send `likes_count`
    instead. Both map to the same value (likes_count wins if both provided).
    """

    author: str = Field(default="", max_length=255)
    # No max_length — long comments; DB column is Text.
    text: str = Field(..., min_length=2)
    # Legacy alias retained for v0.2.6 / v0.2.7 extensions.
    likes: int = Field(default=0, ge=0)
    likes_count: int = Field(default=0, ge=0)
    reply_count: int = Field(default=0, ge=0)
    published_at: datetime | None = None
    published_text: str | None = Field(default=None, max_length=64)
    is_pinned: bool = False
    is_hearted: bool = False

    @model_validator(mode="before")
    @classmethod
    def _merge_legacy_likes(cls, values: Any) -> Any:
        if isinstance(values, dict):
            legacy = values.get("likes")
            modern = values.get("likes_count")
            if modern in (None, 0) and legacy not in (None, 0):
                values["likes_count"] = legacy
            elif modern not in (None, 0) and legacy in (None, 0):
                values["likes"] = modern
        return values


class CommentsIngestRequest(BaseModel):
    video_url: str = Field(..., min_length=10, max_length=512)
    title: str = Field(..., min_length=1, max_length=2000)
    creator: str = Field(..., min_length=1, max_length=255)
    comments: list[CommentIngestItem] = Field(..., min_length=1, max_length=20)


class CommentsIngestResponse(BaseModel):
    video_id: int | None = None
    matched: bool
    comments_saved: int
    message: str
    sheets_rows_updated: int = 0
    sheets_writeback: str = "skipped"
    sheets_message: str | None = None
