"""
Video Intelligence Service — deep per-video breakdown, transcript, viral, similar.

Combines deterministic transcript parsing with one LLM call for AI breakdown + structure.
"""

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.schemas.common import ChartPoint, KeywordStat
from app.schemas.video import VideoDetail
from app.schemas.video_intelligence import (
    AudienceIntelMvp,
    AudienceAnalysisIntel,
    CommentsAnalysisIntel,
    SimilarVideoItem,
    StructureAnalysis,
    StructureSection,
    TranscriptAnalysisIntel,
    TranscriptIntelligence,
    VideoBreakdown,
    VideoBreakdownIntel,
    VideoCharts,
    VideoIntelligence,
    VideoOverview,
    ViralAnalysis,
    ViralAnalysisIntel,
)
from app.services.analytics._video_data import keyword_stats_from_titles
from app.services.analytics.pattern_detection import extract_title_features
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.video_intelligence.transcript_analyzer import (
    analyze_transcript,
    structure_timeline_chunks,
    topic_frequency_chart,
)
from app.services.comments.audience_intelligence_service import AudienceIntelligenceService
from app.services.video_service import VideoService
from app.models.video import Video


class _VideoIntelLLM(BaseModel):
    """Single LLM pass for breakdown + structure + viral factors."""

    why_performed: str = ""
    hook_effectiveness: str = ""
    emotional_triggers: list[str] = Field(default_factory=list)
    storytelling_patterns: list[str] = Field(default_factory=list)
    pacing: str = ""
    communication_style: str = ""
    cta_patterns: list[str] = Field(default_factory=list)
    audience_targeting: str = ""
    recommendations: list[str] = Field(default_factory=list)
    hook: str = ""
    intro: str = ""
    key_sections: list[str] = Field(default_factory=list)
    transitions: list[str] = Field(default_factory=list)
    cta: str = ""
    closing: str = ""
    viral_factors: list[str] = Field(default_factory=list)
    reusable_frameworks: list[str] = Field(default_factory=list)
    creator_patterns: list[str] = Field(default_factory=list)

    @field_validator(
        "emotional_triggers",
        "storytelling_patterns",
        "cta_patterns",
        "recommendations",
        "key_sections",
        "transitions",
        "viral_factors",
        "reusable_frameworks",
        "creator_patterns",
        mode="before",
    )
    @classmethod
    def _coerce_str_list(cls, value: object) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [value.strip()] if value.strip() else []
        return value  # type: ignore[return-value]


