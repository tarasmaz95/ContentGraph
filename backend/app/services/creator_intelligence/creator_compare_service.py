"""Creator A vs B — aggregates CreatorIntelligenceService (no LLM)."""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.creator_compare import (
    CreatorCompareOverviewRow,
    CreatorCompareResult,
    GrowthCompareSeries,
    SemanticOverlapCompare,
    TitleBattleItem,
)
from app.schemas.creator_intelligence import CreatorIntelligence
from app.services.analytics.pattern_detection import extract_title_features
from app.services.creator_intelligence.creator_intelligence_service import (
    CreatorIntelligenceService,
    _title_token_set,
)
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService


class CreatorCompareService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._intel = CreatorIntelligenceService(db)
        self._profiles = CreatorProfileService(db)

    async def compare(
        self,
        creator_a: str,
        creator_b: str,
        *,
        depth: str = "full",
    ) -> CreatorCompareResult | None:
        name_a = await self._intel.resolve_name(creator_a)
        name_b = await self._intel.resolve_name(creator_b)
        if not name_a or not name_b:
            return None
        if name_a.lower() == name_b.lower():
            return None

        if depth == "extended":
            return await self._compare_extended(name_a, name_b)

        use_lite = depth == "core"
        intel_a, intel_b, videos_a, videos_b = await asyncio.gather(
            self._intel.get_intelligence(name_a, lite=use_lite),
            self._intel.get_intelligence(name_b, lite=use_lite),
            self._profiles.get_videos_for_creator(name_a, limit=200),
            self._profiles.get_videos_for_creator(name_b, limit=200),
        )
        if intel_a is None or intel_b is None:
            return None

        return self._build_compare_result(
            name_a, name_b, intel_a, intel_b, videos_a, videos_b
        )

    async def _compare_extended(
        self, name_a: str, name_b: str
    ) -> CreatorCompareResult | None:
        """Load audience + momentum (after core compare)."""
        intel_a, intel_b, videos_a, videos_b = await asyncio.gather(
            self._intel.get_intelligence(name_a, lite=True),
            self._intel.get_intelligence(name_b, lite=True),
            self._profiles.get_videos_for_creator(name_a, limit=200),
            self._profiles.get_videos_for_creator(name_b, limit=200),
        )
        if intel_a is None or intel_b is None:
            return None

        aud_a, aud_b, mom_a, mom_b = await asyncio.gather(
            self._intel.get_audience(name_a),
            self._intel.get_audience(name_b),
            self._intel.get_momentum(name_a, videos_a),
            self._intel.get_momentum(name_b, videos_b),
        )

        intel_a = intel_a.model_copy(update={"audience": aud_a, "momentum": mom_a})
        intel_b = intel_b.model_copy(update={"audience": aud_b, "momentum": mom_b})

        return CreatorCompareResult(
            creator_a=name_a,
            creator_b=name_b,
            intelligence_a=intel_a,
            intelligence_b=intel_b,
            momentum_winner=_pick_momentum_winner(intel_a, intel_b),
        )

    def _build_compare_result(
        self,
        name_a: str,
        name_b: str,
        intel_a: CreatorIntelligence,
        intel_b: CreatorIntelligence,
        videos_a: list,
        videos_b: list,
    ) -> CreatorCompareResult:
        overview = _build_overview_rows(intel_a, intel_b)
        growth_compare = _align_growth_series(intel_a, intel_b)
        semantic = _semantic_overlap(name_a, name_b, intel_a, intel_b, videos_a, videos_b)
        battle_a = _title_battle(videos_a, limit=5)
        battle_b = _title_battle(videos_b, limit=5)

        return CreatorCompareResult(
            creator_a=name_a,
            creator_b=name_b,
            intelligence_a=intel_a,
            intelligence_b=intel_b,
            overview_rows=overview,
            growth_compare=growth_compare,
            semantic_overlap=semantic,
            title_battle_a=battle_a,
            title_battle_b=battle_b,
            momentum_winner=_pick_momentum_winner(intel_a, intel_b),
            growth_winner=_pick_growth_winner(intel_a, intel_b),
            hooks_winner=_pick_hooks_winner(intel_a, intel_b),
        )


def _breakout_rate(intel: CreatorIntelligence) -> float:
    total = intel.overview.total_videos or 1
    n = len(intel.momentum.breakout_videos)
    return round(100.0 * n / total, 1)


