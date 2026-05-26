"""Unit tests for API transcript ingestion helpers."""

from app.models.video import Video
from app.services.transcripts.api_ingestion.missing import video_has_transcript


def test_video_has_transcript() -> None:
    v = Video(
        creator_name="A",
        channel_url="https://youtube.com/@a",
        video_url="https://www.youtube.com/watch?v=abcdefghijk",
        title="T",
    )
    assert video_has_transcript(v) is False
    v.transcript = None
    assert video_has_transcript(v) is False
    v.transcript = ""
    assert video_has_transcript(v) is False
    v.transcript = "   "
    assert video_has_transcript(v) is False
    v.transcript = "Hello world"
    assert video_has_transcript(v) is True
