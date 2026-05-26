"""Header → field mapping for Sheets sync (deterministic)."""

from __future__ import annotations

# field -> lowercase header aliases (first match wins)
FIELD_ALIASES: dict[str, list[str]] = {
    "creator_name": [
        "name",
        "creator",
        "channel",
        "channel name",
        "youtuber",
    ],
    "channel_url": ["url", "channel url", "channel link"],
    "video_url": ["video url", "video link", "watch url", "watch link"],
    "subscribers_count": ["subscribers", "subs", "subscriber count"],
    "title": ["titles", "title", "video title", "video"],
    "views_count": ["views", "view count"],
    "published_at_raw": ["date", "published", "published at", "upload date"],
    "transcript": ["transcript", "transcripts", "transcription"],
    "comments": ["comments", "comment", "top comments", "youtube comments"],
    "full_transcript_url": [
        "full transcript",
        "full_transcript",
        "full transcript url",
        "transcript url",
        "tm1 transcript",
    ],
}

FULL_TRANSCRIPT_HEADER = "Full Transcript"

REQUIRED_FIELDS = ("creator_name", "title")


def normalize_header(cell: str) -> str:
    return cell.strip().lower()


def detect_column_mapping(headers: list[str]) -> dict[str, str]:
    """
    Map logical fields to the actual header label from the sheet.

    Returns {field: original_header} for matched columns only.
    """
    normalized = [normalize_header(h) for h in headers]
    mapping: dict[str, str] = {}

    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                idx = normalized.index(alias)
                mapping[field] = headers[idx].strip()
                break

    return mapping


def column_index_from_mapping(
    headers: list[str],
    mapping: dict[str, str],
) -> dict[str, int]:
    """Build column indices using explicit header picks (settings overrides)."""
    normalized = [normalize_header(h) for h in headers]
    index: dict[str, int] = {}

    for field, header_label in mapping.items():
        key = normalize_header(header_label)
        if key in normalized:
            index[field] = normalized.index(key)

    return index


def validate_mapping(headers: list[str], mapping: dict[str, str]) -> list[str]:
    """Return list of missing required fields."""
    index = column_index_from_mapping(headers, mapping)
    missing = [f for f in REQUIRED_FIELDS if f not in index]
    return missing
