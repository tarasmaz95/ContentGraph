"""AI Copilot API — panel, feed, briefs, research assistant."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.copilot import (
    AIBrief,
    CopilotPanelResponse,
    IntelligenceFeedResponse,
    PersonalizationInput,
    ResearchAssistantHints,
)
from app.services.copilot.copilot_service import CopilotService
from app.services.copilot.brief_service import BriefService

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/panel", response_model=CopilotPanelResponse)
async def copilot_panel(
    context: str = Query(
        "dashboard",
        description="dashboard | creator | video | research | chat | hooks | analytics",
    ),
    creator_name: str | None = Query(None),
    video_id: int | None = Query(None),
    body: PersonalizationInput | None = None,
    db: AsyncSession = Depends(get_db),
) -> CopilotPanelResponse:
    """
    Persistent copilot sidebar — proactive insights + recommendations.

    Send personalization from localStorage for smarter boosts.
    """
    svc = CopilotService(db)
    return await svc.get_panel(
        context=context,
        creator_name=creator_name,
        video_id=video_id,
        personalization=body,
    )


@router.get("/panel", response_model=CopilotPanelResponse)
async def copilot_panel_get(
    context: str = Query("dashboard"),
    creator_name: str | None = Query(None),
    video_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> CopilotPanelResponse:
    """GET variant without personalization body."""
    svc = CopilotService(db)
    return await svc.get_panel(context=context, creator_name=creator_name, video_id=video_id)


@router.get("/feed", response_model=IntelligenceFeedResponse)
async def intelligence_feed(
    limit: int = Query(8, ge=3, le=8),
    db: AsyncSession = Depends(get_db),
) -> IntelligenceFeedResponse:
    """Ranked research briefing for /feed (3–8 high-signal insights)."""
    return await CopilotService(db).get_feed(limit=limit)


@router.get("/brief/creator/{creator_name}", response_model=AIBrief)
async def creator_brief(
    creator_name: str,
    db: AsyncSession = Depends(get_db),
) -> AIBrief:
    svc = CopilotService(db)
    resolved = await svc._resolve_creator_name(creator_name)
    brief = await BriefService(db).creator_brief(resolved)
    if brief is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Creator not found")
    return brief


@router.get("/brief/video/{video_id}", response_model=AIBrief)
async def video_brief(
    video_id: int,
    db: AsyncSession = Depends(get_db),
) -> AIBrief:
    brief = await BriefService(db).video_brief(video_id)
    if brief is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Video not found")
    return brief


@router.get("/brief/audience/{video_id}", response_model=AIBrief)
async def audience_brief(
    video_id: int,
    db: AsyncSession = Depends(get_db),
) -> AIBrief:
    brief = await BriefService(db).audience_brief(video_id)
    if brief is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Video not found")
    return brief


@router.get("/brief/trend", response_model=AIBrief)
async def trend_brief(db: AsyncSession = Depends(get_db)) -> AIBrief:
    return await BriefService(db).trend_brief()


@router.get("/research-assistant", response_model=ResearchAssistantHints)
async def research_assistant(
    tags: str | None = Query(None, description="Comma-separated tags"),
    creator: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> ResearchAssistantHints:
    """Related insights, tags, and creators for research workspace."""
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    return await CopilotService(db).research_assistant(tags=tag_list, creator_name=creator)
