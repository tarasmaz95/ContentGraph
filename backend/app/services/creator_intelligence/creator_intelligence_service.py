"""Creator intelligence dashboard — snapshots, hooks, audience, semantic (no LLM)."""

from __future__ import annotations

import asyncio
import re
from collections import Counter
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.creator_stats_history import CreatorStatsHistory
from app.models.video import Video
from app.models.video_stats_history import VideoStatsHistory
from app.schemas.analytics import ChartPoint, HookAnalysis, HookTypeStat, KeywordStat, PatternStat
from app.schemas.comments import CommentRead
from app.schemas.creator_intelligence import (
    CreatorAudienceIntel,
    CreatorGrowthIntel,
    CreatorGrowthMetrics,
    CreatorHookIntel,
    CreatorHookMix,
    CreatorIntelligence,
    CreatorMomentumIntel,
    CreatorSemanticIntel,
    NearestCreator,
)
from app.schemas.growth import VideoBreakoutItem
from app.schemas.video import VideoRead
from app.services.analytics._video_data import keyword_stats_from_titles
from app.services.analytics.growth_analytics_service import (
    GrowthAnalyticsService,
    _pct_delta,
    _snapshot_on_or_before,
)
from app.services.analytics.hook_analytics import HookAnalyticsService
from app.services.analytics.pattern_detection import extract_title_features
from app.services.comments.audience_intelligence_service import AudienceIntelligenceService
from app.services.cache.intelligence_cache import (
    get_cached_intelligence,
    intelligence_cache_key,
    set_cached_intelligence,
)
from app.services.creator_intelligence.creator_page_service import CreatorPageService
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.video_helpers import video_to_read

AUTHORITY_PATTERN = re.compile(
    r"\b(expert|proven|official|years|coach|phd|dr\.|ceo|founder|masterclass)\b",
    re.I,
)
IDENTITY_PATTERN = re.compile(
    r"\b(identity|mindset|who you|become|my story|journey|self)\b",
    re.I,
)


