"""Hook Intelligence API — workspace, search, generate, compare, reindex."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.settings import get_chat_llm
from app.schemas.hooks import (
    HookCompareRequest,
    HookCompareResult,
    HookGenerateRequest,
    HookGenerateResult,
    HookSearchResult,
    HookWorkspace,
)
from app.services.hooks.hook_index_service import HookIndexService
from app.services.hooks.hook_intelligence_service import HookIntelligenceService

router = APIRouter(prefix="/hooks", tags=["hooks"])


@router.get("/workspace", response_model=HookWorkspace)
async def get_hook_workspace(db: AsyncSession = Depends(get_db)) -> HookWorkspace:
    """Full Hook Intelligence page — sections and charts."""
    return await HookIntelligenceService(db).get_workspace()


@router.get("/search", response_model=list[HookSearchResult])
async def search_hooks(
    q: str = Query(..., min_length=1),
    limit: int = Query(25, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[HookSearchResult]:
    """
    Search hooks by natural language.

    Examples: identity hooks, AI productivity hooks, contrarian hooks
    """
    return await HookIntelligenceService(db).search(q, limit=limit)


@router.post("/generate", response_model=HookGenerateResult)
async def generate_hooks(
    body: HookGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> HookGenerateResult:
    """Generate 10 viral hooks — creator style, topic, type, tone."""
    llm = await get_chat_llm(db, temperature=0.4)
    return await HookIntelligenceService(db).generate(llm, body)


@router.post("/compare", response_model=HookCompareResult)
async def compare_hooks(
    body: HookCompareRequest,
    db: AsyncSession = Depends(get_db),
) -> HookCompareResult:
    """Compare creators and/or hook types by effectiveness."""
    return await HookIntelligenceService(db).compare(body)


@router.post("/reindex")
async def reindex_hooks(db: AsyncSession = Depends(get_db)) -> dict[str, int]:
    """
    Rebuild hook_patterns from all videos.

    Runs automatically after Sheets sync; call manually if needed.
    """
    count = await HookIndexService(db).rebuild_index()
    return {"hooks_indexed": count}
