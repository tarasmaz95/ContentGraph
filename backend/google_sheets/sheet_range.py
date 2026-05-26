"""Spreadsheet URL / A1 range helpers — no API calls."""

from __future__ import annotations

import re

_SPREADSHEET_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9-_]+)")
# Also bare id paste
_BARE_ID_RE = re.compile(r"^[a-zA-Z0-9-_]{20,}$")

_RANGE_RE = re.compile(
    r"^(?:'((?:[^']|'')*)'|([^!]+))!([A-Za-z]+)\d*:([A-Za-z]+)\d*$",
)


def parse_spreadsheet_id(url_or_id: str) -> str | None:
    """Extract spreadsheet ID from URL or raw id string."""
    raw = (url_or_id or "").strip()
    if not raw:
        return None
    if _BARE_ID_RE.match(raw):
        return raw
    match = _SPREADSHEET_ID_RE.search(raw)
    if match:
        return match.group(1)
    # Fallback: /d/ID/ anywhere in string
    m2 = re.search(r"/d/([a-zA-Z0-9-_]+)", raw)
    return m2.group(1) if m2 else None


def spreadsheet_edit_url(spreadsheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


def quote_sheet_name(sheet_name: str) -> str:
    """A1 notation sheet title — quote when needed."""
    name = sheet_name.strip()
    if re.match(r"^[A-Za-z0-9_]+$", name):
        return name
    escaped = name.replace("'", "''")
    return f"'{escaped}'"


def build_data_range(sheet_name: str, *, col_start: str = "A", col_end: str = "Z") -> str:
    """Default sync range — full width of common columns."""
    return f"{quote_sheet_name(sheet_name)}!{col_start}:{col_end}"


def parse_sheet_from_range(sheets_range: str) -> str | None:
    """Parse tab title from stored range like Titles!A:F or 'My Tab'!A:Z."""
    raw = (sheets_range or "").strip()
    if not raw or "!" not in raw:
        return None
    match = _RANGE_RE.match(raw)
    if not match:
        part = raw.split("!", 1)[0]
        if part.startswith("'") and part.endswith("'"):
            return part[1:-1].replace("''", "'")
        return part
    quoted, plain, _, _ = match.groups()
    return (quoted or plain or "").replace("''", "'")
