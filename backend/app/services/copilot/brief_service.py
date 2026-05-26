"""
AI Briefs — concise, actionable summaries without extra LLM calls.

Templates filled from creator profiles, video intelligence, comments, trends.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.schemas.copilot import AIBrief
from app.services.analytics.dashboard_service import DashboardAnalyticsService
from app.services.comments.audience_intelligence_service import AudienceIntelligenceService
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.video_intelligence.video_intelligence_service import VideoIntelligenceService
from app.services.video_service import VideoService


class BriefService:
    """Builds scannable briefs for creators, videos, audience, and trends."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._videos = VideoService(db)
        self._profiles = CreatorProfileService(db)

    async def creator_brief(self, creator_name: str) -> AIBrief | None:
        profile = await self._profiles.get_profile(creator_name)
        n, avg, total = await self._profiles.compute_stats(creator_name)

        bullets: list[str] = []
        actions: list[str] = []

        if profile:
            bullets.append(f"Style: {profile.content_style}")
            if profile.top_topics:
                bullets.append(f"Top topics: {', '.join(profile.top_topics[:4])}")
            if profile.hook_patterns:
                bullets.append(f"Signature hooks: {', '.join(profile.hook_patterns[:3])}")
            bullets.append(profile.creator_summary[:200] if profile.creator_summary else "")
            actions.append(f"Generate hooks aligned with {profile.hook_patterns[0] if profile.hook_patterns else 'curiosity'}")
        else:
            bullets.append(f"{n} videos synced · {int(avg):,} avg views")

        actions.append("Compare with a peer creator in AI Chat")
        actions.append("Open hook workspace for pattern ideas")

        return AIBrief(
            brief_type="creator",
            title=creator_name,
            headline=f"{total:,} total views · {n} videos in catalog",
            bullets=[b for b in bullets if b][:5],
            actions=actions[:3],
        )

    async def video_brief(self, video_id: int) -> AIBrief | None:
        intel = await VideoIntelligenceService(self._db).get_intelligence(
            video_id, llm=None, refresh=False
        )
        if intel is None:
            return None

        b = intel.breakdown
        bullets = [
            intel.overview.performance_tier.title() + " tier performance",
            b.hook_effectiveness[:120] if b.hook_effectiveness else "",
            f"Storytelling: {', '.join(b.storytelling_patterns[:2])}" if b.storytelling_patterns else "",
        ]
        if intel.transcript_intel.strongest_insights:
            bullets.append(intel.transcript_intel.strongest_insights[0][:120])

        actions = [
            "Review structure timeline for reusable sections",
            "Save viral frameworks to Research",
        ]
        if intel.similar_videos:
            actions.append(f"Study similar hit: {intel.similar_videos[0].title[:50]}")

        return AIBrief(
            brief_type="video",
            title=intel.overview.title[:80],
            headline=b.why_performed[:160] if b.why_performed else "Video intelligence ready",
            bullets=[x for x in bullets if x][:5],
            actions=actions[:3],
        )

    async def audience_brief(self, video_id: int) -> AIBrief | None:
        video = await self._db.get(Video, video_id)
        if video is None:
            return None

        comments = await AudienceIntelligenceService(self._db).build_for_video(video_id)
        headline = comments.summary or "Audience signals from top comments"

        bullets = comments.audience_reactions[:2]
        if comments.pain_points:
            bullets.append(f"Pain: {comments.pain_points[0][:100]}")
        if comments.questions:
            bullets.append(f"Asked: {comments.questions[0][:100]}")
        bullets.append(
            f"Sentiment split: {comments.positive_pct}% positive · "
            f"{comments.negative_pct}% negative"
        )

        actions = [
            "Address top question in your next video intro",
            "Test a hook that reduces confusion points",
        ]
        if comments.audience_desires:
            actions.append(f"Content idea: {comments.audience_desires[0][:80]}")

        return AIBrief(
            brief_type="audience",
            title=video.title[:80],
            headline=headline,
            bullets=[b for b in bullets if b][:5],
            actions=actions[:3],
        )

    async def trend_brief(self) -> AIBrief:
        sample_size = 200
        videos, catalog_total = await self._videos.list_videos(
            limit=sample_size, offset=0
        )
        dash = await DashboardAnalyticsService(self._videos).get_dashboard(sample_size)
        topics = dash.trend_analysis.trending_topics[:3]
        keywords = [k.keyword for k in dash.trend_analysis.rising_keywords[:4]]
        hooks = [h.hook_type for h in dash.hook_analysis.hook_types[:3]]
        catalog_count = dash.metrics.total_videos or catalog_total

        return AIBrief(
            brief_type="trend",
            title="Catalog Trends",
            headline="What is working across your synced YouTube data",
            bullets=[
                f"Topics: {', '.join(topics)}" if topics else "Sync more videos for topics",
                f"Keywords: {', '.join(keywords)}" if keywords else "",
                f"Top hook types: {', '.join(hooks)}" if hooks else "",
                f"Avg views: {dash.metrics.avg_views:,.0f} across {catalog_count:,} catalog videos",
            ],
            actions=[
                "Open Intelligence Feed for today's signals",
                "Run trend analysis in AI Chat",
                "Generate hooks for a rising keyword",
            ],
            catalog_total=catalog_total,
            sample_size=sample_size,
        )

    async def top_hooks_for_creator(self, creator_name: str, limit: int = 3) -> list[str]:
        """Recommended hook lines from indexed patterns."""
        stmt = (
            select(HookPattern.hook_text)
            .where(HookPattern.creator_name.ilike(f"%{creator_name}%"))
            .order_by(HookPattern.effectiveness_score.desc())
            .limit(limit)
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def suggested_topics_for_creator(self, creator_name: str, limit: int = 5) -> list[str]:
        """Topic hints from video titles + comment confusion themes."""
        stmt = (
            select(Video.title)
            .where(Video.creator_name.ilike(f"%{creator_name}%"))
            .order_by(Video.views_count.desc())
            .limit(limit)
        )
        titles = list((await self._db.execute(stmt)).scalars().all())
        return [t[:60] for t in titles]
