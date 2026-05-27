"""Structured comments → Google Sheets cell formatting.

Covers the full v0.2.9 migration:
- legacy `{author, text, likes}` payloads still render (no badges, no counts
  when likes missing) — must not break existing Sheets columns.
- structured payloads render with `(N likes, R replies)` plus optional
  `📌` / `❤️` creator badges.
- thousands collapse to `K` / `M`.
- zero likes / zero replies stay hidden.
- per-comment text > 500 chars gets `…` suffix.
- whole-blob > 10k chars gets the `[more comments in ContentGraph]` marker.
- unicode/emoji round-trip safely.
"""

from __future__ import annotations

from google_sheets.comments_format import (
    PER_COMMENT_TEXT_MAX_CHARS,
    format_comment_for_sheet,
    format_comments_for_sheet,
)


# ── format_comment_for_sheet (single row) ─────────────────────────────────────


def test_single_legacy_row_renders_without_counts() -> None:
    """Payload with only {author, text} (older extension) — no `(N likes)`."""
    line = format_comment_for_sheet({"author": "John", "text": "Great video"})
    assert line == "John: Great video"


def test_single_structured_row_with_likes_only() -> None:
    line = format_comment_for_sheet(
        {"author": "@user", "text": "Helpful", "likes_count": 84}
    )
    assert line == "@user (84 likes): Helpful"


def test_single_structured_row_with_likes_and_replies() -> None:
    line = format_comment_for_sheet(
        {
            "author": "@user",
            "text": "Amazing insight",
            "likes_count": 512,
            "reply_count": 24,
        }
    )
    assert line == "@user (512 likes, 24 replies): Amazing insight"


def test_zero_likes_and_zero_replies_are_hidden() -> None:
    """0 must not show up as `(0 likes)`."""
    line = format_comment_for_sheet(
        {"author": "@u", "text": "Nice", "likes_count": 0, "reply_count": 0}
    )
    assert line == "@u: Nice"


def test_k_suffix_for_thousand_plus_likes() -> None:
    line = format_comment_for_sheet(
        {
            "author": "@viral",
            "text": "Amazing insight",
            "likes_count": 1234,
            "reply_count": 42,
        }
    )
    assert line == "@viral (1.2K likes, 42 replies): Amazing insight"


def test_k_suffix_drops_trailing_zero_decimal() -> None:
    line = format_comment_for_sheet(
        {"author": "@x", "text": "ok", "likes_count": 12_000}
    )
    # 12.0K → 12K
    assert line == "@x (12K likes): ok"


def test_m_suffix_for_million_plus() -> None:
    line = format_comment_for_sheet(
        {"author": "@m", "text": "ok", "likes_count": 1_500_000}
    )
    assert line == "@m (1.5M likes): ok"


def test_pinned_badge() -> None:
    line = format_comment_for_sheet(
        {
            "author": "@creator",
            "text": "Pinned message",
            "likes_count": 100,
            "is_pinned": True,
        }
    )
    assert line.startswith("📌 ")
    assert "@creator (100 likes)" in line


def test_pinned_and_hearted_both() -> None:
    line = format_comment_for_sheet(
        {
            "author": "@fan",
            "text": "Best comment",
            "likes_count": 1200,
            "reply_count": 42,
            "is_pinned": True,
            "is_hearted": True,
        }
    )
    assert line == "📌 ❤️ @fan (1.2K likes, 42 replies): Best comment"


def test_hearted_only() -> None:
    line = format_comment_for_sheet(
        {"author": "@x", "text": "ok", "likes_count": 1, "is_hearted": True}
    )
    assert line.startswith("❤️ ")


def test_likes_legacy_alias_still_recognised() -> None:
    """Old extension uses `likes`, new one uses `likes_count`. Both work."""
    line = format_comment_for_sheet(
        {"author": "@old", "text": "Hi", "likes": 17}
    )
    assert line == "@old (17 likes): Hi"


