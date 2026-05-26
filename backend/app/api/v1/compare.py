"""Creator compare — side-by-side intelligence (deterministic)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.creator_compare import CreatorCompareResult
from app.services.creator_intelligence.creator_compare_service import CreatorCompareService

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("", response_model=CreatorCompareResult)
async def compare_creators(
    creator_a: str = Query(..., min_length=1, description="First creator name or slug"),
    creator_b: str = Query(..., min_length=1, description="Second creator name or slug"),
    depth: str = Query(
        "full",
        description="full | core (fast overview) | extended (audience+momentum only)",
    ),
    db: AsyncSession = Depends(get_db),
) -> CreatorCompareResult:
    """
    Compare two creators using existing intelligence services.

    Example: /compare?creator_a=Alex%20Hormozi&creator_b=Dan%20Martell
    """
    svc = CreatorCompareService(db)
    if depth not in ("full", "core", "extended"):
        raise HTTPException(status_code=400, detail="depth must be full, core, or extended")
    result = await svc.compare(creator_a, creator_b, depth=depth)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Creators not found or must be two different channels",
        )
    return result
