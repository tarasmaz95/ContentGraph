"""LangGraph state — includes creator intelligence fields."""

from typing import Literal, TypedDict

from app.schemas.video_snapshot import VideoSnapshot

AnalysisType = Literal[
    "creator_analysis",
    "creator_profile",
    "creator_comparison",
    "hook_analysis",
    "hook_generation",
    "hook_comparison",
    "script_generation",
    "script_analysis",
    "video_breakdown",
    "transcript_analysis",
    "viral_analysis",
    "audience_analysis",
    "comments_analysis",
    "trend_analysis",
    "title_analysis",
    "general_chat",
]


class GraphState(TypedDict, total=False):
    query: str
    analysis_type: AnalysisType
    search_terms: list[str]
    creator_filter: str | None
    creator_names: list[str]  # for comparison queries
    hook_type: str | None  # hook_generation / hook_comparison / script_generation
    topic: str | None  # hook/script generation topic
    script_tone: str | None
    script_duration: str | None
    script_text: str | None  # script_analysis input
    video_id: int | None  # video_breakdown / transcript / viral analysis

    relevant_videos: list[VideoSnapshot]

    structured_analytics: dict
    metrics: dict
    analysis_results: str

    insights: list[str]
    final_response: str
