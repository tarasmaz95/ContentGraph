"""Comments sheet cell formatting."""

from google_sheets.comments_format import format_comments_for_sheet


def test_format_comments_one_per_line() -> None:
    text, truncated = format_comments_for_sheet(
        [
            {"author": "John", "text": "Great video"},
            {"author": "Sarah", "text": "This helped a lot"},
        ]
    )
    assert truncated is False
    assert text == "John: Great video\nSarah: This helped a lot"


def test_format_comments_truncates_long_block() -> None:
    long = "x" * 20_000
    text, truncated = format_comments_for_sheet([{"author": "A", "text": long}])
    assert truncated is True
    assert len(text) <= 10_100
    assert "ContentGraph" in text
