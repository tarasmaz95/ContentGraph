"""
Hook Intelligence Service — workspace, search, compare, generate.

Reads from hook_patterns table populated by HookIndexService.
"""

import re
from collections import defaultdict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hook_pattern import HookPattern
from app.schemas.common import ChartPoint, HookTypeStat, PatternStat
from app.schemas.hooks import (
    HookCharts,
    HookCompareRequest,
    HookCompareResult,
    HookGenerateRequest,
    HookGenerateResult,
    HookGenerationIntel,
    HookPatternRead,
    HookSearchResult,
    HookWorkspace,
)
from app.services.hooks.hook_types import ALL_HOOK_TYPES, HOOK_TYPE_LABELS
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService


class HookIntelligenceService:
    """Hook Intelligence layer — analytics, search, AI generation."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._profiles = CreatorProfileService(db)

    async def get_workspace(self) -> HookWorkspace:
        """Build /hooks page sections and charts."""
        patterns = await self._all_patterns()
        if not patterns:
            return HookWorkspace()

        charts = self._build_charts(patterns)
        categories = self._category_stats(patterns)
        emotional = self._emotional_stats(patterns)
        # HookWorkspace.viral_patterns expects PatternStat, not HookTypeStat
        viral = [
            PatternStat(
                pattern=c.hook_type,
                count=c.count,
                avg_views=c.avg_views,
            )
            for c in sorted(categories, key=lambda c: c.avg_views, reverse=True)[:8]
        ]

        top = sorted(patterns, key=lambda p: p.views_count, reverse=True)[:15]
        best = sorted(
            patterns,
            key=lambda p: (p.effectiveness_score, p.views_count),
            reverse=True,
        )[:15]

        trends = self._infer_trends(patterns, categories)

        return HookWorkspace(
            top_hooks=[self._to_read(p) for p in top],
            viral_patterns=viral,
            best_performing=[self._to_read(p) for p in best],
            categories=categories,
            emotional_triggers=emotional,
            trends=trends,
            charts=charts,
            total_hooks=len(patterns),
        )

    async def search(self, query: str, limit: int = 25) -> list[HookSearchResult]:
        """
        Semantic-style hook search — keyword + hook_type matching.

        Examples: identity hooks, AI productivity hooks, contrarian hooks
        """
        q = query.lower().strip()
        patterns = await self._all_patterns()
        if not patterns:
            return []

        # Map natural phrases to hook types
        type_hint = self._query_to_hook_type(q)

        scored: list[tuple[float, HookPattern]] = []
        for p in patterns:
            score = 0.0
            text = f"{p.hook_text} {p.video_title} {' '.join(p.keywords or [])}".lower()

            if type_hint and p.hook_type == type_hint:
                score += 0.45
            if q in text:
                score += 0.35
            for kw in q.split():
                if len(kw) > 2 and kw in text:
                    score += 0.08
            if p.hook_type in q:
                score += 0.25
            score += p.effectiveness_score * 0.15
            score += p.confidence_score * 0.1

            if score > 0.12:
                scored.append((score, p))

        scored.sort(key=lambda x: -x[0])
        return [
            HookSearchResult(pattern=self._to_read(p), relevance=round(s, 3))
            for s, p in scored[:limit]
        ]

    async def compare(self, body: HookCompareRequest) -> HookCompareResult:
        """Compare creators and/or hook types by effectiveness."""
        patterns = await self._all_patterns()
        filtered = patterns

        if body.creators:
            names = {n.lower() for n in body.creators}
            filtered = [p for p in filtered if p.creator_name.lower() in names]
        if body.hook_types:
            types = {t.lower() for t in body.hook_types}
            filtered = [p for p in filtered if p.hook_type in types]

        creator_stats: list[dict] = []
        by_creator: dict[str, list[HookPattern]] = defaultdict(list)
        for p in filtered:
            by_creator[p.creator_name].append(p)

        for name, rows in sorted(by_creator.items(), key=lambda x: -len(x[1])):
            avg_eff = sum(r.effectiveness_score for r in rows) / len(rows)
            avg_views = sum(r.views_count for r in rows) / len(rows)
            top_type = max(
                set(r.hook_type for r in rows),
                key=lambda t: sum(1 for r in rows if r.hook_type == t),
            )
            creator_stats.append(
                {
                    "creator_name": name,
                    "hook_count": len(rows),
                    "avg_effectiveness": round(avg_eff, 3),
                    "avg_views": round(avg_views, 1),
                    "top_hook_type": top_type,
                }
            )

        hook_type_stats = self._category_stats(filtered)
        triggers: dict[str, int] = defaultdict(int)
        for p in filtered:
            for t in p.emotional_triggers or []:
                triggers[t] += 1
        top_triggers = [k for k, _ in sorted(triggers.items(), key=lambda x: -x[1])[:10]]

        summary = (
            f"Compared {len(filtered)} hooks across "
            f"{len(by_creator)} creators and {len(hook_type_stats)} hook types."
        )

        return HookCompareResult(
            summary=summary,
            creator_stats=creator_stats,
            hook_type_stats=hook_type_stats,
            top_triggers=top_triggers,
            recommendations=_compare_recommendations(creator_stats, hook_type_stats),
        )

    async def generate(
        self,
        llm: ChatOpenAI,
        body: HookGenerateRequest,
    ) -> HookGenerateResult:
        """AI generates 10 hooks for creator + topic + type + tone."""
        style_context = ""
        if body.creator_name:
            profile = await self._profiles.get_profile(body.creator_name)
            videos = await self._profiles.get_videos_for_creator(body.creator_name, limit=15)
            titles = [v.title for v in videos[:10]]
            if profile:
                style_context = (
                    f"Creator: {profile.creator_name}\n"
                    f"Style: {profile.content_style}\n"
                    f"Hooks they use: {', '.join(profile.hook_patterns[:6])}\n"
                    f"Topics: {', '.join(profile.top_topics[:6])}\n"
                )
            elif titles:
                style_context = f"Creator: {body.creator_name}\nSample titles:\n" + "\n".join(
                    f"- {t}" for t in titles
                )

        # Pull top hooks of same type from DB for inspiration
        same_type = await self._patterns_by_type(body.hook_type, limit=8)
        examples = "\n".join(f'- "{p.hook_text[:80]}"' for p in same_type[:5])

        prompt_context = (
            f"Topic: {body.topic}\n"
            f"Hook type: {body.hook_type} ({HOOK_TYPE_LABELS.get(body.hook_type, body.hook_type)})\n"
            f"Tone: {body.tone}\n"
            f"{style_context}\n"
            f"High-performing examples in dataset:\n{examples or 'N/A'}"
        )
        style_notes = ""
        hooks: list[str] = []

        try:
            structured_llm = llm.with_structured_output(HookGenerationIntel)
            intel: HookGenerationIntel = await structured_llm.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "You are a viral YouTube title hook writer. "
                            "You MUST populate the hooks array with exactly 10 complete title lines. "
                            "Each hook is punchy, specific, and matches the requested type and tone. "
                            "Do not put the tone word alone in style_notes without also filling hooks."
                        )
                    ),
                    HumanMessage(content=prompt_context),
                ]
            )
            hooks = [h.strip() for h in intel.hooks if h and h.strip()][:10]
            style_notes = (intel.style_notes or "").strip()
        except Exception:
            hooks = []

        if len(hooks) < 10:
            hooks = await self._generate_hooks_plain(llm, prompt_context, hooks)

        used_placeholder = len(hooks) < 10
        while len(hooks) < 10:
            hooks.append(f"{body.topic} — variant {len(hooks) + 1}")

        if used_placeholder and not style_notes:
            style_notes = body.tone

        return HookGenerateResult(
            creator_name=body.creator_name,
            topic=body.topic,
            hook_type=body.hook_type,
            tone=body.tone,
            hooks=hooks[:10],
            style_notes=style_notes,
            used_placeholder=used_placeholder,
        )

    async def _generate_hooks_plain(
        self,
        llm: ChatOpenAI,
        prompt_context: str,
        existing: list[str],
    ) -> list[str]:
        """Fallback: plain-text numbered list when structured output returns empty hooks."""
        hooks = list(existing)
        need = 10 - len(hooks)
        if need <= 0:
            return hooks

        response = await llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "Write exactly 10 viral YouTube title hooks. "
                        "Return a numbered list 1–10, one hook per line, no extra commentary."
                    )
                ),
                HumanMessage(content=prompt_context),
            ]
        )
        text = response.content if isinstance(response.content, str) else str(response.content)
        for line in text.splitlines():
            cleaned = re.sub(r"^\s*\d+[\).\:\-]\s*", "", line).strip().strip('"')
            if len(cleaned) < 12:
                continue
            if cleaned.lower() in {h.lower() for h in hooks}:
                continue
            hooks.append(cleaned)
            if len(hooks) >= 10:
                break
        return hooks[:10]

    async def _all_patterns(self) -> list[HookPattern]:
        result = await self._db.execute(
            select(HookPattern).order_by(HookPattern.views_count.desc())
        )
        return list(result.scalars().all())

    async def _patterns_by_type(self, hook_type: str, limit: int) -> list[HookPattern]:
        stmt = (
            select(HookPattern)
            .where(HookPattern.hook_type == hook_type)
            .order_by(HookPattern.effectiveness_score.desc())
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    def _build_charts(self, patterns: list[HookPattern]) -> HookCharts:
        by_type: dict[str, list[HookPattern]] = defaultdict(list)
        by_creator: dict[str, list[HookPattern]] = defaultdict(list)
        triggers: dict[str, int] = defaultdict(int)

        for p in patterns:
            by_type[p.hook_type].append(p)
            by_creator[p.creator_name].append(p)
            for t in p.emotional_triggers or []:
                triggers[t] += 1

        type_dist = [
            ChartPoint(label=HOOK_TYPE_LABELS.get(t, t), value=float(len(rows)), count=len(rows))
            for t, rows in sorted(by_type.items(), key=lambda x: -len(x[1]))
        ]
        avg_by_type = [
            ChartPoint(
                label=HOOK_TYPE_LABELS.get(t, t),
                value=round(sum(r.views_count for r in rows) / len(rows), 1),
                count=len(rows),
            )
            for t, rows in sorted(by_type.items(), key=lambda x: -sum(r.views_count for r in x[1]))
        ]
        creator_comp = [
            ChartPoint(
                label=name,
                value=round(sum(r.effectiveness_score for r in rows) / len(rows), 3),
                count=len(rows),
            )
            for name, rows in sorted(by_creator.items(), key=lambda x: -len(x[1]))[:10]
        ]
        trigger_freq = [
            ChartPoint(label=k, value=float(v), count=v)
            for k, v in sorted(triggers.items(), key=lambda x: -x[1])[:12]
        ]

        return HookCharts(
            hook_type_distribution=type_dist,
            avg_views_by_type=avg_by_type,
            creator_hook_comparison=creator_comp,
            emotional_trigger_frequency=trigger_freq,
        )

    @staticmethod
    def _category_stats(patterns: list[HookPattern]) -> list[HookTypeStat]:
        buckets: dict[str, list[HookPattern]] = defaultdict(list)
        for p in patterns:
            buckets[p.hook_type].append(p)

        stats = [
            HookTypeStat(
                hook_type=HOOK_TYPE_LABELS.get(t, t),
                count=len(rows),
                avg_views=round(sum(r.views_count for r in rows) / len(rows), 1),
            )
            for t, rows in buckets.items()
        ]
        stats.sort(key=lambda s: s.avg_views, reverse=True)
        return stats

    @staticmethod
    def _emotional_stats(patterns: list[HookPattern]) -> list[PatternStat]:
        counts: dict[str, list[int]] = defaultdict(list)
        for p in patterns:
            for t in p.emotional_triggers or []:
                counts[t].append(p.views_count)

        return sorted(
            [
                PatternStat(
                    pattern=k,
                    count=len(vs),
                    avg_views=round(sum(vs) / len(vs), 1),
                )
                for k, vs in counts.items()
            ],
            key=lambda x: -x.avg_views,
        )[:15]

    @staticmethod
    def _infer_trends(
        patterns: list[HookPattern],
        categories: list[HookTypeStat],
    ) -> list[str]:
        """Lightweight trend lines from aggregate stats."""
        trends: list[str] = []
        if categories:
            top = categories[0]
            trends.append(
                f"{top.hook_type} hooks average {top.avg_views:,.0f} views ({top.count} instances)"
            )
        high_eff = sorted(patterns, key=lambda p: p.effectiveness_score, reverse=True)[:3]
        for p in high_eff:
            trends.append(
                f"High effectiveness: {p.hook_type} on «{p.video_title[:50]}…»"
            )
        return trends[:8]

    @staticmethod
    def _query_to_hook_type(query: str) -> str | None:
        """Map search phrases to hook_type slug."""
        mapping = {
            "curiosity": "curiosity",
            "urgency": "urgency",
            "transformation": "transformation",
            "authority": "authority",
            "fear": "fear_loss",
            "loss": "fear_loss",
            "identity": "identity",
            "contrarian": "contrarian",
            "prediction": "prediction",
            "social proof": "social_proof",
            "social_proof": "social_proof",
            "how to": "how_to",
            "how-to": "how_to",
        }
        for phrase, hook_type in mapping.items():
            if phrase in query:
                return hook_type
        for t in ALL_HOOK_TYPES:
            if t.replace("_", " ") in query or t in query:
                return t
        return None

    @staticmethod
    def _to_read(row: HookPattern) -> HookPatternRead:
        return HookPatternRead(
            id=row.id,
            video_id=row.video_id,
            hook_text=row.hook_text,
            hook_type=row.hook_type,
            creator_name=row.creator_name,
            views_count=row.views_count,
            video_title=row.video_title,
            effectiveness_score=row.effectiveness_score,
            confidence_score=row.confidence_score,
            keywords=list(row.keywords or []),
            emotional_triggers=list(row.emotional_triggers or []),
            created_at=row.created_at,
        )


def _compare_recommendations(
    creator_stats: list[dict],
    hook_stats: list[HookTypeStat],
) -> list[str]:
    recs: list[str] = []
    if hook_stats:
        recs.append(
            f"Double down on {hook_stats[0].hook_type} hooks — highest avg views in dataset."
        )
    if creator_stats:
        leader = max(creator_stats, key=lambda c: c.get("avg_effectiveness", 0))
        recs.append(
            f"Study {leader['creator_name']}'s {leader.get('top_hook_type', '')} hook patterns."
        )
    return recs
