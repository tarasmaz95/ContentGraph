"""AI chat service — LangGraph with structured analytics output."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graph import build_analytics_graph
from app.ai.state import GraphState
from app.schemas.video_snapshot import VideoSnapshot
from app.schemas.analytics import StructuredAnalytics
from app.schemas.chat import ChatResult, VideoSnapshotOut
from app.services.copilot.copilot_service import CopilotService
from app.services.settings import AppSettingsService


class AIChatService:
    """Runs LangGraph pipeline and returns structured analytics + reply."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._copilot = CopilotService(db)

    async def ask(self, user_message: str) -> ChatResult:
        model = await AppSettingsService(self._db).resolve_openai_model()
        graph = build_analytics_graph(self._db, model=model)
        result: GraphState = await graph.ainvoke({"query": user_message})

        relevant = result.get("relevant_videos", [])
        raw_structured = result.get("structured_analytics", {})

        structured = (
            StructuredAnalytics.model_validate(raw_structured)
            if raw_structured
            else StructuredAnalytics(analysis_type=result.get("analysis_type", "general_chat"))
        )

        analysis_type = result.get("analysis_type", "general_chat")
        suggestions = self._copilot.chat_suggestions(
            analysis_type, raw_structured, user_message
        )

        return ChatResult(
            reply=result.get("final_response", "No response generated."),
            analysis_type=analysis_type,
            relevant_videos=[_to_snapshot_out(v) for v in relevant],
            insights=result.get("insights", []),
            structured=structured,
            context_videos_used=len(relevant),
            suggestions=suggestions,
        )


def _to_snapshot_out(video: VideoSnapshot) -> VideoSnapshotOut:
    return VideoSnapshotOut(
        id=video["id"],
        creator_name=video["creator_name"],
        title=video["title"],
        views_count=video["views_count"],
        subscribers_count=video["subscribers_count"],
        has_transcript=video.get("has_transcript", False),
        transcript_snippet=video.get("transcript_snippet"),
        match_source=video.get("match_source"),
        similarity_score=video.get("similarity_score"),
    )
