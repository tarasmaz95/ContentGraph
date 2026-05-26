"""Analysis node — structured analytics + creator intelligence generation."""

from typing import Callable

from langchain_openai import ChatOpenAI

from app.ai.state import AnalysisType, GraphState
from app.schemas.analytics import AnalyticsMetrics, StructuredAnalytics
from app.schemas.creator import CreatorProfileIntel
from app.services.analytics._video_data import compute_base_metrics
from app.services.analytics.creator_analytics import CreatorAnalyticsService
from app.services.analytics.hook_analytics import HookAnalyticsService
from app.services.analytics.title_analytics import TitleAnalyticsService
from app.services.analytics.trend_analytics import TrendAnalyticsService
from app.services.creator_intelligence.creator_analysis_service import (
    CreatorAnalysisService as CreatorIntelService,
)
from app.schemas.hooks import (
    HookCompareRequest,
    HookComparisonIntel,
    HookGenerateRequest,
    HookGenerationIntel,
)
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.schemas.scripts import ScriptAnalyzeRequest, ScriptGenerateRequest
from app.services.hooks.hook_intelligence_service import HookIntelligenceService
from app.services.scripts.script_intelligence_service import ScriptIntelligenceService
from app.services.video_intelligence.video_intelligence_service import (
    VideoIntelligenceService,
)


def create_analysis_node(
    llm: ChatOpenAI,
    profile_service: CreatorProfileService,
    hook_service: HookIntelligenceService,
    script_service: ScriptIntelligenceService,
    video_intel_service: VideoIntelligenceService,
) -> Callable[[GraphState], GraphState]:
    title_svc = TitleAnalyticsService()
    creator_svc = CreatorAnalyticsService()
    trend_svc = TrendAnalyticsService()
    hook_svc = HookAnalyticsService()
    intel_svc = CreatorIntelService()

    async def analysis_node(state: GraphState) -> GraphState:
        query = state.get("query", "")
        analysis_type: AnalysisType = state.get("analysis_type", "general_chat")
        videos = state.get("relevant_videos", [])
        creator_filter = state.get("creator_filter")
        creator_names = state.get("creator_names", [])
        hook_type = state.get("hook_type") or "curiosity"
        topic = state.get("topic") or query
        script_tone = state.get("script_tone") or "conversational"
        script_duration = state.get("script_duration") or "10 minutes"
        script_text = state.get("script_text") or ""
        video_id = state.get("video_id")

        metrics = compute_base_metrics(videos)
        structured = StructuredAnalytics(analysis_type=analysis_type, metrics=metrics)

        if analysis_type == "creator_profile" and creator_filter:
            vids = await profile_service.get_videos_for_creator(creator_filter, limit=60)
            n, avg, total = await profile_service.compute_stats(creator_filter)
            profile_read, intel = await intel_svc.generate_profile(
                llm, creator_filter, vids, n, avg, total
            )
            await profile_service.upsert_profile(profile_read)
            structured.creator_profile = intel

        elif analysis_type == "creator_comparison" and len(creator_names) >= 2:
            videos_by: dict[str, list] = {}
            for name in creator_names:
                videos_by[name] = await profile_service.get_videos_for_creator(name, limit=40)
            comparison = await intel_svc.compare_creators(llm, creator_names, videos_by)
            structured.creator_comparison = comparison

        elif analysis_type == "creator_analysis":
            creator, m = await creator_svc.analyze_with_llm(
                llm, videos, query, creator_filter
            )
            structured.creator = creator
            structured.metrics = m

        elif analysis_type == "hook_analysis":
            hook, m = await hook_svc.analyze_with_llm(llm, videos, query)
            structured.hook = hook
            structured.metrics = m

        elif analysis_type == "hook_generation":
            gen = await hook_service.generate(
                llm,
                HookGenerateRequest(
                    creator_name=creator_filter or "",
                    topic=topic,
                    hook_type=hook_type,
                    tone="bold",
                ),
            )
            structured.hook_generation = HookGenerationIntel(
                topic=gen.topic,
                hook_type=gen.hook_type,
                hooks=gen.hooks,
                style_notes=gen.style_notes,
                recommendations=[f"Tone: bold · Type: {gen.hook_type}"],
            )

        elif analysis_type == "hook_comparison":
            compare = await hook_service.compare(
                HookCompareRequest(
                    creators=creator_names,
                    hook_types=[hook_type] if hook_type else [],
                )
            )
            structured.hook_comparison = HookComparisonIntel(
                summary=compare.summary,
                hook_type_stats=compare.hook_type_stats,
                creator_leaders=[
                    c["creator_name"] for c in compare.creator_stats[:5]
                ],
                recommendations=compare.recommendations,
            )

        elif analysis_type == "script_generation" and creator_filter:
            from app.schemas.scripts import ScriptGenerationIntel

            gen = await script_service.generate(
                llm,
                ScriptGenerateRequest(
                    creator_name=creator_filter,
                    topic=topic,
                    tone=script_tone,
                    duration=script_duration,
                    hook_type=hook_type,
                ),
            )
            structured.script_generation = ScriptGenerationIntel(
                topic=gen.topic,
                creator_name=gen.creator_name,
                selected_hook=gen.selected_hook,
                structure=gen.structure,
                analytics=gen.analytics,
                style_notes=gen.style_notes,
                recommendations=[
                    f"Engagement: {gen.analytics.estimated_engagement}%",
                    f"Creator similarity: {gen.analytics.creator_similarity}%",
                ],
            )

        elif analysis_type == "script_analysis":
            from app.schemas.scripts import ScriptAnalysisIntel

            analyzed = await script_service.analyze(
                llm,
                ScriptAnalyzeRequest(
                    creator_name=creator_filter or "",
                    script_text=script_text or query,
                    topic=topic,
                ),
            )
            structured.script_analysis = ScriptAnalysisIntel(
                summary=analyzed.summary,
                analytics=analyzed.analytics,
                recommendations=analyzed.recommendations,
                structure_notes=analyzed.structure_detected.opening_hook,
            )

        elif analysis_type == "video_breakdown" and video_id:
            structured.video_breakdown = await video_intel_service.breakdown_for_graph(
                llm, video_id, query
            )

        elif analysis_type == "transcript_analysis" and video_id:
            structured.transcript_analysis = await video_intel_service.transcript_for_graph(
                llm, video_id
            )

        elif analysis_type == "viral_analysis" and video_id:
            structured.viral_analysis = await video_intel_service.viral_for_graph(
                llm, video_id
            )

        elif analysis_type == "audience_analysis" and video_id:
            structured.audience_analysis = await video_intel_service.audience_for_graph(
                llm, video_id, query
            )

        elif analysis_type == "comments_analysis" and video_id:
            structured.comments_analysis = await video_intel_service.comments_for_graph(
                llm, video_id
            )

        elif analysis_type == "trend_analysis":
            trend, m = await trend_svc.analyze_with_llm(llm, videos, query)
            structured.trend = trend
            structured.metrics = m

        elif analysis_type in ("title_analysis", "general_chat"):
            title, m = await title_svc.analyze_with_llm(llm, videos, query)
            structured.title = title
            structured.metrics = m

        return {
            "structured_analytics": structured.model_dump(),
            "metrics": structured.metrics.model_dump(),
            "analysis_results": _summarize_structured(structured),
        }

    return analysis_node


