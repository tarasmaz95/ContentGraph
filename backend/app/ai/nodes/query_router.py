"""Query router — classifies questions including creator intelligence types."""

import re
from typing import Callable

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.ai.state import AnalysisType, GraphState


class RouteDecision(BaseModel):
    analysis_type: AnalysisType = Field(
        description=(
            "creator_profile | creator_comparison | creator_analysis | "
            "hook_analysis | hook_generation | hook_comparison | "
            "script_generation | script_analysis | "
            "video_breakdown | transcript_analysis | viral_analysis | "
            "audience_analysis | comments_analysis | "
            "trend_analysis | title_analysis | general_chat"
        ),
    )
    hook_type: str | None = Field(
        default=None,
        description="Target hook type for generation: curiosity, identity, etc.",
    )
    topic: str | None = Field(
        default=None,
        description="Topic for hook/script generation requests",
    )
    script_tone: str | None = Field(default=None, description="Script tone e.g. philosophical")
    script_duration: str | None = Field(default=None, description="e.g. 10 minutes")
    search_terms: list[str] = Field(default_factory=list)
    creator_filter: str | None = Field(
        default=None,
        description="Primary creator for single-creator questions",
    )
    creator_names: list[str] = Field(
        default_factory=list,
        description="2-4 creator names for comparison questions",
    )
    video_id: int | None = Field(
        default=None,
        description="Numeric video ID when user asks about a specific video",
    )


ROUTER_SYSTEM = """You route YouTube analytics questions.

Types:
- creator_profile: deep dive on ONE creator's brand (e.g. "What makes Dan Koe successful?")
- creator_comparison: compare TWO+ creators (e.g. "Compare Dan Koe vs Hormozi")
- creator_analysis: performance/tactics for a specific creator's videos
- hook_analysis: analyze existing hooks, patterns, what works
- hook_generation: user wants NEW hooks generated (e.g. "Generate 10 curiosity hooks for Dan Koe about identity")
- hook_comparison: compare hook types or creators' hook effectiveness
- script_generation: write a video script for a creator (topic, tone, duration, hook type)
- script_analysis: analyze a script or creator's speaking/transcript style
- video_breakdown: deep analysis of ONE video (why it performed, hooks, storytelling)
- transcript_analysis: analyze a video's transcript (key moments, themes, CTAs)
- viral_analysis: viral factors and reusable frameworks for a specific video
- audience_analysis: what the audience thinks — reactions, pain points, desires from comments
- comments_analysis: analyze comment sentiment, themes, and recurring questions on a video
- trend_analysis: cross-creator trends and topics
- title_analysis: title patterns and wording
- general_chat: broad or unclear questions

For hook_generation set topic and hook_type and creator_filter if named.
For script_generation set topic, creator_filter (required), hook_type, script_tone, script_duration.
For script_analysis set creator_filter and extract script_text if user pasted a script.
For video_breakdown, transcript_analysis, viral_analysis, audience_analysis, or comments_analysis set video_id if mentioned (e.g. "video 123").
For hook_comparison set creator_names or infer hook types from question.
For creator_comparison set creator_names with all creators mentioned (2-4 names).
For creator_profile or creator_analysis set creator_filter to the main creator.
Extract search_terms from the question."""


def create_query_router_node(llm: ChatOpenAI) -> Callable[[GraphState], GraphState]:
    structured_llm = llm.with_structured_output(RouteDecision)

    async def query_router_node(state: GraphState) -> GraphState:
        query = state.get("query", "")
        if not query:
            return {
                "analysis_type": "general_chat",
                "search_terms": [],
                "creator_filter": None,
                "creator_names": [],
                "hook_type": None,
                "topic": None,
                "script_tone": None,
                "script_duration": None,
                "video_id": None,
            }

        decision: RouteDecision = await structured_llm.ainvoke(
            [
                SystemMessage(content=ROUTER_SYSTEM),
                HumanMessage(content=f"User question: {query}"),
            ]
        )

        # Fallback: extract video ID from "video 123" style queries
        if decision.video_id is None:
            match = re.search(r"\bvideo\s*#?(\d+)\b", query, re.IGNORECASE)
            if match:
                decision.video_id = int(match.group(1))

        return {
            "analysis_type": decision.analysis_type,
            "search_terms": decision.search_terms[:5],
            "creator_filter": decision.creator_filter,
            "creator_names": decision.creator_names[:4],
            "hook_type": decision.hook_type,
            "topic": decision.topic,
            "script_tone": decision.script_tone,
            "script_duration": decision.script_duration,
            "video_id": decision.video_id,
        }

    return query_router_node
