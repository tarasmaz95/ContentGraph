"""Map ORM Video rows to API schemas with transcript previews."""

from app.core.config import get_settings
from app.models.video import Video
from app.schemas.video import VideoDetail, VideoRead
from app.services.transcripts.transcript_service import TranscriptService


def video_to_read(
    video: Video,
    *,
    similarity_score: float | None = None,
    title_similarity: float | None = None,
    transcript_similarity: float | None = None,
    match_source: str | None = None,
    transcript_snippet: str | None = None,
    comment_snippet: str | None = None,
    query_for_snippet: str = "",
) -> VideoRead:
    """Build VideoRead with optional semantic / transcript fields."""
    settings = get_settings()
    preview_len = settings.transcript_preview_chars

    transcript = video.transcript
    preview = None
    if transcript:
        preview = transcript[:preview_len]
        if len(transcript) > preview_len:
            preview += "…"

    snippet = transcript_snippet
    if not snippet and transcript and query_for_snippet:
        snippet = TranscriptService.extract_snippet(
            transcript, query_for_snippet, max_len=preview_len
        )

    return VideoRead(
        id=video.id,
        creator_name=video.creator_name,
        channel_url=video.channel_url,
        video_url=video.video_url or "",
        subscribers_count=video.subscribers_count,
        title=video.title,
        views_count=video.views_count,
        published_at=video.published_at,
        created_at=video.created_at,
        has_transcript=bool(transcript),
        transcript_preview=preview,
        similarity_score=similarity_score,
        title_similarity=title_similarity,
        transcript_similarity=transcript_similarity,
        match_source=match_source,
        transcript_snippet=snippet,
        comment_snippet=comment_snippet,
    )


def video_to_detail(video: Video) -> VideoDetail:
    """Full video payload including transcript text."""
    read = video_to_read(video)
    return VideoDetail(
        **read.model_dump(),
        transcript=video.transcript,
    )
