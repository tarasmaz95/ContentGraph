"""
AI Copilot orchestrator — panel, recommendations, research hints.

Combines insight engine, briefs, feed, and personalization boosts.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.schemas.copilot import (
    CopilotPanelResponse,
    CopilotRecommendation,
    PersonalizationInput,
    ResearchAssistantHints,
)
from app.services.copilot.brief_service import BriefService
from app.services.copilot.feed_service import FeedService
from app.services.copilot.insight_engine import InsightEngine
from app.services.copilot.suggestion_service import SuggestionService
from app.services.research.research_service import ResearchService
from app.utils.creator_slug import slug_to_search_terms, slugify_creator_name


class CopilotService:
    """Main entry for copilot API — context-aware proactive intelligence."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._insights = InsightEngine(db)
        self._briefs = BriefService(db)
        self._feed = FeedService(db)
        self._suggestions = SuggestionService()

    async def get_panel(
        self,
        context: str,
        creator_name: str | None = None,
        video_id: int | None = None,
        personalization: PersonalizationInput | None = None,
    ) -> CopilotPanelResponse:
        """
        Build sidebar payload for current page.

        context: dashboard | creator | video | research | chat | hooks | analytics
        """
        p = personalization or PersonalizationInput()
        smart = await self._insights.global_insights(limit=4)
        recs: list[CopilotRecommendation] = []
        brief = None

        if context == "creator" and creator_name:
            resolved = await self._resolve_creator_name(creator_name)
            smart = await self._insights.creator_insights(resolved, limit=5)
            brief = await self._briefs.creator_brief(resolved)
            recs.extend(await self._creator_recommendations(resolved))
        elif context == "video" and video_id:
            smart = await self._insights.video_insights(video_id, limit=4)
            smart.extend(await self._insights.global_insights(limit=2))
            brief = await self._briefs.video_brief(video_id)
            recs.extend(await self._video_recommendations(video_id))
        elif context == "research":
            smart = await self._insights.global_insights(limit=3)
            recs.append(
                CopilotRecommendation(
                    label="Open Intelligence Feed",
                    description="Today's viral trends and hook opportunities",
                    href="/feed",
                    kind="analysis",
                )
            )
        else:
            brief = await self._briefs.trend_brief()
            recs.extend(await self._global_recommendations())

        # Personalization boosts — surface recently viewed creators
        for creator in p.viewed_creators[:2]:
            slug = slugify_creator_name(creator)
            if not any(r.href == f"/creators/{slug}" for r in recs):
                recs.insert(
                    0,
                    CopilotRecommendation(
                        label=f"Continue: {creator}",
                        description="Recently viewed creator profile",
                        href=f"/creators/{slug}",
                        kind="creator",
                    ),
                )

        for search in p.recent_searches[:1]:
            recs.append(
                CopilotRecommendation(
                    label=f"Search: {search[:40]}",
                    description="Repeat semantic search in chat",
                    href=f"/chat?q={search[:60]}",
                    kind="analysis",
                )
            )

        catalog_total = int(
            await self._db.scalar(select(func.count()).select_from(Video)) or 0
        )
        hook_patterns_count = int(
            await self._db.scalar(select(func.count()).select_from(HookPattern)) or 0
        )
        sample_size = brief.sample_size if brief and brief.sample_size else 200

        return CopilotPanelResponse(
            context=context,
            smart_insights=smart[:6],
            recommendations=recs[:8],
            brief=brief,
            catalog_video_count=catalog_total,
            hook_patterns_count=hook_patterns_count,
            analytics_sample_size=sample_size,
        )

    async def research_assistant(
        self,
        tags: list[str] | None = None,
        creator_name: str | None = None,
    ) -> ResearchAssistantHints:
        """Related insights and tags for research workspace."""
        research = ResearchService(self._db)
        insights = await research.list_insights(limit=30)
        notes = await research.list_notes(limit=20)

        snippets = [i.insight_text[:120] for i in insights[:6]]
        all_tags: list[str] = []
        for i in insights:
            all_tags.extend(i.tags)
        for n in notes:
            all_tags.extend(n.tags)

        creators = [n.creator_name for n in notes if n.creator_name]

        return self._suggestions.research_hints(
            tags=tags or [],
            creator_name=creator_name,
            recent_insight_snippets=snippets,
            all_tags=all_tags,
            creators_in_notes=[c for c in creators if c],
        )

    def chat_suggestions(self, analysis_type: str, structured_raw: dict, query: str) -> list[str]:
        """Follow-up questions after chat — called from AIChatService."""
        from app.schemas.analytics import StructuredAnalytics

        structured = (
            StructuredAnalytics.model_validate(structured_raw)
            if structured_raw
            else None
        )
        return self._suggestions.chat_suggestions(analysis_type, structured, query)

    async def get_feed(self, limit: int = 20):
        return await self._feed.get_feed(limit=limit)

    async def _creator_recommendations(self, creator_name: str) -> list[CopilotRecommendation]:
        slug = slugify_creator_name(creator_name)
        recs: list[CopilotRecommendation] = [
            CopilotRecommendation(
                label="Generate hooks",
                description="AI hooks tuned to this creator's style",
                href="/hooks",
                kind="hook",
            ),
            CopilotRecommendation(
                label="Write a script",
                description="Creator-aware script generation",
                href="/scripts",
                kind="topic",
            ),
        ]
        hooks = await self._briefs.top_hooks_for_creator(creator_name, limit=2)
        for i, hook in enumerate(hooks):
            recs.append(
                CopilotRecommendation(
                    label=f"Top hook #{i + 1}",
                    description=hook[:80],
                    href=f"/creators/{slug}",
                    kind="hook",
                )
            )
        topics = await self._briefs.suggested_topics_for_creator(creator_name, limit=2)
        for topic in topics:
            recs.append(
                CopilotRecommendation(
                    label="High-performing topic",
                    description=topic,
                    href=f"/chat?q=Analyze videos about {topic[:40]}",
                    kind="topic",
                )
            )
        return recs

    async def _video_recommendations(self, video_id: int) -> list[CopilotRecommendation]:
        video = await self._db.get(Video, video_id)
        if video is None:
            return []

        recs = [
            CopilotRecommendation(
                label="Audience brief",
                description="Pain points and questions from comments",
                href=f"/videos/{video_id}",
                kind="analysis",
            ),
            CopilotRecommendation(
                label="Ask about this video",
                description="Deep breakdown in AI Chat",
                href=f"/chat?q=video {video_id} breakdown",
                kind="analysis",
            ),
        ]

        # Similar viral videos from top views same creator
        stmt = (
            select(Video)
            .where(
                Video.creator_name == video.creator_name,
                Video.id != video_id,
            )
            .order_by(Video.views_count.desc())
            .limit(2)
        )
        for other in (await self._db.execute(stmt)).scalars().all():
            recs.append(
                CopilotRecommendation(
                    label="Similar viral video",
                    description=other.title[:70],
                    href=f"/videos/{other.id}",
                    kind="video",
                )
            )
        return recs

    async def _resolve_creator_name(self, name_or_slug: str) -> str:
        """Map URL slug to DB creator_name when possible."""
        search = slug_to_search_terms(name_or_slug)
        stmt = (
            select(Video.creator_name)
            .where(Video.creator_name.ilike(f"%{search}%"))
            .limit(1)
        )
        found = await self._db.scalar(stmt)
        return found or name_or_slug.replace("-", " ").title()

    async def _global_recommendations(self) -> list[CopilotRecommendation]:
        return [
            CopilotRecommendation(
                label="Intelligence Feed",
                description="Viral trends, keywords, hook opportunities",
                href="/feed",
                kind="analysis",
            ),
            CopilotRecommendation(
                label="Compare creators",
                description="Side-by-side creator intelligence",
                href="/creators",
                kind="creator",
            ),
            CopilotRecommendation(
                label="Hook workspace",
                description="Search and generate high-performing hooks",
                href="/hooks",
                kind="hook",
            ),
        ]