def test_empty_text_drops_comment() -> None:
    assert format_comment_for_sheet({"author": "@x", "text": ""}) == ""
    assert format_comment_for_sheet({"author": "@x", "text": "   "}) == ""


def test_missing_author_falls_back_to_anonymous() -> None:
    line = format_comment_for_sheet({"text": "Hello", "likes_count": 3})
    assert line == "Anonymous (3 likes): Hello"


def test_per_comment_text_truncation() -> None:
    """One huge comment must not blow up the cell — capped at PER_COMMENT cap."""
    long = "x" * (PER_COMMENT_TEXT_MAX_CHARS + 500)
    line = format_comment_for_sheet(
        {"author": "@spammer", "text": long, "likes_count": 1}
    )
    assert line.endswith("…")
    # author + meta + suffix all fit under cap + small overhead.
    assert len(line) <= PER_COMMENT_TEXT_MAX_CHARS + 60


def test_unicode_and_emoji_safe() -> None:
    """Cyrillic, CJK, and emoji must survive — no encoding crashes."""
    line = format_comment_for_sheet(
        {
            "author": "@user",
            "text": "Дякую! 🔥 это огонь — 完美",
            "likes_count": 5,
        }
    )
    assert "Дякую" in line
    assert "🔥" in line
    assert "完美" in line


def test_garbage_int_fields_do_not_crash() -> None:
    """Defensive: ingest might hand us strings/None."""
    line = format_comment_for_sheet(
        {
            "author": "@u",
            "text": "Hi",
            "likes_count": "12",
            "reply_count": None,
            "is_pinned": "true",
        }
    )
    assert line == "📌 @u (12 likes): Hi"


# ── format_comments_for_sheet (whole blob) ────────────────────────────────────


def test_blob_joins_with_blank_line() -> None:
    """Each comment now gets its own paragraph — readability in Sheets."""
    text, truncated = format_comments_for_sheet(
        [
            {"author": "John", "text": "Great video", "likes_count": 51},
            {"author": "Sarah", "text": "This helped", "likes_count": 9},
        ]
    )
    assert truncated is False
    assert text == "John (51 likes): Great video\n\nSarah (9 likes): This helped"


def test_blob_skips_empty_comments() -> None:
    text, _ = format_comments_for_sheet(
        [
            {"author": "@a", "text": "", "likes_count": 99},
            {"author": "@b", "text": "Hi", "likes_count": 1},
        ]
    )
    assert text == "@b (1 likes): Hi"


def test_blob_truncates_when_over_10k() -> None:
    """Whole-cell cap still enforced; suffix preserved."""
    huge = "x" * 1200  # under per-comment cap (500) → will be cut to 500 + …
    rows = [
        {"author": f"@u{i}", "text": huge, "likes_count": i}
        for i in range(40)
    ]
    text, truncated = format_comments_for_sheet(rows)
    assert truncated is True
    assert len(text) <= 10_100
    assert "ContentGraph" in text


def test_blob_legacy_only_payload_renders_identically_to_old_format() -> None:
    """Backward-compatibility guarantee: pure legacy {author, text} rows
    render as `Author: text` (no extra parentheses)."""
    text, _ = format_comments_for_sheet(
        [
            {"author": "John", "text": "Great video"},
            {"author": "Sarah", "text": "This helped a lot"},
        ]
    )
    assert text == "John: Great video\n\nSarah: This helped a lot"


def test_blob_mixed_legacy_and_structured() -> None:
    """Mix one legacy + one structured row → each formatted per its own shape."""
    text, _ = format_comments_for_sheet(
        [
            {"author": "@old", "text": "legacy"},
            {
                "author": "@new",
                "text": "structured",
                "likes_count": 2400,
                "reply_count": 18,
                "is_pinned": True,
            },
        ]
    )
    assert "@old: legacy" in text
    assert "📌 @new (2.4K likes, 18 replies): structured" in text
