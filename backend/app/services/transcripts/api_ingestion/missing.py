"""Shared predicate: videos without transcript text."""

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement

from app.models.video import Video


def missing_transcript_clause() -> ColumnElement[bool]:
    """True when transcript is NULL or empty string."""
    return or_(Video.transcript.is_(None), Video.transcript == "")


def video_has_transcript(video: Video) -> bool:
    return bool((video.transcript or "").strip())