def _summarize_structured(data: StructuredAnalytics) -> str:
    parts: list[str] = [f"Type: {data.analysis_type}", f"Metrics: {data.metrics.model_dump()}"]

    if data.creator_profile:
        p = data.creator_profile
        parts.append(f"Creator profile: {p.creator_name}")
        parts.append(f"Style: {p.content_style}")
        parts.append(f"Topics: {p.top_topics}")
        parts.append(f"Summary: {p.creator_summary}")
    if data.creator_comparison:
        c = data.creator_comparison
        parts.append(f"Comparison: {c.creators}")
        parts.append(f"Summary: {c.summary}")
        parts.append(f"Style: {c.style_comparison}")
    if data.title:
        parts.append(f"Title patterns: {data.title.top_patterns}")
    if data.creator:
        parts.append(f"Creator: {data.creator.creator_name}, style: {data.creator.content_style}")
    if data.trend:
        parts.append(f"Trending: {data.trend.trending_topics}")
    if data.hook:
        parts.append(f"Hooks: {[h.hook_type for h in data.hook.hook_types[:5]]}")
    if data.hook_generation:
        parts.append(f"Generated hooks: {data.hook_generation.hooks[:5]}")
    if data.hook_comparison:
        parts.append(f"Hook comparison: {data.hook_comparison.summary}")
    if data.script_generation:
        parts.append(f"Script for {data.script_generation.creator_name}: {data.script_generation.topic}")
        parts.append(f"Hook: {data.script_generation.selected_hook}")
    if data.script_analysis:
        parts.append(f"Script analysis: {data.script_analysis.summary}")
    if data.video_breakdown:
        parts.append(f"Video breakdown: {data.video_breakdown.title}")
        parts.append(f"Why: {data.video_breakdown.breakdown.why_performed}")
    if data.viral_analysis:
        parts.append(f"Viral: {data.viral_analysis.summary}")
    if data.audience_analysis:
        parts.append(f"Audience: {data.audience_analysis.summary}")
        parts.append(f"Pain points: {data.audience_analysis.comments_intel.pain_points[:3]}")
    if data.comments_analysis:
        parts.append(f"Comment themes: {data.comments_analysis.top_themes}")

    return "\n".join(parts)
