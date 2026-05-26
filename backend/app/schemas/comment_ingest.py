"""Request/response for Chrome extension comments ingestion."""

from pydantic import BaseModel, Field


class CommentIngestItem(BaseModel):
    author: str = Field(default="", max_length=255)
    text: str = Field(..., min_length=2, max_length=4000)
    likes: int = Field(default=0, ge=0)


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
