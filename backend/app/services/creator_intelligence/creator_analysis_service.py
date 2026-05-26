"""AI creator intelligence — profile generation and creator comparison."""

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.schemas.creator import (
    CreatorComparisonResult,
    CreatorProfileIntel,
    CreatorProfileRead,
)
from app.schemas.video import VideoRead
from app.services.analytics.pattern_detection import extract_title_features


class CreatorAnalysisService:
    """
    OpenAI structured analysis of creators as content entities.

    Uses all videos, titles, transcripts — not single-video analysis.
    """

    async def generate_profile(
        self,
        llm: ChatOpenAI,
        creator_name: str,
        videos: list[VideoRead],
        total_videos: int,
        avg_views: float,
        total_views: int,
    ) -> tuple[CreatorProfileRead, CreatorProfileIntel]:
        """Build CreatorProfileRead (DB) + CreatorProfileIntel (chat/LangGraph)."""
        context = self._build_creator_context(creator_name, videos)

        structured_llm = llm.with_structured_output(CreatorProfileIntel)
        intel: CreatorProfileIntel = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are a YouTube creator intelligence analyst. "
                        "Analyze the creator as a content brand — style, themes, hooks, "
                        "communication, emotional triggers, and audience positioning. "
                        "Be specific and strategic. Use only the data provided."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Creator: {creator_name}\n"
                        f"Stats: {total_videos} videos, {avg_views:,.0f} avg views, "
                        f"{total_views:,} total views\n\n"
                        f"Content data:\n{context}\n\n"
                        "Fill all CreatorProfileIntel fields including strategic_insights."
                    )
                ),
            ]
        )

        intel.avg_views = avg_views
        intel.total_videos = total_videos

        read = CreatorProfileRead(
            creator_name=creator_name,
            content_style=intel.content_style,
            top_topics=intel.top_topics,
            hook_patterns=intel.hook_patterns,
            communication_style=intel.communication_style,
            emotional_triggers=intel.emotional_triggers,
            audience_type=intel.audience_type,
            creator_summary=intel.creator_summary,
            avg_views=avg_views,
            total_videos=total_videos,
            total_views=total_views,
        )
        return read, intel

    async def compare_creators(
        self,
        llm: ChatOpenAI,
        creators: list[str],
        videos_by_creator: dict[str, list[VideoRead]],
    ) -> CreatorComparisonResult:
        """Compare 2–4 creators on hooks, topics, style, positioning, communication."""
        blocks: list[str] = []
        for name in creators:
            vids = videos_by_creator.get(name, [])
            blocks.append(f"=== {name} ({len(vids)} videos) ===\n")
            blocks.append(self._build_creator_context(name, vids[:25]))

        structured_llm = llm.with_structured_output(CreatorComparisonResult)
        result: CreatorComparisonResult = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You compare YouTube creators strategically. "
                        "Contrast hooks, topics, content style, audience positioning, "
                        "and communication patterns. Be concrete and actionable."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Compare these creators: {', '.join(creators)}\n\n"
                        + "\n".join(blocks)
                    )
                ),
            ]
        )
        result.creators = creators
        return result

    def _build_creator_context(self, creator_name: str, videos: list[VideoRead]) -> str:
        """Compact text block: titles, hooks, transcript excerpts."""
        if not videos:
            return f"No videos found for {creator_name}."

        lines: list[str] = []
        hook_counts: dict[str, int] = {}

        for v in videos[:30]:
            feat = extract_title_features(v.title)
            hook_counts[feat.primary_hook] = hook_counts.get(feat.primary_hook, 0) + 1
            line = f'- "{v.title}" | {v.views_count:,} views'
            if v.transcript_preview:
                line += f' | transcript: "{v.transcript_preview[:120]}..."'
            lines.append(line)

        hooks_sorted = sorted(hook_counts.items(), key=lambda x: -x[1])[:8]
        hook_summary = ", ".join(f"{h}({c})" for h, c in hooks_sorted)

        return (
            f"Top titles:\n" + "\n".join(lines) + f"\n\nHook distribution: {hook_summary}"
        )
