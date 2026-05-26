"""AI Script Intelligence API — creator-aware generation and analysis."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.settings import get_chat_llm
from app.schemas.scripts import (
    ScriptAnalyzeRequest,
    ScriptAnalyzeResult,
    ScriptCompareRequest,
    ScriptCompareResult,
    ScriptGenerateRequest,
    ScriptGenerateResult,
    ScriptWorkspace,
)
from app.services.scripts.script_intelligence_service import ScriptIntelligenceService

router = APIRouter(prefix="/scripts", tags=["scripts"])


@router.get("/workspace", response_model=ScriptWorkspace)
async def get_script_workspace(
    creator: str | None = Query(None, description="Pre-load creator style context"),
    db: AsyncSession = Depends(get_db),
) -> ScriptWorkspace:
    """Script Intelligence page — hooks, style, structure template."""
    return await ScriptIntelligenceService(db).get_workspace(creator)


@router.post("/generate", response_model=ScriptGenerateResult)
async def generate_script(
    body: ScriptGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> ScriptGenerateResult:
    """
    Creator-aware script generation.

    Uses transcripts, hooks, titles, and communication style from the dataset.
    """
    svc = ScriptIntelligenceService(db)
    try:
        llm = await get_chat_llm(db, temperature=0.4)
        return await svc.generate(llm, body)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/analyze", response_model=ScriptAnalyzeResult)
async def analyze_script(
    body: ScriptAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
) -> ScriptAnalyzeResult:
    """Analyze script text or creator transcript speaking style."""
    llm = await get_chat_llm(db, temperature=0.4)
    return await ScriptIntelligenceService(db).analyze(llm, body)


@router.post("/compare", response_model=ScriptCompareResult)
async def compare_script(
    body: ScriptCompareRequest,
    db: AsyncSession = Depends(get_db),
) -> ScriptCompareResult:
    """Compare generated script vs creator style and top videos."""
    svc = ScriptIntelligenceService(db)
    try:
        llm = await get_chat_llm(db, temperature=0.4)
        return await svc.compare(llm, body)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
