"""
Chat follow-up suggestions and research assistant hints.

Rule-based from analysis_type + structured analytics — lightweight, no LLM.
"""

from app.schemas.analytics import StructuredAnalytics
from app.schemas.copilot import ResearchAssistantHints


# Static follow-ups per routed analysis type
_BASE_SUGGESTIONS: dict[str, list[str]] = {
    "creator_profile": [
        "Compare this creator with a similar competitor",
        "What hook types work best for this creator?",
        "Generate 10 curiosity hooks for their next video",
    ],
    "creator_comparison": [
        "Which creator has stronger hook diversity?",
        "What topics should each creator double down on?",
        "Save this comparison to Research",
    ],
    "creator_analysis": [
        "Deep dive this creator's top performing video",
        "What title patterns drive their views?",
        "Suggest script topics for their audience",
    ],
    "hook_analysis": [
        "Generate hooks for my top trending topic",
        "Compare curiosity vs identity hooks",
        "Which creator uses hooks most effectively?",
    ],
    "hook_generation": [
        "Compare these hooks to viral videos in catalog",
        "Turn the best hook into a full script outline",
        "Analyze hook effectiveness for another creator",
    ],
    "video_breakdown": [
        "Analyze this video's transcript key moments",
        "What does the audience think in comments?",
        "Find similar viral videos to study",
    ],
    "transcript_analysis": [
        "Run viral analysis on this same video",
        "What hooks appear in the transcript opening?",
        "Generate a script in this video's style",
    ],
    "viral_analysis": [
        "Break down why the hook worked",
        "What audience reactions appear in comments?",
        "Compare viral frameworks across creators",
    ],
    "audience_analysis": [
        "What hooks could address audience confusion?",
        "Generate content ideas from pain points",
        "Compare audience sentiment across creators",
    ],
    "comments_analysis": [
        "Summarize audience desires as video topics",
        "Which videos have similar comment patterns?",
        "Draft hooks that answer top questions",
    ],
    "trend_analysis": [
        "Which creator is riding this trend best?",
        "Generate hooks for the top rising keyword",
        "Show videos matching this trend semantically",
    ],
    "title_analysis": [
        "What hook types pair with these title patterns?",
        "Compare title styles between two creators",
        "Find outliers with weak titles but high views",
    ],
    "general_chat": [
        "What are the top viral patterns in my catalog?",
        "Compare my top two creators",
        "What hook type outperforms average?",
    ],
}


class SuggestionService:
    """Produces contextual follow-up questions for chat and research UX."""

    def chat_suggestions(
        self,
        analysis_type: str,
        structured: StructuredAnalytics | None,
        query: str,
    ) -> list[str]:
        """3–5 follow-up prompts after each assistant reply."""
        suggestions = list(_BASE_SUGGESTIONS.get(analysis_type, _BASE_SUGGESTIONS["general_chat"]))

        if structured is None:
            return suggestions[:5]

        # Dynamic additions from structured payloads
        if structured.creator_profile and structured.creator_profile.creator_name:
            name = structured.creator_profile.creator_name
            suggestions.insert(0, f"What makes {name}'s hooks unique?")

        if structured.creator_comparison and len(structured.creator_comparison.creators) >= 2:
            a, b = structured.creator_comparison.creators[:2]
            suggestions.insert(0, f"Who wins on hooks: {a} or {b}?")

        if structured.hook_generation and structured.hook_generation.hooks:
            suggestions.insert(0, "Turn hook #1 into a 10-minute script")

        if structured.video_breakdown and structured.video_breakdown.video_id:
            vid = structured.video_breakdown.video_id
            suggestions.insert(0, f"What does the audience say about video {vid}?")

        if structured.audience_analysis and structured.audience_analysis.comments_intel.pain_points:
            suggestions.insert(0, "Generate hooks that address the top pain point")

        # Dedupe preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for s in suggestions:
            if s not in seen:
                seen.add(s)
                unique.append(s)

        return unique[:5]

    def research_hints(
        self,
        tags: list[str],
        creator_name: str | None,
        recent_insight_snippets: list[str],
        all_tags: list[str],
        creators_in_notes: list[str],
    ) -> ResearchAssistantHints:
        """Suggest related tags, creators, and insight themes for research workspace."""
        suggested_tags = list({t for t in tags if t} | {t for t in all_tags[:8] if t})
        if "hook" not in suggested_tags and any("hook" in s.lower() for s in recent_insight_snippets):
            suggested_tags.append("hooks")
        if "audience" not in suggested_tags and any("audience" in s.lower() for s in recent_insight_snippets):
            suggested_tags.append("audience")

        related_creators = list({c for c in creators_in_notes if c})
        if creator_name and creator_name not in related_creators:
            related_creators.insert(0, creator_name)

        related_insights = [s[:100] for s in recent_insight_snippets[:4]]

        return ResearchAssistantHints(
            related_insights=related_insights,
            suggested_tags=suggested_tags[:8],
            related_creators=related_creators[:5],
            related_video_ids=[],
        )
