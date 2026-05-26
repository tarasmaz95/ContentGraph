"""Trend analytics — topics, keywords, creators + structured TrendAnalysis."""

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.schemas.analytics import AnalyticsMetrics, KeywordStat, TrendAnalysis
from app.services.analytics._video_data import (
    VideoLike,
    compute_base_metrics,
    creator_stats,
    get_creator,
    get_title,
    get_views,
    keyword_stats_from_titles,
)


class TrendAnalyticsService:
    """Cross-creator trend detection from video dataset."""

    def compute_deterministic(self, videos: list[VideoLike]) -> dict:
        keywords = keyword_stats_from_titles(videos, 15)
        creators = creator_stats(videos, 10)

        # "Fastest growing" proxy: creators with high avg_views and multiple videos
        rising = sorted(creators, key=lambda c: c.avg_views, reverse=True)[:5]

        top_by_views = sorted(videos, key=get_views, reverse=True)[:8]
        viral_titles = [get_title(v) for v in top_by_views]

        return {
            "keywords": [k.model_dump() for k in keywords],
            "rising_creators": [c.creator_name for c in rising],
            "viral_titles": viral_titles,
            "creator_stats": [c.model_dump() for c in creators],
        }

    async def analyze_with_llm(
        self,
        llm: ChatOpenAI,
        videos: list[VideoLike],
        query: str,
    ) -> tuple[TrendAnalysis, AnalyticsMetrics]:
        metrics = compute_base_metrics(videos)
        det = self.compute_deterministic(videos)

        structured_llm = llm.with_structured_output(TrendAnalysis)
        result: TrendAnalysis = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You identify trends across YouTube creators and topics. "
                        "Use keyword and view data only."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Question: {query}\n"
                        f"Top keywords: {det['keywords']}\n"
                        f"High-performing creators: {det['rising_creators']}\n"
                        f"Viral titles: {det['viral_titles']}\n"
                        f"Creator stats: {det['creator_stats']}"
                    )
                ),
            ]
        )

        if not result.rising_keywords:
            result.rising_keywords = [KeywordStat(**k) for k in det["keywords"][:8]]
        if not result.fastest_growing_creators:
            result.fastest_growing_creators = det["rising_creators"]
        if not result.viral_patterns and det["viral_titles"]:
            result.viral_patterns = [f"High views: \"{t}\"" for t in det["viral_titles"][:5]]

        return result, metrics
