"""Intelligence coverage & health API."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.intelligence_health import IntelligenceHealthResponse
from app.services.intelligence.intelligence_health_service import IntelligenceHealthService

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.get("/health", response_model=IntelligenceHealthResponse)
async def get_intelligence_health(
    db: AsyncSession = Depends(get_db),
) -> IntelligenceHealthResponse:
    """Deterministic coverage, freshness, and operational health for the intelligence graph."""
    return await IntelligenceHealthService(db).get_health()
