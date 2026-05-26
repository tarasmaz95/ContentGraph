"""Token sanitization for analytics keywords."""

from app.services.analytics.token_sanitize import (
    extract_title_tokens,
    sanitize_keyword_token,
)


def test_rejects_malformed_sec_fragment() -> None:
    assert sanitize_keyword_token("sec..i'll") is None


def test_accepts_fear_and_rejection() -> None:
    assert sanitize_keyword_token("rejection") == "rejection"
    assert sanitize_keyword_token("fear") == "fear"


def test_extract_title_tokens_from_viral_dan_martell_title() -> None:
    title = "Give me 58 sec..i'll DELETE your fear of rejection"
    tokens = set(extract_title_tokens(title))
    assert "rejection" in tokens
    assert "fear" in tokens
    assert "sec..i'll" not in tokens
    assert "sec" not in tokens
