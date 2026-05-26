"""Creator analytics — per-channel stats + structured CreatorAnalysis."""

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.schemas.analytics import AnalyticsMetrics, CreatorAnalysis
from app.services.analytics._video_data import (
    VideoLike,
    compute_base_metrics,
    creator_stats,
    get_creator,
    get_title,
    get_views,
)
from app.services.analytics.pattern_detection import extract_title_features


class CreatorAnalyticsService:
    """Analyzes one or more creators from retrieved videos."""

    def compute_deterministic(
        self,
        videos: list[VideoLike],
        creator_filter: str | None,
    ) -> dict:
        primary = creator_filter or (get_creator(videos[0]) if videos else "Unknown")
        creator_videos = [
            v for v in videos if get_creator(v).lower() == primary.lower()
        ] or videos

        titles_views = sorted(
            [(get_title(v), get_views(v)) for v in creator_videos],
            key=lambda x: -x[1],
        )
        hooks = [
            extract_title_features(get_title(v)).primary_hook for v in creator_videos
        ]
        hook_counts: dict[str, int] = {}
        for h in hooks:
            hook_counts[h] = hook_counts.get(h, 0) + 1

        return {
            "creator_name": primary,
            "video_count": len(creator_videos),
            "top_titles": [t for t, _ in titles_views[:8]],
            "best_hooks": sorted(hook_counts, key=hook_counts.get, reverse=True)[:6],
            "all_creators": [c.model_dump() for c in creator_stats(videos, 8)],
        }

    async def analyze_with_llm(
        self,
        llm: ChatOpenAI,
        videos: list[VideoLike],
        query: str,
        creator_filter: str | None,
    ) -> tuple[CreatorAnalysis, AnalyticsMetrics]:
        metrics = compute_base_metrics(videos)
        det = self.compute_deterministic(videos, creator_filter)

        structured_llm = llm.with_structured_output(CreatorAnalysis)
        result: CreatorAnalysis = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You analyze a YouTube creator's content performance. "
                        "Infer topics and style from titles. Be specific."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Question: {query}\n"
                        f"Creator focus: {det['creator_name']}\n"
                        f"Videos: {det['video_count']}\n"
                        f"Top titles: {det['top_titles']}\n"
                        f"Hook patterns: {det['best_hooks']}\n"
                        f"Creator leaderboard: {det['all_creators']}"
                    )
                ),
            ]
        )

        result.creator_name = det["creator_name"]
        result.avg_views = metrics.avg_views
        if not result.top_performing_titles:
            result.top_performing_titles = det["top_titles"]
        if not result.best_hooks:
            result.best_hooks = det["best_hooks"]

        return result, metrics
