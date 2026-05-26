"""
Deterministic smart insights — hooks, audience, trends.

No LLM — fast proactive bullets for the copilot panel.
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.schemas.copilot import SmartInsight
from app.services.analytics.dashboard_service import DashboardAnalyticsService
from app.services.video_service import VideoService


class InsightEngine:
    """Generates data-backed proactive insights from Postgres."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def global_insights(self, limit: int = 6) -> list[SmartInsight]:
        """Catalog-wide insights for dashboard, feed, and default panel."""
        insights: list[SmartInsight] = []
        insights.extend(await self._hook_performance_insights())
        insights.extend(await self._audience_insights())
        insights.extend(await self._trend_insights())
        return insights[:limit]

    async def creator_insights(self, creator_name: str, limit: int = 5) -> list[SmartInsight]:
        """Creator-scoped hook and performance signals."""
        insights: list[SmartInsight] = []
        creator_lower = creator_name.lower().strip()

        # Best hook type for this creator
        stmt = (
            select(
                HookPattern.hook_type,
                func.avg(HookPattern.views_count).label("avg_v"),
                func.count().label("cnt"),
            )
            .where(HookPattern.creator_name.ilike(f"%{creator_name}%"))
            .group_by(HookPattern.hook_type)
            .order_by(func.avg(HookPattern.views_count).desc())
            .limit(3)
        )
        rows = (await self._db.execute(stmt)).all()
        if rows:
            top = rows[0]
            insights.append(
                SmartInsight(
                    id=f"creator-hook-{creator_lower}",
                    text=(
                        f"{top.hook_type.title()} hooks lead for {creator_name} "
                        f"({int(top.avg_v or 0):,} avg views across {top.cnt} videos)"
                    ),
                    category="hooks",
                    priority="high",
                    href=f"/creators/{creator_name}",
                    hook_type=top.hook_type,
                    avg_views=int(top.avg_v or 0),
                    pattern_count=int(top.cnt),
                    creator_name=creator_name,
                )
            )

        # Creator vs catalog avg views
        vid_stmt = select(func.avg(Video.views_count)).where(
            Video.creator_name.ilike(f"%{creator_name}%")
        )
        creator_avg = float(await self._db.scalar(vid_stmt) or 0)
        global_avg = float(
            await self._db.scalar(select(func.avg(Video.views_count))) or 1
        )
        if creator_avg > global_avg * 1.2:
            pct = round(100 * (creator_avg - global_avg) / global_avg)
            insights.append(
                SmartInsight(
                    id=f"creator-strong-{creator_lower}",
                    text=f"{creator_name} averages {pct}% above catalog view baseline",
                    category="creator",
                    priority="medium",
                    href=f"/creators/{creator_name}",
                    outperform_pct=pct,
                    creator_name=creator_name,
                )
            )

        insights.extend(await self._hook_performance_insights(creator_filter=creator_name))
        return insights[:limit]

    async def video_insights(self, video_id: int, limit: int = 4) -> list[SmartInsight]:
        """Video-level signals from hooks and comments."""
        video = await self._db.get(Video, video_id)
        if video is None:
            return []

        insights: list[SmartInsight] = []

        hook_stmt = (
            select(HookPattern.hook_type)
            .where(HookPattern.video_id == video_id)
            .order_by(HookPattern.effectiveness_score.desc())
            .limit(1)
        )
        top_hook = await self._db.scalar(hook_stmt)
        if top_hook:
            insights.append(
                SmartInsight(
                    id=f"video-hook-{video_id}",
                    text=f"Primary hook type: {top_hook} — review hook effectiveness in breakdown",
                    category="hooks",
                    priority="medium",
                    href=f"/videos/{video_id}",
                    hook_type=top_hook,
                )
            )

        comment_count = int(
            await self._db.scalar(
                select(func.count()).select_from(Comment).where(Comment.video_id == video_id)
            )
            or 0
        )
        if comment_count:
            neg = int(
                await self._db.scalar(
                    select(func.count())
                    .select_from(Comment)
                    .where(Comment.video_id == video_id, Comment.sentiment == "negative")
                )
                or 0
            )
            if neg / max(comment_count, 1) > 0.35:
                insights.append(
                    SmartInsight(
                        id=f"video-sentiment-{video_id}",
                        text="Elevated negative comment sentiment — check audience brief",
                        category="audience",
                        priority="high",
                        href=f"/videos/{video_id}",
                    )
                )

        return insights[:limit]

    async def _hook_performance_insights(
        self, creator_filter: str | None = None
    ) -> list[SmartInsight]:
        """Compare hook-type averages to catalog baseline."""
        global_avg = float(
            await self._db.scalar(select(func.avg(HookPattern.views_count))) or 0
        )
        if global_avg <= 0:
            return []

        stmt = select(
            HookPattern.hook_type,
            func.avg(HookPattern.views_count).label("avg_v"),
            func.count().label("cnt"),
        ).group_by(HookPattern.hook_type)

        if creator_filter:
            stmt = stmt.where(HookPattern.creator_name.ilike(f"%{creator_filter}%"))

        stmt = stmt.having(func.count() >= 2).order_by(
            func.avg(HookPattern.views_count).desc()
        )

        rows = (await self._db.execute(stmt)).all()
        insights: list[SmartInsight] = []

        for row in rows[:3]:
            avg_v = float(row.avg_v or 0)
            if avg_v <= global_avg:
                continue
            pct = round(100 * (avg_v - global_avg) / global_avg)
            if pct < 15:
                continue
            insights.append(
                SmartInsight(
                    id=f"hook-outperform-{row.hook_type}",
                    text=(
                        f"{row.hook_type.title()} hooks outperform average by {pct}% "
                        f"({int(avg_v):,} avg views)"
                    ),
                    category="hooks",
                    priority="high" if pct >= 30 else "medium",
                    href="/hooks",
                    hook_type=row.hook_type,
                    outperform_pct=pct,
                    avg_views=int(avg_v),
                    baseline_avg_views=int(global_avg),
                    pattern_count=int(row.cnt),
                )
            )

        # Curiosity engagement line (common pattern)
        curiosity = next((r for r in rows if r.hook_type == "curiosity"), None)
        if curiosity and float(curiosity.avg_v or 0) >= global_avg:
            insights.append(
                SmartInsight(
                    id="hook-curiosity-engagement",
                    text="Curiosity hooks correlate with highest engagement in your catalog",
                    category="hooks",
                    priority="medium",
                    href="/hooks",
                    hook_type="curiosity",
                    avg_views=int(float(curiosity.avg_v or 0)),
                    baseline_avg_views=int(global_avg),
                    pattern_count=int(curiosity.cnt),
                )
            )

        return insights

    async def _audience_insights(self) -> list[SmartInsight]:
        """Signals from stored YouTube comments."""
        total = int(
            await self._db.scalar(select(func.count()).select_from(Comment)) or 0
        )
        if total < 5:
            return []

        insights: list[SmartInsight] = []

        # Confusion-heavy comments
        confusion_rows = (
            await self._db.execute(
                select(Comment.comment_text)
                .where(Comment.emotional_tags.astext.ilike("%confusion%"))
                .order_by(Comment.likes_count.desc())
                .limit(5)
            )
        ).scalars().all()

        if confusion_rows:
            topic = _guess_topic_from_comments(list(confusion_rows))
            insights.append(
                SmartInsight(
                    id="audience-confusion",
                    text=f"Audience confusion detected around {topic}",
                    category="audience",
                    priority="high",
                    href="/feed",
                    topic=topic,
                )
            )

        # Skepticism spike
        skeptic_count = int(
            await self._db.scalar(
                select(func.count())
                .select_from(Comment)
                .where(Comment.emotional_tags.astext.ilike("%skepticism%"))
            )
            or 0
        )
        if skeptic_count >= 3:
            insights.append(
                SmartInsight(
                    id="audience-skepticism",
                    text="Skepticism tags rising in comments — consider addressing objections early",
                    category="audience",
                    priority="medium",
                    href="/chat",
                )
            )

        return insights

    async def _trend_insights(self) -> list[SmartInsight]:
        """Keyword / topic signals from dashboard deterministic analytics."""
        dash = await DashboardAnalyticsService(VideoService(self._db)).get_dashboard(
            limit=150
        )
        insights: list[SmartInsight] = []
        if dash.trend_analysis.trending_topics:
            topic = dash.trend_analysis.trending_topics[0]
            insights.append(
                SmartInsight(
                    id="trend-topic",
                    text=f"Trending topic cluster: {topic}",
                    category="trend",
                    priority="medium",
                    href="/feed",
                    topic=topic,
                )
            )
        if dash.trend_analysis.rising_keywords:
            kw = dash.trend_analysis.rising_keywords[0]
            insights.append(
                SmartInsight(
                    id="trend-keyword",
                    text=f"Rising keyword: \"{kw.keyword}\" ({kw.count} videos)",
                    category="trend",
                    priority="low",
                    href="/analytics",
                    keyword=kw.keyword,
                    keyword_video_count=kw.count,
                )
            )
        return insights


def _guess_topic_from_comments(texts: list[str]) -> str:
    """Extract a short topic label from confusion comments."""
    words: Counter[str] = Counter()
    stop = {
        "the", "this", "that", "what", "how", "why", "video", "about", "really",
        "dont", "don't", "understand", "confused",
    }
    for text in texts:
        for w in text.lower().split():
            cleaned = "".join(c for c in w if c.isalnum())
            if len(cleaned) >= 4 and cleaned not in stop:
                words[cleaned] += 1
    if words:
        return words.most_common(1)[0][0]
    return "key themes"
