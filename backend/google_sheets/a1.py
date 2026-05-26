"""A1 notation helpers for Google Sheets."""

from __future__ import annotations


def column_index_to_letter(index: int) -> str:
    """0-based column index → A, B, …, Z, AA, …"""
    if index < 0:
        raise ValueError("column index must be >= 0")
    n = index + 1
    letters = ""
    while n:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def cell_a1(sheet_name: str, col_index: int, row_number: int) -> str:
    """1-based row number, 0-based column index."""
    from google_sheets.sheet_range import quote_sheet_name

    col = column_index_to_letter(col_index)
    return f"{quote_sheet_name(sheet_name)}!{col}{row_number}"