class VideoIntelligenceService:
    """Builds /videos/[id] intelligence and powers LangGraph video analysis types."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._videos = VideoService(db)
        self._profiles = CreatorProfileService(db)
        self._audience = AudienceIntelligenceService(db)

    async def get_intelligence(
        self,
        video_id: int,
        llm: ChatOpenAI | None = None,
        refresh: bool = False,
    ) -> VideoIntelligence | None:
        """
        Full video intelligence page payload.

        Uses deterministic transcript analysis always; LLM enriches breakdown when available.
        """
        video = await self._videos.get_by_id(video_id)
        if video is None:
            return None

        hooks = await self._hooks_for_video(video_id)
        hook_types = list({h.hook_type for h in hooks})
        primary_hook = hooks[0].hook_type if hooks else _hook_from_title(video.title)

        orm_video = await self._db.get(Video, video_id)
        comment_count = (
            await self._audience.ensure_comments(orm_video) if orm_video else 0
        )
        overview = self._build_overview(
            video, hook_types, primary_hook, comment_count=comment_count
        )
        comments_intel = await self._audience.build_for_video(
            video_id, llm=llm, refresh=refresh
        )
        transcript_intel = analyze_transcript(video.transcript)

        # Creator context for LLM
        profile = await self._profiles.get_profile(video.creator_name)
        creator_ctx = ""
        if profile:
            creator_ctx = (
                f"Style: {profile.content_style}\n"
                f"Communication: {profile.communication_style}\n"
                f"Topics: {', '.join(profile.top_topics[:6])}\n"
                f"Hooks: {', '.join(profile.hook_patterns[:6])}"
            )

        breakdown, structure, viral = self._default_ai_sections(
            video, transcript_intel, hook_types
        )

        llm_out: _VideoIntelLLM | None = None
        if llm is not None:
            try:
                llm_out = await self._llm_analyze(
                    llm, video, transcript_intel, creator_ctx, hooks, refresh
                )
            except Exception:
                llm_out = None

        if llm_out is not None:
            breakdown = VideoBreakdown(
                why_performed=llm_out.why_performed,
                hook_effectiveness=llm_out.hook_effectiveness,
                emotional_triggers=llm_out.emotional_triggers or transcript_intel.emotional_phrases,
                storytelling_patterns=llm_out.storytelling_patterns,
                pacing=llm_out.pacing,
                communication_style=llm_out.communication_style,
                cta_patterns=llm_out.cta_patterns or transcript_intel.cta_sections[:4],
                audience_targeting=llm_out.audience_targeting,
                recommendations=llm_out.recommendations,
            )
            structure = StructureAnalysis(
                hook=llm_out.hook,
                intro=llm_out.intro,
                key_sections=[
                    StructureSection(section=f"Section {i + 1}", summary=s)
                    for i, s in enumerate(llm_out.key_sections[:6])
                ],
                transitions=llm_out.transitions,
                cta=llm_out.cta,
                closing=llm_out.closing,
            )
            viral = ViralAnalysis(
                viral_factors=llm_out.viral_factors,
                reusable_frameworks=llm_out.reusable_frameworks,
                top_keywords=self._keywords(video),
                emotional_triggers=breakdown.emotional_triggers,
                creator_patterns=llm_out.creator_patterns,
            )
        else:
            viral.top_keywords = self._keywords(video)

        similar = await self._similar_videos(video, primary_hook)
        charts = self._build_charts(video, transcript_intel)

        audience_intel = AudienceIntelMvp(
            top_reactions=comments_intel.audience_reactions[:6],
            repeated_phrases=comments_intel.recurring_phrases[:8],
            pain_points=comments_intel.pain_points[:6],
            top_comment_preview=(
                comments_intel.top_comments[0].comment_text[:220]
                if comments_intel.top_comments
                else ""
            ),
        )

        return VideoIntelligence(
            video=video,
            overview=overview,
            breakdown=breakdown,
            transcript_intel=transcript_intel,
            structure=structure,
            viral=viral,
            similar_videos=similar,
            charts=charts,
            comments=comments_intel,
            audience_intel=audience_intel,
        )

    async def breakdown_for_graph(
        self,
        llm: ChatOpenAI,
        video_id: int,
        query: str,
    ) -> VideoBreakdownIntel:
        """LangGraph video_breakdown — focused performance analysis."""
        intel = await self.get_intelligence(video_id, llm=llm, refresh=True)
        if intel is None:
            return VideoBreakdownIntel()
        return VideoBreakdownIntel(
            video_id=video_id,
            title=intel.video.title,
            breakdown=intel.breakdown,
            structure=intel.structure,
        )

    async def transcript_for_graph(
        self,
        llm: ChatOpenAI,
        video_id: int,
    ) -> TranscriptAnalysisIntel:
        """LangGraph transcript_analysis."""
        video = await self._videos.get_by_id(video_id)
        if not video:
            return TranscriptAnalysisIntel()

        ti = analyze_transcript(video.transcript)
        class _Recs(BaseModel):
            recommendations: list[str] = Field(default_factory=list)

        recs: _Recs = await llm.with_structured_output(_Recs).ainvoke(
            [
                SystemMessage(content="You analyze YouTube transcripts for insights."),
                HumanMessage(
                    content=(
                        f"Title: {video.title}\n"
                        f"Themes: {ti.repeated_themes}\n"
                        f"Key moments: {[m.excerpt[:100] for m in ti.key_moments]}\n"
                        "Give 4 actionable recommendations."
                    )
                ),
            ]
        )
        return TranscriptAnalysisIntel(
            video_id=video_id,
            transcript_intel=ti,
            recommendations=recs.recommendations,
        )

    async def audience_for_graph(
        self,
        llm: ChatOpenAI,
        video_id: int,
        query: str,
    ) -> AudienceAnalysisIntel:
        """LangGraph audience_analysis — reactions, pain points, desires."""
        intel = await self.get_intelligence(video_id, llm=llm, refresh=True)
        if intel is None:
            return AudienceAnalysisIntel()

        recs = [
            f"Sentiment: {intel.comments.positive_pct}% positive, "
            f"{intel.comments.negative_pct}% negative",
        ]
        if intel.comments.pain_points:
            recs.append(f"Address pain: {intel.comments.pain_points[0][:120]}")
        if intel.comments.questions:
            recs.append(f"Answer FAQ: {intel.comments.questions[0][:120]}")

        return AudienceAnalysisIntel(
            video_id=video_id,
            summary=intel.comments.summary or query,
            comments_intel=intel.comments,
            recommendations=recs[:5],
        )

    async def comments_for_graph(
        self, llm: ChatOpenAI, video_id: int
    ) -> CommentsAnalysisIntel:
        """LangGraph comments_analysis — themes and sentiment breakdown."""
        intel = await self.get_intelligence(video_id, llm=llm, refresh=False)
        if intel is None:
            return CommentsAnalysisIntel()

        sentiments: dict[str, int] = {}
        for row in intel.comments.top_comments:
            sentiments[row.sentiment] = sentiments.get(row.sentiment, 0) + 1

        return CommentsAnalysisIntel(
            video_id=video_id,
            comments_intel=intel.comments,
            top_themes=intel.comments.emotional_patterns[:6],
            sentiment_breakdown=sentiments,
            recommendations=[
                f"Top reaction: {r}" for r in intel.comments.audience_reactions[:3]
            ],
        )

    async def viral_for_graph(
        self,
        llm: ChatOpenAI,
        video_id: int,
    ) -> ViralAnalysisIntel:
        """LangGraph viral_analysis."""
        intel = await self.get_intelligence(video_id, llm=llm, refresh=True)
        if intel is None:
            return ViralAnalysisIntel()
        return ViralAnalysisIntel(
            video_id=video_id,
            viral=intel.viral,
            summary=intel.breakdown.why_performed,
        )

    async def _hooks_for_video(self, video_id: int) -> list[HookPattern]:
        stmt = (
            select(HookPattern)
            .where(HookPattern.video_id == video_id)
            .order_by(HookPattern.effectiveness_score.desc())
        )
        return list((await self._db.execute(stmt)).scalars().all())

    async def _similar_videos(
        self,
        video: VideoDetail,
        primary_hook: str,
    ) -> list[SimilarVideoItem]:
        """Semantic neighbors via title + transcript embedding search."""
        query = video.title
        if video.transcript:
            query = f"{video.title} {video.transcript[:200]}"

        hits = await self._videos.semantic_search(query, limit=15)
        items: list[SimilarVideoItem] = []
        for hit in hits:
            if hit.id == video.id:
                continue
            shared = None
            if primary_hook:
                other_hooks = await self._hooks_for_video(hit.id)
                if any(h.hook_type == primary_hook for h in other_hooks):
                    shared = primary_hook
            items.append(
                SimilarVideoItem(
                    id=hit.id,
                    title=hit.title,
                    creator_name=hit.creator_name,
                    views_count=hit.views_count,
                    similarity_score=hit.similarity_score or 0.0,
                    match_source=hit.match_source,
                    shared_hook_type=shared,
                )
            )
            if len(items) >= 8:
                break
        return items

    async def _llm_analyze(
        self,
        llm: ChatOpenAI,
        video: VideoDetail,
        transcript_intel: TranscriptIntelligence,
        creator_ctx: str,
        hooks: list[HookPattern],
        refresh: bool,
    ) -> _VideoIntelLLM:
        hook_lines = [f"- {h.hook_type}: {h.hook_text[:100]}" for h in hooks[:5]]
        transcript_sample = (video.transcript or "")[:5000]

        return await llm.with_structured_output(_VideoIntelLLM).ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are a YouTube video intelligence analyst. "
                        "Explain why videos perform, using transcript and creator context. "
                        "Be specific, practical, and creator-focused."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Title: {video.title}\n"
                        f"Creator: {video.creator_name}\n"
                        f"Views: {video.views_count:,}\n\n"
                        f"Creator context:\n{creator_ctx or 'N/A'}\n\n"
                        f"Hooks detected:\n{chr(10).join(hook_lines) or 'N/A'}\n\n"
                        f"Transcript themes: {transcript_intel.repeated_themes}\n"
                        f"CTA sections: {transcript_intel.cta_sections[:3]}\n\n"
                        f"Transcript excerpt:\n{transcript_sample}\n\n"
                        "Provide breakdown, structure sections, and viral analysis fields."
                    )
                ),
            ]
        )

    def _build_overview(
        self,
        video: VideoDetail,
        hook_types: list[str],
        primary_hook: str,
        comment_count: int = 0,
    ) -> VideoOverview:
        """Performance tier from views vs creator median proxy."""
        tier = "average"
        if video.views_count >= 1_000_000:
            tier = "viral"
        elif video.views_count >= 100_000:
            tier = "strong"

        return VideoOverview(
            id=video.id,
            title=video.title,
            creator_name=video.creator_name,
            channel_url=video.channel_url,
            views_count=video.views_count,
            subscribers_count=video.subscribers_count,
            published_at=video.published_at,
            has_transcript=video.has_transcript,
            hook_types=hook_types,
            primary_hook_type=primary_hook,
            semantic_score=None,
            performance_tier=tier,
            has_comments=comment_count > 0,
            comment_count=comment_count,
        )

    @staticmethod
    def _build_charts(
        video: VideoDetail,
        transcript_intel: TranscriptIntelligence,
    ) -> VideoCharts:
        text = video.transcript or video.title
        topics = topic_frequency_chart(text or "", 12)
        timeline = structure_timeline_chunks(text or "")

        emotional_counts: dict[str, int] = {}
        for phrase in transcript_intel.emotional_phrases:
            emotional_counts[phrase] = emotional_counts.get(phrase, 0) + 1

        title_kw = keyword_stats_from_titles([video], 10)
        combined_kw = keyword_stats_from_titles(
            [video] if not video.transcript else [video],
            10,
        )
        if video.transcript:
            for label, count in topic_frequency_chart(video.transcript, 10):
                combined_kw.append(
                    KeywordStat(keyword=label, count=count, avg_views=float(video.views_count))
                )

        return VideoCharts(
            topic_frequency=[
                ChartPoint(label=k, value=float(c), count=c) for k, c in topics
            ],
            emotional_distribution=[
                ChartPoint(label=k, value=float(v), count=v)
                for k, v in sorted(emotional_counts.items(), key=lambda x: -x[1])[:10]
            ],
            structure_timeline=[
                ChartPoint(label=label, value=end - start, count=int(end - start))
                for label, start, end in timeline
            ],
            keyword_frequency=[
                ChartPoint(label=k.keyword, value=float(k.count), count=k.count)
                for k in (combined_kw[:10] if combined_kw else title_kw[:10])
            ],
        )

    @staticmethod
    def _keywords(video: VideoDetail) -> list[KeywordStat]:
        return keyword_stats_from_titles([video], 12)

    @staticmethod
    def _default_ai_sections(
        video: VideoDetail,
        ti: TranscriptIntelligence,
        hook_types: list[str],
    ) -> tuple[VideoBreakdown, StructureAnalysis, ViralAnalysis]:
        """Fallback when LLM unavailable — rule-based insights."""
        feat = extract_title_features(video.title)
        breakdown = VideoBreakdown(
            why_performed=(
                f"Title uses {feat.primary_hook} hook pattern with "
                f"{video.views_count:,} views in dataset."
            ),
            hook_effectiveness=f"Primary hooks: {', '.join(hook_types) or feat.primary_hook}",
            emotional_triggers=ti.emotional_phrases,
            storytelling_patterns=ti.repeated_themes[:5],
            pacing="Inferred from transcript length and segment distribution.",
            communication_style="See creator profile for channel-wide style.",
            cta_patterns=ti.cta_sections[:4],
            audience_targeting="Derived from title themes and transcript vocabulary.",
            recommendations=[
                "Study opening hook phrasing from key moments.",
                "Reuse CTA placement patterns from CTA sections.",
            ],
        )
        structure = StructureAnalysis(
            hook=ti.key_moments[0].excerpt if ti.key_moments else video.title[:120],
            intro=ti.strongest_insights[0] if ti.strongest_insights else "",
            key_sections=[
                StructureSection(section=m.label, summary=m.excerpt[:200])
                for m in ti.key_moments[1:4]
            ],
            cta=ti.cta_sections[0] if ti.cta_sections else "",
            closing=ti.strongest_insights[-1] if ti.strongest_insights else "",
        )
        viral = ViralAnalysis(
            viral_factors=[f"Hook type: {feat.primary_hook}", f"Views: {video.views_count:,}"],
            reusable_frameworks=["Hook → promise → proof → CTA"],
            emotional_triggers=ti.emotional_phrases,
            creator_patterns=hook_types,
        )
        return breakdown, structure, viral


def _hook_from_title(title: str) -> str:
    feat = extract_title_features(title)
    primary = feat.primary_hook
    if ":" in primary:
        return primary.split(":")[0]
    return primary
