"""Format structured comments for the Google Sheets Comments column.

Source of truth lives in PostgreSQL (`comments` table, structured columns).
This module produces the **derived human-readable view** for the legacy
single-cell Sheets column. Compatibility rules:

- Old payloads (only `author` + `text`) still work — they just render without
  badges or counts.
- Structured payloads (v0.2.8+) render with `(N likes, R replies)` plus
  optional `📌` / `❤️` creator-endorsement badges.

Format (one line per comment):

    [📌] [❤️] @author (1.2K likes, 42 replies): text…

Cap each comment body individually so a single huge comment cannot push out
the rest. Final blob is still bounded by `COMMENTS_SHEET_MAX_CHARS`.
"""

from __future__ import annotations

from typing import Any, Mapping

# Whole-cell cap (Google Sheets allows up to 50k chars/cell, but Excel /
# downstream tools choke on big blobs — keep the historical 10k limit).
COMMENTS_SHEET_MAX_CHARS = 10_000
TRUNCATION_SUFFIX = "... [more comments in ContentGraph]"

# Per-comment safety cap so one rant cannot dominate the cell.
PER_COMMENT_TEXT_MAX_CHARS = 500
PER_COMMENT_TRUNC = "…"

PINNED_BADGE = "📌"
HEARTED_BADGE = "❤️"


def _coerce_int(value: Any) -> int:
    """Best-effort int — accepts None, str, float, int. Returns 0 on garbage."""
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return 0


def _coerce_bool(value: Any) -> bool:
    """Treat truthy SQL/JSON values as True; everything else False."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"t", "true", "1", "yes", "y"}
    return False


def _format_count_short(n: int) -> str:
    """1234 → '1.2K', 12_300 → '12.3K', 1_500_000 → '1.5M'.

    Keeps small numbers literal so '84 likes' stays '84 likes'.
    """
    if n < 1_000:
        return str(n)
    if n < 1_000_000:
        value = n / 1_000.0
        # Drop the decimal when it would be `.0` (e.g. 12.0K → 12K).
        return f"{value:.1f}".rstrip("0").rstrip(".") + "K"
    value = n / 1_000_000.0
    return f"{value:.1f}".rstrip("0").rstrip(".") + "M"


def _truncate_text(text: str, limit: int = PER_COMMENT_TEXT_MAX_CHARS) -> str:
    """Safe unicode truncation — Python strs are codepoint-indexed already,
    so slicing never splits a multi-byte char. Add `…` only when we cut.
    """
    if len(text) <= limit:
        return text
    cut = text[: max(0, limit - len(PER_COMMENT_TRUNC))].rstrip()
    return cut + PER_COMMENT_TRUNC


def format_comment_for_sheet(comment: Mapping[str, Any]) -> str:
    """Render a single comment row as one Sheets line.

    Accepted keys (all optional except `text`):
        author, text,
        likes / likes_count,
        reply_count,
        is_pinned, is_hearted

    Returns "" when the comment has no usable text — caller filters it out.
    """
    text = str(comment.get("text") or "").strip()
    if not text:
        return ""

    author = str(comment.get("author") or "").strip() or "Anonymous"

    # Accept both legacy `likes` and structured `likes_count`.
    likes = _coerce_int(comment.get("likes_count"))
    if likes == 0:
        likes = _coerce_int(comment.get("likes"))
    replies = _coerce_int(comment.get("reply_count"))
    pinned = _coerce_bool(comment.get("is_pinned"))
    hearted = _coerce_bool(comment.get("is_hearted"))

    badges: list[str] = []
    if pinned:
        badges.append(PINNED_BADGE)
    if hearted:
        badges.append(HEARTED_BADGE)
    badge_prefix = (" ".join(badges) + " ") if badges else ""

    # Engagement suffix — show only what we actually have.
    parts: list[str] = []
    if likes > 0:
        parts.append(f"{_format_count_short(likes)} likes")
    if replies > 0:
        parts.append(f"{_format_count_short(replies)} replies")

    if parts:
        meta = f" ({', '.join(parts)})"
    else:
        # Pre-structured payloads with no counts at all → fall back to legacy
        # "@author: text" shape so old rows look identical to before.
        meta = ""

    body = _truncate_text(text)
    return f"{badge_prefix}{author}{meta}: {body}"


def format_comments_for_sheet(
    comments: list[Mapping[str, Any]],
) -> tuple[str, bool]:
    """Render the full Comments-column blob.

    Returns (cell_text, was_truncated). Truncation here refers to the
    *whole-blob* cap; per-comment truncation is independent and silent.
    """
    lines: list[str] = []
    for row in comments:
        line = format_comment_for_sheet(row)
        if line:
            lines.append(line)

    body = "\n\n".join(lines)
    if not body:
        return "", False

    if len(body) <= COMMENTS_SHEET_MAX_CHARS:
        return body, False

    max_body = COMMENTS_SHEET_MAX_CHARS - len(TRUNCATION_SUFFIX) - 1
    truncated = body[: max(0, max_body)].rstrip()
    return truncated + "\n" + TRUNCATION_SUFFIX, True
