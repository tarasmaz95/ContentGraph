"""Deterministic scores for research briefing signals — no ML."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SignalScores:
    confidence_score: float
    importance_score: float
    actionability_score: float
    freshness_score: float
    final_score: float


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def combine_scores(
    confidence: float,
    importance: float,
    actionability: float,
    freshness: float,
) -> SignalScores:
    """Weighted final score for global feed ranking."""
    c, i, a, f = (
        _clamp(confidence),
        _clamp(importance),
        _clamp(actionability),
        _clamp(freshness),
    )
    final = _clamp(0.32 * c + 0.28 * i + 0.22 * a + 0.18 * f)
    return SignalScores(
        confidence_score=round(c, 3),
        importance_score=round(i, 3),
        actionability_score=round(a, 3),
        freshness_score=round(f, 3),
        final_score=round(final, 3),
    )


def score_breakout(
    *,
    views_delta_7d: int,
    growth_7d_pct: float,
    breakout_score: float,
    snapshot_days: int,
) -> SignalScores:
    delta_factor = _clamp(views_delta_7d / 500_000, 0, 1)
    growth_factor = _clamp(growth_7d_pct / 80, 0, 1)
    score_factor = _clamp(breakout_score / 120, 0, 1)
    confidence = _clamp(
        0.35
        + 0.25 * min(snapshot_days / 7, 1.0)
        + 0.2 * delta_factor
        + 0.2 * growth_factor
    )
    importance = _clamp(0.4 + 0.35 * score_factor + 0.25 * delta_factor)
    actionability = 0.88
    freshness = _clamp(0.5 + 0.5 * growth_factor)
    return combine_scores(confidence, importance, actionability, freshness)


def score_creator_growth(
    *,
    growth_7d_pct: float,
    views_delta_7d: int,
    subscribers_delta_7d: int,
    snapshot_days: int,
) -> SignalScores:
    growth_factor = _clamp(max(growth_7d_pct, 0) / 50, 0, 1)
    velocity_factor = _clamp(views_delta_7d / 300_000, 0, 1)
    sub_factor = _clamp(subscribers_delta_7d / 50_000, 0, 1)
    confidence = _clamp(
        0.3 + 0.3 * min(snapshot_days / 7, 1.0) + 0.2 * growth_factor + 0.2 * velocity_factor
    )
    importance = _clamp(0.45 + 0.35 * growth_factor + 0.2 * sub_factor)
    actionability = 0.82
    freshness = _clamp(0.55 + 0.45 * growth_factor)
    return combine_scores(confidence, importance, actionability, freshness)


def score_creator_strength(
    *,
    performance_ratio: float,
    video_count: int,
    catalog_median_views: float,
) -> SignalScores:
    ratio_factor = _clamp((performance_ratio - 1.0) / 1.5, 0, 1)
    sample_factor = _clamp(video_count / 14, 0, 1)
    confidence = _clamp(0.2 + 0.35 * sample_factor + 0.25 * ratio_factor)
    importance = _clamp(0.3 + 0.4 * ratio_factor + 0.15 * sample_factor)
    actionability = 0.75
    freshness = 0.35  # cross-sectional, not momentum
    if catalog_median_views <= 0:
        confidence *= 0.5
    return combine_scores(confidence, importance, actionability, freshness)


def score_audience_theme(
    *,
    comment_count: int,
    total_likes: int,
    theme: str,
) -> SignalScores:
    count_factor = _clamp(comment_count / 5, 0, 1)
    likes_factor = _clamp(total_likes / 500, 0, 1)
    confidence = _clamp(0.3 + 0.4 * count_factor + 0.3 * likes_factor)
    importance = _clamp(0.4 + 0.35 * likes_factor + 0.25 * count_factor)
    actionability = 0.7 if theme in ("confusion", "skepticism", "curiosity") else 0.62
    freshness = 0.45
    return combine_scores(confidence, importance, actionability, freshness)


def score_hook_pattern(
    *,
    indexed_count: int,
    performance_ratio: float,
    distinct_videos: int,
) -> SignalScores:
    count_factor = _clamp(indexed_count / 10, 0, 1)
    video_factor = _clamp(distinct_videos / 5, 0, 1)
    ratio_factor = _clamp((performance_ratio - 1.0) / 0.8, 0, 1)
    confidence = _clamp(0.2 + 0.4 * count_factor + 0.25 * video_factor + 0.15 * ratio_factor)
    if indexed_count < 3:
        confidence *= 0.4
    importance = _clamp(0.35 + 0.4 * ratio_factor + 0.25 * count_factor)
    actionability = 0.78
    freshness = 0.4
    return combine_scores(confidence, importance, actionability, freshness)
