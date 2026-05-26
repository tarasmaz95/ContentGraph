"""Hook analytics — curiosity, transformation, urgency detection + LLM."""

from collections import defaultdict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.schemas.analytics import AnalyticsMetrics, HookAnalysis, HookTypeStat, PatternStat
from app.services.analytics._video_data import VideoLike, compute_base_metrics, get_title, get_views
from app.services.analytics.pattern_detection import extract_title_features


class HookAnalyticsService:
    """Detects hook types from titles and produces structured HookAnalysis."""

    def compute_deterministic(self, videos: list[VideoLike]) -> dict:
        hook_views: dict[str, list[int]] = defaultdict(list)
        curiosity: dict[str, list[int]] = defaultdict(list)
        transformation: dict[str, list[int]] = defaultdict(list)
        urgency: dict[str, list[int]] = defaultdict(list)

        for video in videos:
            title = get_title(video)
            views = get_views(video)
            feat = extract_title_features(title)
            hook_views[feat.primary_hook].append(views)

            for tag in feat.curiosity_tags:
                curiosity[tag].append(views)
            for tag in feat.transformation_tags:
                transformation[tag].append(views)
            for tag in feat.urgency_tags:
                urgency[tag].append(views)

        def to_pattern_stats(bucket: dict[str, list[int]]) -> list[dict]:
            return sorted(
                [
                    {
                        "pattern": k,
                        "count": len(vs),
                        "avg_views": round(sum(vs) / len(vs), 1),
                    }
                    for k, vs in bucket.items()
                ],
                key=lambda x: -x["avg_views"],
            )

        hook_types = sorted(
            [
                {
                    "hook_type": k,
                    "count": len(vs),
                    "avg_views": round(sum(vs) / len(vs), 1),
                }
                for k, vs in hook_views.items()
            ],
            key=lambda x: -x["count"],
        )

        return {
            "hook_types": hook_types[:12],
            "curiosity": to_pattern_stats(curiosity),
            "transformation": to_pattern_stats(transformation),
            "urgency": to_pattern_stats(urgency),
            "top_titles": sorted(
                [(get_title(v), get_views(v)) for v in videos],
                key=lambda x: -x[1],
            )[:10],
        }

    async def analyze_with_llm(
        self,
        llm: ChatOpenAI,
        videos: list[VideoLike],
        query: str,
    ) -> tuple[HookAnalysis, AnalyticsMetrics]:
        metrics = compute_base_metrics(videos)
        det = self.compute_deterministic(videos)

        structured_llm = llm.with_structured_output(HookAnalysis)
        result: HookAnalysis = await structured_llm.ainvoke(
            [
                SystemMessage(
                    content=(
                        "You analyze YouTube title hooks. "
                        "Classify curiosity, transformation, and urgency patterns. "
                        "Use the computed hook statistics provided."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Question: {query}\n"
                        f"Hook types: {det['hook_types']}\n"
                        f"Curiosity: {det['curiosity']}\n"
                        f"Transformation: {det['transformation']}\n"
                        f"Urgency: {det['urgency']}\n"
                        f"Top titles: {det['top_titles']}"
                    )
                ),
            ]
        )

        result.avg_views = metrics.avg_views
        if not result.hook_types:
            result.hook_types = [HookTypeStat(**h) for h in det["hook_types"][:8]]
        if not result.curiosity_patterns:
            result.curiosity_patterns = [PatternStat(**p) for p in det["curiosity"][:6]]
        if not result.transformation_hooks:
            result.transformation_hooks = [
                PatternStat(**p) for p in det["transformation"][:6]
            ]
        if not result.urgency_hooks:
            result.urgency_hooks = [PatternStat(**p) for p in det["urgency"][:6]]

        return result, metrics
