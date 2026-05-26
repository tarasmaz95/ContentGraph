"""Creator intelligence API — profiles, analytics, semantic search, comparison."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.settings import get_chat_llm
from app.schemas.creator import (
    CreatorComparisonRequest,
    CreatorComparisonResult,
    CreatorListItem,
    CreatorProfileRead,
)
from app.schemas.creator_intelligence import (
    CreatorAudienceIntel,
    CreatorGrowthIntel,
    CreatorHookIntel,
    CreatorIntelligence,
)
from app.schemas.creator_page import CreatorPageAnalytics
from app.schemas.video import VideoRead
from app.services.creator_intelligence.creator_analysis_service import (
    CreatorAnalysisService,
)
from app.services.creator_intelligence.creator_page_service import CreatorPageService
from app.services.creator_intelligence.creator_intelligence_service import (
    CreatorIntelligenceService,
)
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService

router = APIRouter(prefix="/creators", tags=["creators"])


@router.get("", response_model=list[CreatorListItem])
async def list_creators(db: AsyncSession = Depends(get_db)) -> list[CreatorListItem]:
    """All creators from video data with profile availability flag."""
    service = CreatorProfileService(db)
    return await service.list_creators()


@router.get("/{creator_name}/intelligence", response_model=CreatorIntelligence)
async def get_creator_intelligence(
    creator_name: str,
    db: AsyncSession = Depends(get_db),
) -> CreatorIntelligence:
    """Unified creator intelligence dashboard payload."""
    svc = CreatorIntelligenceService(db)
    intel = await svc.get_intelligence(creator_name)
    if intel is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")
    return intel


@router.get("/{creator_name}/growth", response_model=CreatorGrowthIntel)
async def get_creator_growth(
    creator_name: str,
    db: AsyncSession = Depends(get_db),
) -> CreatorGrowthIntel:
    svc = CreatorIntelligenceService(db)
    resolved = await svc.resolve_name(creator_name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")
    return await svc.get_growth(resolved)


@router.get("/{creator_name}/hooks", response_model=CreatorHookIntel)
async def get_creator_hooks(
    creator_name: str,
    db: AsyncSession = Depends(get_db),
) -> CreatorHookIntel:
    svc = CreatorIntelligenceService(db)
    resolved = await svc.resolve_name(creator_name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")
    return await svc.get_hooks(resolved)


@router.get("/{creator_name}/audience", response_model=CreatorAudienceIntel)
async def get_creator_audience(
    creator_name: str,
    db: AsyncSession = Depends(get_db),
) -> CreatorAudienceIntel:
    svc = CreatorIntelligenceService(db)
    resolved = await svc.resolve_name(creator_name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")
    return await svc.get_audience(resolved)


@router.get("/{creator_name}/analytics", response_model=CreatorPageAnalytics)
async def get_creator_analytics(
    creator_name: str,
    db: AsyncSession = Depends(get_db),
) -> CreatorPageAnalytics:
    """
    Creator page analytics — overview, charts, sections.

    Accepts display name or URL slug (e.g. dan-koe).
    """
    page_svc = CreatorPageService(db)
    analytics = await page_svc.get_analytics(creator_name)
    if analytics is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")
    return analytics


@router.get("/{creator_name}/semantic-search", response_model=list[VideoRead])
async def creator_semantic_search(
    creator_name: str,
    q: str = Query(..., min_length=1, description="Natural language query"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[VideoRead]:
    """
    Semantic search scoped to one creator.

    Example: /creators/dan-koe/semantic-search?q=identity transformation
    """
    page_svc = CreatorPageService(db)
    resolved = await page_svc.resolve_creator_name(creator_name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")

    results = await page_svc.semantic_search(creator_name, q=q, limit=limit)
    return results


@router.get("/{creator_name}", response_model=CreatorProfileRead)
async def get_creator(
    creator_name: str,
    refresh: bool = Query(False, description="Regenerate AI profile from videos"),
    db: AsyncSession = Depends(get_db),
) -> CreatorProfileRead:
    """
    Creator intelligence profile.

    Set refresh=true to regenerate from latest videos + transcripts.
    Accepts slug (dan-koe) or display name.
    """
    page_svc = CreatorPageService(db)
    resolved = await page_svc.resolve_creator_name(creator_name)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Creator not found: {creator_name}")

    profile_svc = CreatorProfileService(db)
    analysis_svc = CreatorAnalysisService()

    if not refresh:
        existing = await profile_svc.get_profile(resolved)
        if existing is not None:
            return existing

    videos = await profile_svc.get_videos_for_creator(resolved, limit=60)
    if not videos:
        raise HTTPException(status_code=404, detail=f"No videos found for {resolved}")

    n, avg, total = await profile_svc.compute_stats(resolved)
    llm = await get_chat_llm(db, temperature=0.3)
    profile_read, _intel = await analysis_svc.generate_profile(
        llm, resolved, videos, n, avg, total
    )
    return await profile_svc.upsert_profile(profile_read)


@router.post("/compare", response_model=CreatorComparisonResult)
async def compare_creators(
    body: CreatorComparisonRequest,
    db: AsyncSession = Depends(get_db),
) -> CreatorComparisonResult:
    """
    Compare creators on hooks, topics, style, positioning, communication.

    Example body: {"creators": ["Dan Koe", "Ali Abdaal"]}
    """
    profile_svc = CreatorProfileService(db)
    analysis_svc = CreatorAnalysisService()

    videos_by: dict[str, list] = {}
    for name in body.creators:
        vids = await profile_svc.get_videos_for_creator(name, limit=40)
        if not vids:
            raise HTTPException(status_code=404, detail=f"No videos for creator: {name}")
        videos_by[name] = vids

    llm = await get_chat_llm(db, temperature=0.3)
    return await analysis_svc.compare_creators(llm, body.creators, videos_by)
