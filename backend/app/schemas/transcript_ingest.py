"""Request/response for Chrome extension transcript ingestion."""

from pydantic import BaseModel, Field


class TranscriptIngestRequest(BaseModel):
    video_url: str = Field(..., min_length=10, max_length=512)
    title: str = Field(..., min_length=1, max_length=2000)
    creator: str = Field(..., min_length=1, max_length=255)
    # No max_length — long videos (3–12h) can exceed 500k chars; DB column is Text.
    transcript_text: str = Field(..., min_length=20)


class TranscriptIngestResponse(BaseModel):
    video_id: int | None = None
    matched: bool
    transcript_saved: bool
    embedding_created: bool
    transcript_chars: int
    message: str
    sheets_rows_updated: int = 0
    sheets_writeback: str = "skipped"
    sheets_message: str | None = None
    full_transcript_url: str | None = None
