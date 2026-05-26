"""Format extension comments for Google Sheets Comments column."""

from __future__ import annotations

COMMENTS_SHEET_MAX_CHARS = 10_000
TRUNCATION_SUFFIX = "... [more comments in ContentGraph]"


def format_comments_for_sheet(
    comments: list[dict[str, object]],
) -> tuple[str, bool]:
    """
    Plain text: one comment per line as "Author: text".

    Returns (cell_text, was_truncated).
    """
    lines: list[str] = []
    for row in comments:
        author = str(row.get("author") or "").strip() or "Anonymous"
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        lines.append(f"{author}: {text}")

    body = "\n".join(lines)
    if not body:
        return "", False

    if len(body) <= COMMENTS_SHEET_MAX_CHARS:
        return body, False

    max_body = COMMENTS_SHEET_MAX_CHARS - len(TRUNCATION_SUFFIX) - 1
    truncated = body[: max(0, max_body)].rstrip()
    return truncated + "\n" + TRUNCATION_SUFFIX, True
