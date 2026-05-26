"""Rank and cap research briefing signals — global score, no filler."""

from __future__ import annotations

from collections import defaultdict

from app.schemas.copilot import FeedEvidenceVideo, FeedItem
from app.services.copilot.feed_signal_classifier import category_to_section

MIN_FINAL_SCORE = 0.42
DEFAULT_BRIEFING_LIMIT = 8
MIN_BRIEFING_LIMIT = 3
MAX_BRIEFING_LIMIT = 8

# Avoid one category flooding the briefing (e.g. many catalog outliers)
MAX_PER_CATEGORY: dict[str, int] = {
    "breakout": 3,
    "creator_growth": 2,
    "creator_strength": 2,
    "audience": 2,
    "hook_pattern": 2,
}


def rank_feed_signals(
    candidates: list[FeedItem],
    *,
    limit: int = DEFAULT_BRIEFING_LIMIT,
) -> list[FeedItem]:
    """
    Global ranking: best insights first, dedupe weak duplicates.

    limit is clamped to 3–8.
    """
    cap = max(MIN_BRIEFING_LIMIT, min(limit, MAX_BRIEFING_LIMIT))

    qualified = [
        c
        for c in candidates
        if (c.final_score or 0) >= MIN_FINAL_SCORE
    ]
    qualified.sort(
        key=lambda x: (
            x.final_score or 0,
            x.performance_ratio or 0,
            x.evidence_count or 0,
        ),
        reverse=True,
    )

    selected: list[FeedItem] = []
    seen_creators: set[str] = set()
    seen_hook_types: set[str] = set()
    seen_audience_themes: set[str] = set()
    category_counts: dict[str, int] = defaultdict(int)

    for item in qualified:
        if len(selected) >= cap:
            break

        cat_cap = MAX_PER_CATEGORY.get(item.category, 2)
        if category_counts[item.category] >= cat_cap:
            continue

        creator_key = (item.creator_name or "").lower()
        if item.category in ("creator_growth", "creator_strength", "breakout"):
            if creator_key and creator_key in seen_creators:
                # Keep only the highest-ranked signal per creator
                continue

        if item.category == "hook_pattern" and item.hook_type:
            if item.hook_type in seen_hook_types:
                continue
            seen_hook_types.add(item.hook_type)

        if item.category == "audience" and item.audience_theme:
            if item.audience_theme in seen_audience_themes:
                continue
            seen_audience_themes.add(item.audience_theme)

        selected.append(item)
        category_counts[item.category] += 1

        if creator_key and item.category in (
            "creator_growth",
            "creator_strength",
            "breakout",
        ):
            seen_creators.add(creator_key)

    return selected


def item_from_parts(
    *,
    id: str,
    category: str,
    title: str,
    summary: str,
    description: str,
    why_appeared: str,
    why_matters: str,
    href: str | None,
    confidence_score: float,
    importance_score: float,
    actionability_score: float,
    freshness_score: float,
    final_score: float,
    evidence_count: int,
    supporting_videos: list[FeedEvidenceVideo],
    supporting_creators: list[str],
    time_window: str,
    snapshot_days: int | None = None,
    creator_name: str | None = None,
    views_count: int | None = None,
    video_count: int | None = None,
    avg_views: int | None = None,
    hook_type: str | None = None,
    performance_ratio: float | None = None,
    audience_theme: str | None = None,
    badge: str | None = None,
) -> FeedItem:
    section = category_to_section(category)
    return FeedItem(
        id=id,
        category=category,
        section=section,
        title=title,
        summary=summary,
        description=description,
        why_appeared=why_appeared,
        why_matters=why_matters,
        href=href,
        badge=badge,
        creator_name=creator_name,
        views_count=views_count,
        video_count=video_count,
        avg_views=avg_views,
        hook_type=hook_type,
        performance_ratio=performance_ratio,
        audience_theme=audience_theme,
        confidence_score=confidence_score,
        importance_score=importance_score,
        actionability_score=actionability_score,
        freshness_score=freshness_score,
        final_score=final_score,
        evidence_count=evidence_count,
        supporting_videos=supporting_videos,
        supporting_creators=supporting_creators,
        time_window=time_window,
        snapshot_days=snapshot_days,
    )
