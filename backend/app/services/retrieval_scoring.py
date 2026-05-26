"""Semantic scoring helpers — hybrid similarity and adaptive thresholds."""

from __future__ import annotations

import re

# Hybrid semantic blend (title + transcript)
TITLE_BLEND = 0.65
TRANSCRIPT_BLEND = 0.35

# Minimum transcript similarity to rescue weak title matches
TRANSCRIPT_RESCUE_MIN = 0.17
TRANSCRIPT_STRONG_MIN = 0.19


def hybrid_semantic_score(title_sim: float, transcript_sim: float) -> float:
    """
    Weighted hybrid score. Transcript-only hits use transcript_sim directly.
    Slight boost when transcript is stronger than title.
    """
    title_sim = max(0.0, title_sim)
    transcript_sim = max(0.0, transcript_sim)

    if title_sim <= 0 and transcript_sim > 0:
        return transcript_sim
    if transcript_sim <= 0:
        return title_sim

    blended = TITLE_BLEND * title_sim + TRANSCRIPT_BLEND * transcript_sim
    if transcript_sim >= title_sim * 0.85:
        blended = max(blended, transcript_sim * 0.98)
    return blended


def resolve_match_source(title_sim: float, transcript_sim: float) -> str:
    if title_sim > 0 and transcript_sim > 0:
        return "both"
    if transcript_sim > title_sim and transcript_sim > 0:
        return "transcript"
    if title_sim > 0:
        return "title"
    return "keyword"


def dynamic_min_similarity(query: str) -> float:
    """Base threshold — stricter for short queries, looser for semantic phrases."""
    tokens = _query_tokens(query)
    n = len(tokens)
    if n >= 6:
        return 0.18
    if n >= 4:
        return 0.20
    if n >= 2:
        return 0.22
    return 0.26


def passes_semantic_filter(
    *,
    query: str,
    hybrid_score: float,
    title_sim: float,
    transcript_sim: float,
    max_score: float,
) -> bool:
    """Include result if above adaptive threshold or transcript-rescue rules."""
    base = dynamic_min_similarity(query)

    if hybrid_score >= base:
        return True

    # Transcript-driven discovery: strong transcript, weak title
    if transcript_sim >= TRANSCRIPT_RESCUE_MIN and transcript_sim > title_sim + 0.03:
        if hybrid_score >= TRANSCRIPT_RESCUE_MIN or transcript_sim >= TRANSCRIPT_STRONG_MIN:
            return True

    # Keep high-precision tail relative to best match
    if max_score > 0 and hybrid_score >= max_score * 0.52 and hybrid_score >= 0.16:
        return True

    return False


def _query_tokens(query: str) -> list[str]:
    stop = {
        "what", "which", "how", "why", "the", "a", "an", "for", "about", "videos", "video",
    }
    tokens: list[str] = []
    for raw in query.lower().split():
        t = re.sub(r"[^a-z0-9']", "", raw)
        if len(t) >= 2 and t not in stop:
            tokens.append(t)
    return tokens
