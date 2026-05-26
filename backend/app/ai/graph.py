"""LangGraph workflow with creator intelligence nodes."""

from functools import lru_cache

from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.nodes.analysis import create_analysis_node
from app.ai.nodes.query_router import create_query_router_node
from app.ai.nodes.response import create_response_node
from app.ai.nodes.retrieval import create_retrieval_node
from app.ai.state import GraphState
from app.core.config import get_settings
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.hooks.hook_intelligence_service import HookIntelligenceService
from app.services.scripts.script_intelligence_service import ScriptIntelligenceService
from app.services.video_intelligence.video_intelligence_service import (
    VideoIntelligenceService,
)
from app.services.video_service import VideoService


def build_analytics_graph(db: AsyncSession, *, model: str) -> object:
    """Build graph with video + creator profile services on same DB session."""
    settings = get_settings()
    llm = ChatOpenAI(
        model=model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )

    video_service = VideoService(db)
    profile_service = CreatorProfileService(db)
    hook_service = HookIntelligenceService(db)
    script_service = ScriptIntelligenceService(db)
    video_intel_service = VideoIntelligenceService(db)

    workflow = StateGraph(GraphState)
    workflow.add_node("query_router", create_query_router_node(llm))
    workflow.add_node("retrieval", create_retrieval_node(video_service, profile_service))
    workflow.add_node(
        "analysis",
        create_analysis_node(
            llm, profile_service, hook_service, script_service, video_intel_service
        ),
    )
    workflow.add_node("response", create_response_node(llm))

    workflow.add_edge(START, "query_router")
    workflow.add_edge("query_router", "retrieval")
    workflow.add_edge("retrieval", "analysis")
    workflow.add_edge("analysis", "response")
    workflow.add_edge("response", END)

    return workflow.compile()
