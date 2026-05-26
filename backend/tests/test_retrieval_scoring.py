"""Unit tests for hybrid semantic scoring and adaptive thresholds."""

from app.services.retrieval_scoring import (
    hybrid_semantic_score,
    passes_semantic_filter,
    resolve_match_source,
)


def test_hybrid_prefers_transcript_when_title_weak() -> None:
    score = hybrid_semantic_score(0.12, 0.21)
    assert score >= 0.19


def test_hybrid_transcript_only() -> None:
    assert hybrid_semantic_score(0.0, 0.19) == 0.19


def test_transcript_rescue_passes_filter() -> None:
    assert passes_semantic_filter(
        query="comfort never changed anyway",
        hybrid_score=0.19,
        title_sim=0.12,
        transcript_sim=0.21,
        max_score=0.35,
    )


def test_short_query_stricter() -> None:
    assert not passes_semantic_filter(
        query="ai",
        hybrid_score=0.15,
        title_sim=0.14,
        transcript_sim=0.10,
        max_score=0.40,
    )


def test_match_source_both() -> None:
    assert resolve_match_source(0.3, 0.25) == "both"
