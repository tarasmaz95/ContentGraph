"""Transcript preview helper for Sheets write-back."""

from google_sheets.transcript_preview import (
    PREVIEW_MAX_CHARS,
    TRUNCATION_SUFFIX,
    build_transcript_preview,
)


def test_build_transcript_preview_collapses_whitespace() -> None:
    text, truncated = build_transcript_preview("hello   \n\n   world")
    assert text == "hello world"
    assert truncated is False


def test_build_transcript_preview_truncates_long_text() -> None:
    long_text = "a" * (PREVIEW_MAX_CHARS + 500)
    preview, truncated = build_transcript_preview(long_text)
    assert truncated is True
    assert preview.endswith(TRUNCATION_SUFFIX)
    assert len(preview) <= PREVIEW_MAX_CHARS + len(TRUNCATION_SUFFIX)


def test_build_transcript_preview_short_unchanged() -> None:
    text = "Short transcript body."
    preview, truncated = build_transcript_preview(text)
    assert preview == text
    assert truncated is False
