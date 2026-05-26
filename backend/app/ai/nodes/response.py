"""Response node — synthesize structured analytics into insights + final reply."""

import json
from typing import Callable

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.ai.state import GraphState
from app.schemas.analytics import StructuredAnalytics


class FinalAnswer(BaseModel):
    """User-facing layer on top of structured analytics."""

    insights: list[str] = Field(
        description="3-6 short actionable insights",
        min_length=1,
    )
    final_response: str = Field(
        description="Markdown summary: Overview, Key Patterns, Recommendations",
    )


RESPONSE_SYSTEM = """You are a creator-focused research copilot. Synthesize structured YouTube analytics into high-signal answers.

Rules:
- insights[]: 3-5 bullets, max 18 words each, actionable (what to do / what works)
- final_response: short markdown — ## Overview (2 sentences), ## Key patterns (3 bullets), ## Recommendations (2-3 bullets)
- Use specific numbers, hook types, and creator names from the JSON only
- No filler, no hedging, no generic advice
- Tone: direct, practical, like a sharp internal research brief"""


def create_response_node(llm: ChatOpenAI) -> Callable[[GraphState], GraphState]:
    """Uses structured_analytics from state — not plain-text guessing."""
    structured_llm = llm.with_structured_output(FinalAnswer)

    async def response_node(state: GraphState) -> GraphState:
        query = state.get("query", "")
        raw = state.get("structured_analytics", {})
        analytics = StructuredAnalytics.model_validate(raw) if raw else None

        structured_json = json.dumps(raw, indent=2) if raw else "{}"
        analysis_notes = state.get("analysis_results", "")

        answer: FinalAnswer = await structured_llm.ainvoke(
            [
                SystemMessage(content=RESPONSE_SYSTEM),
                HumanMessage(
                    content=(
                        f"User question: {query}\n\n"
                        f"Structured analytics JSON:\n{structured_json}\n\n"
                        f"Summary notes:\n{analysis_notes}"
                    )
                ),
            ]
        )

        # Enrich insights from structured recommendations when available
        insights = list(answer.insights)
        insights.extend(_extract_recommendations(analytics))
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique_insights: list[str] = []
        for item in insights:
            if item not in seen:
                seen.add(item)
                unique_insights.append(item)

        return {
            "insights": unique_insights[:5],
            "final_response": answer.final_response,
        }

    return response_node


def _extract_recommendations(analytics: StructuredAnalytics | None) -> list[str]:
    """Pull recommendation bullets from typed analysis payloads."""
    if analytics is None:
        return []

    recs: list[str] = []
    if analytics.title:
        recs.extend(analytics.title.recommendations[:2])
    if analytics.creator:
        recs.extend(analytics.creator.recommendations[:2])
    if analytics.trend:
        recs.extend(analytics.trend.viral_patterns[:1])
    if analytics.hook:
        recs.extend(analytics.hook.recommendations[:2])
    if analytics.creator_profile:
        recs.extend(analytics.creator_profile.strategic_insights[:2])
    if analytics.creator_comparison:
        recs.extend(analytics.creator_comparison.recommendations[:3])
    return recs
