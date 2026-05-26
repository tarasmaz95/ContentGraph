"""Preview text for Google Sheets Transcript column (not full DB text)."""

from __future__ import annotations

PREVIEW_MAX_CHARS = 10_000
TRUNCATION_SUFFIX = "... [Open full transcript in tm1]"


def build_transcript_preview(text: str) -> tuple[str, bool]:
    """
    Clean whitespace and cap length for Sheets preview column.

    Returns (preview_text, was_truncated).
    """
    cleaned = " ".join((text or "").split())
    if not cleaned:
        return "", False

    max_body = PREVIEW_MAX_CHARS - len(TRUNCATION_SUFFIX)
    if len(cleaned) <= PREVIEW_MAX_CHARS:
        return cleaned, False

    truncated = cleaned[: max(0, max_body)].rstrip()
    return truncated + TRUNCATION_SUFFIX, True
