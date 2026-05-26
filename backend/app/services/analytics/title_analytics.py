"""Title analytics — deterministic stats + OpenAI structured TitleAnalysis."""

from collections import defaultdict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.schemas.analytics import AnalyticsMetrics, KeywordStat, TitleAnalysis
from app.services.analytics._video_data import (
    VideoLike,
    compute_base_metrics,
    get_title,
    get_views,
    keyword_stats_from_titles,
)
from app.services.analytics.pattern_detection import extract_title_features


class TitleAnalyticsService:
    """Computes title patterns and enriches with LLM structured output."""

    def compute_deterministic(self, videos: list[VideoLike]) -> dict:
        """Rule-based title stats used as context for the LLM."""
        if not videos:
            # Keep metrics key — analyze_with_llm always reads det["metrics"]
            return {
                "patterns": [],
                "structures": [],
                "keywords": [],
                "metrics": compute_base_metrics(videos).model_dump(),
            }

        pattern_views: dict[str, list[int]] = defaultdict(list)
        structures: dict[str, int] = defaultdict(int)

        for video in videos:
            title = get_title(video)
            views = get_views(video)
            feat = extract_title_features(title)

            if feat.has_how_to:
                pattern_views["how_to"].append(views)
            if feat.has_numbers:
                pattern_views["numbers"].append(views)
            if feat.emotional_words:
                pattern_views["emotional"].append(views)
            for tag in feat.curiosity_tags:
                pattern_views[f"curiosity_{tag}"].append(views)

            structures[length_bucket_name(feat.length)] += 1

        patterns = [
            {
                "pattern": k,
                "count": len(vs),
                "avg_views": round(sum(vs) / len(vs), 1),
            }
            for k, vs in sorted(pattern_views.items(), key=lambda x: -len(x[1]))
        ]

        return {
            "patterns": patterns[:10],
            "structures": [
                f"{k}: {v} titles" for k, v in sorted(structures.items(), key=lambda x: -x[1])
            ],
            "keywords": [k.model_dump() for k in keyword_stats_from_titles(videos, 12)],
            "metrics": compute_base_metrics(videos).model_dump(),
        }

    async def analyze_with_llm(
        self,
        llm: ChatOpenAI,
        videos: list[VideoLike],
        query: str,
    ) -> tuple[TitleAnalysis, AnalyticsMetrics]:
        """Merge deterministic stats with OpenAI structured TitleAnalysis."""
        metrics = compute_base_metrics(videos)
        det = self.compute_deterministic(videos)

        structured_llm = llm.with_structured_output(TitleAnalysis)
        result: TitleAnalysis = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You analyze YouTube title performance. "
                        "Use ONLY the provided data. Fill all TitleAnalysis fields. "
                        "best_performing_keywords must reflect high avg_views."
                    )
                ),
                HumanMessage(
                    content=(
                        f"User question: {query}\n"
                        f"Computed metrics: {det['metrics']}\n"
                        f"Detected patterns: {det['patterns']}\n"
                        f"Structures: {det['structures']}\n"
                        f"Top keywords: {det['keywords']}\n"
                        f"Sample titles: {[get_title(v) for v in videos[:15]]}"
                    )
                ),
            ]
        )

        # Ensure avg_views aligns with computed metrics
        result.avg_views = metrics.avg_views
        if not result.best_performing_keywords and det["keywords"]:
            result.best_performing_keywords = [
                KeywordStat(**k) for k in det["keywords"][:8]
            ]

        return result, metrics


def length_bucket_name(char_count: int) -> str:
    from app.services.analytics.pattern_detection import length_bucket
    return length_bucket(char_count)