def _build_overview_rows(
    a: CreatorIntelligence, b: CreatorIntelligence
) -> list[CreatorCompareOverviewRow]:
    ga, gb = a.growth.metrics, b.growth.metrics
    oa, ob = a.overview, b.overview
    br_a, br_b = _breakout_rate(a), _breakout_rate(b)

    def row(signal: str, va: str, vb: str, num_a: float, num_b: float) -> CreatorCompareOverviewRow:
        winner: str | None = None
        if num_a > num_b:
            winner = "a"
        elif num_b > num_a:
            winner = "b"
        return CreatorCompareOverviewRow(
            signal=signal, value_a=va, value_b=vb, winner=winner
        )

    rows = [
        row(
            "subscribers",
            f"{oa.subscribers_count:,}",
            f"{ob.subscribers_count:,}",
            float(oa.subscribers_count),
            float(ob.subscribers_count),
        ),
        row(
            "avg_views",
            f"{oa.avg_views:,.0f}",
            f"{ob.avg_views:,.0f}",
            oa.avg_views,
            ob.avg_views,
        ),
        row(
            "total_views",
            f"{oa.total_views:,}",
            f"{ob.total_views:,}",
            float(oa.total_views),
            float(ob.total_views),
        ),
        row(
            "videos",
            str(oa.total_videos),
            str(ob.total_videos),
            float(oa.total_videos),
            float(ob.total_videos),
        ),
        row(
            "growth_7d_pct",
            f"{ga.growth_7d_pct:.1f}%",
            f"{gb.growth_7d_pct:.1f}%",
            ga.growth_7d_pct,
            gb.growth_7d_pct,
        ),
        row(
            "velocity",
            f"{ga.velocity_views_per_day:,.0f}/day",
            f"{gb.velocity_views_per_day:,.0f}/day",
            ga.velocity_views_per_day,
            gb.velocity_views_per_day,
        ),
        row(
            "breakout_rate",
            f"{br_a:.1f}%",
            f"{br_b:.1f}%",
            br_a,
            br_b,
        ),
    ]
    return rows


def _align_growth_series(a: CreatorIntelligence, b: CreatorIntelligence) -> GrowthCompareSeries:
    return GrowthCompareSeries(
        subscriber_a=a.growth.subscriber_history,
        subscriber_b=b.growth.subscriber_history,
        views_a=a.growth.views_history,
        views_b=b.growth.views_history,
    )


def _semantic_overlap(
    name_a: str,
    name_b: str,
    intel_a: CreatorIntelligence,
    intel_b: CreatorIntelligence,
    videos_a: list,
    videos_b: list,
) -> SemanticOverlapCompare:
    tokens_a = _title_token_set(videos_a)
    tokens_b = _title_token_set(videos_b)
    kw_a = {k.keyword.lower() for k in intel_a.semantic.dominant_keywords}
    kw_b = {k.keyword.lower() for k in intel_b.semantic.dominant_keywords}
    set_a = tokens_a | kw_a
    set_b = tokens_b | kw_b

    shared = sorted(set_a & set_b)[:12]
    unique_a = sorted(set_a - set_b)[:10]
    unique_b = sorted(set_b - set_a)[:10]
    union = set_a | set_b
    score = round(len(set_a & set_b) / max(len(union), 1), 3) if union else 0.0

    summary = (
        f"{name_a} vs {name_b}: {len(shared)} shared themes, "
        f"{len(unique_a)} unique to {name_a}, {len(unique_b)} unique to {name_b}."
    )
    if shared:
        summary += f" Overlap: {', '.join(shared[:5])}."

    return SemanticOverlapCompare(
        shared_themes=shared,
        unique_a=unique_a,
        unique_b=unique_b,
        overlap_score=score,
        summary=summary,
    )


def _title_battle(videos: list, limit: int = 5) -> list[TitleBattleItem]:
    top = sorted(videos, key=lambda v: v.views_count or 0, reverse=True)[:limit]
    items: list[TitleBattleItem] = []
    for v in top:
        feat = extract_title_features(v.title)
        curiosity = len(feat.curiosity_tags) + (1 if "?" in v.title else 0)
        items.append(
            TitleBattleItem(
                video_id=v.id,
                title=v.title,
                views_count=int(v.views_count or 0),
                hook_type=feat.primary_hook,
                title_length=feat.length,
                curiosity_score=curiosity,
            )
        )
    return items


def _pick_growth_winner(a: CreatorIntelligence, b: CreatorIntelligence) -> str | None:
    score_a = a.growth.metrics.growth_7d_pct + a.growth.metrics.velocity_views_per_day / 10000
    score_b = b.growth.metrics.growth_7d_pct + b.growth.metrics.velocity_views_per_day / 10000
    if score_a > score_b:
        return a.overview.creator_name
    if score_b > score_a:
        return b.overview.creator_name
    return None


def _pick_momentum_winner(a: CreatorIntelligence, b: CreatorIntelligence) -> str | None:
    def top_score(intel: CreatorIntelligence) -> float:
        if not intel.momentum.breakout_videos:
            return 0.0
        return max(v.breakout_score for v in intel.momentum.breakout_videos)

    sa, sb = top_score(a), top_score(b)
    if sa > sb:
        return a.overview.creator_name
    if sb > sa:
        return b.overview.creator_name
    return None


def _pick_hooks_winner(a: CreatorIntelligence, b: CreatorIntelligence) -> str | None:
    def hook_power(intel: CreatorIntelligence) -> float:
        m = intel.hooks.mix
        return (
            m.curiosity_pct
            + m.numbers_pct * 0.5
            + m.authority_pct
            + (intel.overview.avg_views / 100000)
        )

    ha, hb = hook_power(a), hook_power(b)
    if ha > hb:
        return a.overview.creator_name
    if hb > ha:
        return b.overview.creator_name
    return None