class CreatorIntelligenceService:
    """Builds unified creator intelligence from catalog + history tables."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._page = CreatorPageService(db)
        self._profiles = CreatorProfileService(db)
        self._growth = GrowthAnalyticsService(db)
        self._hooks = HookAnalyticsService()

    async def resolve_name(self, slug_or_name: str) -> str | None:
        return await self._page.resolve_creator_name(slug_or_name)

    async def get_intelligence(
        self, slug_or_name: str, *, lite: bool = False
    ) -> CreatorIntelligence | None:
        analytics = await self._page.get_analytics(slug_or_name)
        if analytics is None:
            return None

        creator_name = analytics.overview.creator_name
        cache_key = intelligence_cache_key(creator_name, lite=lite)
        cached = get_cached_intelligence(cache_key)
        if cached is not None:
            return cached

        videos = await self._profiles.get_videos_for_creator(creator_name, limit=200)

        growth_coro = self.get_growth(creator_name)
        hooks_coro = self.get_hooks(creator_name, videos)
        semantic_coro = self.get_semantic(
            creator_name, videos, include_nearest=not lite
        )

        if lite:
            growth, hooks, semantic = await asyncio.gather(
                growth_coro, hooks_coro, semantic_coro
            )
            audience = CreatorAudienceIntel()
            momentum = CreatorMomentumIntel()
        else:
            growth, hooks, audience, semantic, momentum = await asyncio.gather(
                growth_coro,
                hooks_coro,
                self.get_audience(creator_name),
                semantic_coro,
                self.get_momentum(creator_name, videos),
            )

        result = CreatorIntelligence(
            overview=analytics.overview,
            growth=growth,
            hooks=hooks,
            audience=audience,
            semantic=semantic,
            momentum=momentum,
            sections=analytics.sections,
        )
        set_cached_intelligence(cache_key, result)
        return result

    async def get_growth(self, creator_name: str) -> CreatorGrowthIntel:
        rows = list(
            (
                await self._db.execute(
                    select(CreatorStatsHistory)
                    .where(CreatorStatsHistory.creator_name == creator_name)
                    .order_by(CreatorStatsHistory.snapshot_date)
                )
            ).scalars()
        )

        if not rows:
            catalog = await self._growth.get_creator_growth(limit=500)
            item = next(
                (c for c in catalog.items if c.creator_name == creator_name),
                None,
            )
            if item:
                return CreatorGrowthIntel(
                    metrics=CreatorGrowthMetrics(
                        growth_7d_pct=item.growth_7d_pct,
                        growth_30d_pct=item.growth_30d_pct,
                        subscribers_delta_7d=item.subscribers_delta_7d,
                        views_delta_7d=item.views_delta_7d,
                        velocity_views_per_day=item.velocity_views_per_day,
                        snapshot_days=item.snapshot_days,
                        accelerating=item.growth_7d_pct > 2 or item.subscribers_delta_7d > 0,
                        slowing=item.growth_7d_pct < -2,
                    ),
                    latest_snapshot_date=catalog.snapshot_date_latest,
                )
            return CreatorGrowthIntel()

        sub_history = [
            ChartPoint(
                label=r.snapshot_date.isoformat(),
                value=float(r.subscribers_count or 0),
                count=1,
            )
            for r in rows
        ]
        views_history = [
            ChartPoint(
                label=r.snapshot_date.isoformat(),
                value=float(r.total_views or 0),
                count=int(r.total_videos or 0),
            )
            for r in rows
        ]
        upload_momentum = [
            ChartPoint(
                label=r.snapshot_date.isoformat(),
                value=float(r.total_videos or 0),
                count=int(r.total_videos or 0),
            )
            for r in rows
        ]

        latest = rows[-1].snapshot_date
        day_7 = latest - timedelta(days=7)
        day_30 = latest - timedelta(days=30)
        sub_snaps = [(r.snapshot_date, int(r.subscribers_count or 0)) for r in rows]
        view_snaps = [(r.snapshot_date, int(r.total_views or 0)) for r in rows]

        subs_now = _snapshot_on_or_before(sub_snaps, latest) or 0
        subs_7 = _snapshot_on_or_before(sub_snaps, day_7) or subs_now
        subs_30 = _snapshot_on_or_before(sub_snaps, day_30) or subs_now
        views_now = _snapshot_on_or_before(view_snaps, latest) or 0
        views_7 = _snapshot_on_or_before(view_snaps, day_7) or views_now
        views_delta_7 = views_now - views_7
        g7 = _pct_delta(subs_now, subs_7)
        g30 = _pct_delta(subs_now, subs_30)

        return CreatorGrowthIntel(
            metrics=CreatorGrowthMetrics(
                growth_7d_pct=g7,
                growth_30d_pct=g30,
                subscribers_delta_7d=subs_now - subs_7,
                views_delta_7d=views_delta_7,
                velocity_views_per_day=round(views_delta_7 / 7.0, 2) if views_delta_7 else 0.0,
                snapshot_days=len(rows),
                accelerating=g7 > 2 or (subs_now - subs_7) > 0,
                slowing=g7 < -2,
            ),
            subscriber_history=sub_history,
            views_history=views_history,
            upload_momentum=upload_momentum,
            latest_snapshot_date=latest,
        )

    async def get_hooks(
        self, creator_name: str, videos: list[VideoRead] | None = None
    ) -> CreatorHookIntel:
        if videos is None:
            videos = await self._profiles.get_videos_for_creator(creator_name, limit=200)
        if not videos:
            return CreatorHookIntel()

        det = self._hooks.compute_deterministic(videos)
        n = len(videos)
        counts = Counter(
            {
                "curiosity": 0,
                "transformation": 0,
                "urgency": 0,
                "numbers": 0,
                "emotional": 0,
                "authority": 0,
                "how_to": 0,
                "identity": 0,
            }
        )

        for video in videos:
            feat = extract_title_features(video.title)
            if feat.curiosity_tags:
                counts["curiosity"] += 1
            if feat.transformation_tags:
                counts["transformation"] += 1
            if feat.urgency_tags:
                counts["urgency"] += 1
            if feat.has_numbers:
                counts["numbers"] += 1
            if feat.emotional_words:
                counts["emotional"] += 1
            if AUTHORITY_PATTERN.search(video.title):
                counts["authority"] += 1
            if feat.has_how_to:
                counts["how_to"] += 1
            if IDENTITY_PATTERN.search(video.title) or feat.transformation_tags:
                counts["identity"] += 1

        def pct(k: str) -> float:
            return round(100.0 * counts[k] / n, 1) if n else 0.0

        mix = CreatorHookMix(
            curiosity_pct=pct("curiosity"),
            transformation_pct=pct("transformation"),
            urgency_pct=pct("urgency"),
            numbers_pct=pct("numbers"),
            emotional_pct=pct("emotional"),
            authority_pct=pct("authority"),
            how_to_pct=pct("how_to"),
            identity_pct=pct("identity"),
        )

        hook_types = sorted(
            det.get("hook_types", []),
            key=lambda h: h.get("avg_views", 0),
            reverse=True,
        )
        analysis = HookAnalysis(
            hook_types=[HookTypeStat(**h) for h in hook_types[:10]],
            top_hooks=[h["hook_type"] for h in hook_types[:6]],
            curiosity_patterns=[PatternStat(**p) for p in det.get("curiosity", [])[:6]],
            transformation_hooks=[
                PatternStat(**p) for p in det.get("transformation", [])[:6]
            ],
            urgency_hooks=[PatternStat(**p) for p in det.get("urgency", [])[:6]],
        )

        return CreatorHookIntel(
            mix=mix,
            analysis=analysis,
            best_performing_hooks=[h["hook_type"] for h in hook_types[:5]],
        )

    async def get_audience(self, creator_name: str) -> CreatorAudienceIntel:
        stmt = (
            select(Comment)
            .join(Video, Video.id == Comment.video_id)
            .where(func.lower(Video.creator_name) == creator_name.lower())
            .order_by(Comment.likes_count.desc())
            .limit(50)
        )
        rows = list((await self._db.execute(stmt)).scalars().all())
        if not rows:
            return CreatorAudienceIntel()

        intel = AudienceIntelligenceService(self._db)._aggregate(rows)
        return CreatorAudienceIntel(
            total_comments=intel.total_comments,
            top_comments=intel.top_comments[:10],
            repeated_phrases=intel.recurring_phrases[:8],
            emotional_patterns=intel.emotional_patterns[:6],
            pain_points=intel.pain_points[:6],
            top_reactions=intel.audience_reactions[:6],
        )

    async def get_semantic(
        self,
        creator_name: str,
        videos: list[VideoRead] | None = None,
        *,
        include_nearest: bool = True,
    ) -> CreatorSemanticIntel:
        if videos is None:
            videos = await self._profiles.get_videos_for_creator(creator_name, limit=200)

        keywords = keyword_stats_from_titles(videos, 12)
        themes = [f"{k.keyword} ({k.count} videos)" for k in keywords[:8]]
        summary = (
            f"This creator's catalog centers on {', '.join(k.keyword for k in keywords[:5])}."
            if keywords
            else "Not enough title data for positioning."
        )

        nearest = (
            await self._nearest_creators(creator_name, videos) if include_nearest else []
        )
        return CreatorSemanticIntel(
            dominant_keywords=keywords,
            themes=themes,
            positioning_summary=summary,
            nearest_creators=nearest,
        )

    async def get_momentum(
        self, creator_name: str, videos: list[VideoRead] | None = None
    ) -> CreatorMomentumIntel:
        if videos is None:
            videos = await self._profiles.get_videos_for_creator(creator_name, limit=200)

        all_breakouts = (await self._growth.get_video_breakouts(limit=80)).items
        creator_breakouts = [b for b in all_breakouts if b.creator_name == creator_name]
        creator_breakouts.sort(key=lambda x: x.breakout_score, reverse=True)

        fastest = sorted(creator_breakouts, key=lambda x: x.views_delta_7d, reverse=True)

        latest = sorted(
            videos,
            key=lambda v: v.published_at or v.created_at,
            reverse=True,
        )[:6]

        return CreatorMomentumIntel(
            breakout_videos=creator_breakouts[:8],
            fastest_growing=fastest[:8],
            latest_uploads=latest,
        )

    async def _nearest_creators(
        self, creator_name: str, videos: list[VideoRead], limit: int = 5
    ) -> list[NearestCreator]:
        """Token overlap between creators — no embedding cluster."""
        my_tokens = _title_token_set(videos)
        if not my_tokens:
            return []

        others = list(
            (
                await self._db.execute(
                    select(Video.creator_name)
                    .where(func.lower(Video.creator_name) != creator_name.lower())
                    .distinct()
                )
            ).scalars()
        )

        scores: list[NearestCreator] = []
        for other in others[:80]:
            other_videos = await self._profiles.get_videos_for_creator(other, limit=40)
            other_tokens = _title_token_set(other_videos)
            if not other_tokens:
                continue
            overlap = my_tokens & other_tokens
            if len(overlap) < 2:
                continue
            score = len(overlap) / max(len(my_tokens | other_tokens), 1)
            scores.append(
                NearestCreator(
                    creator_name=other,
                    overlap_score=round(score, 3),
                    shared_topics=sorted(overlap)[:6],
                )
            )

        scores.sort(key=lambda x: x.overlap_score, reverse=True)
        return scores[:limit]


def _title_token_set(videos: list[VideoRead]) -> set[str]:
    tokens: set[str] = set()
    for video in videos:
        for word in re.findall(r"[a-z]{4,}", video.title.lower()):
            if word not in {"this", "that", "with", "from", "your", "what", "when"}:
                tokens.add(word)
    return tokens
