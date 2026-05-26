"""Analytics API — dashboard metrics, growth trends, snapshots."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.analytics import DashboardAnalytics
from app.schemas.growth import (
    CreatorGrowthResponse,
    VelocityResponse,
    VideoBreakoutsResponse,
)
from app.schemas.snapshot_monitoring import (
    SnapshotRunHistoryResponse,
    SnapshotRunResponse,
    SnapshotStatusResponse,
)
from app.services.analytics.snapshot_run_service import SnapshotRunService
from app.services.analytics.dashboard_service import DashboardAnalyticsService
from app.services.analytics.growth_analytics_service import GrowthAnalyticsService
from app.services.analytics.snapshot_runner import run_daily_snapshots
from app.services.video_service import VideoService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardAnalytics)
async def get_dashboard_analytics(
    charts_limit: int = Query(
        200,
        ge=10,
        le=500,
        description="Top-N videos by views for charts/trends only (metrics are always catalog-wide)",
    ),
    db: AsyncSession = Depends(get_db),
) -> DashboardAnalytics:
    """
    Dashboard analytics: catalog-wide summary metrics + sampled charts.

    Uses deterministic pattern detection (fast, no LLM).
    """
    service = DashboardAnalyticsService(VideoService(db))
    return await service.get_dashboard(charts_limit=charts_limit)


@router.get("/creators/growth", response_model=CreatorGrowthResponse)
async def get_creator_growth(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> CreatorGrowthResponse:
    """Top creators by 7d subscriber growth from daily snapshots."""
    return await GrowthAnalyticsService(db).get_creator_growth(limit=limit)


@router.get("/videos/breakouts", response_model=VideoBreakoutsResponse)
async def get_video_breakouts(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> VideoBreakoutsResponse:
    """Videos with strongest 7d view momentum (breakout score)."""
    return await GrowthAnalyticsService(db).get_video_breakouts(limit=limit)


@router.get("/velocity", response_model=VelocityResponse)
async def get_velocity_spikes(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> VelocityResponse:
    """Highest views/day velocity over the last 7 days."""
    return await GrowthAnalyticsService(db).get_velocity(limit=limit)


@router.get("/snapshots/status", response_model=SnapshotStatusResponse)
async def get_snapshot_status(
    db: AsyncSession = Depends(get_db),
) -> SnapshotStatusResponse:
    """Latest snapshot run + next scheduled cron time (Settings monitoring)."""
    return await SnapshotRunService(db).get_status()


@router.get("/snapshots/history", response_model=SnapshotRunHistoryResponse)
async def get_snapshot_history(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
) -> SnapshotRunHistoryResponse:
    """Last N snapshot runs for Settings preview table."""
    return await SnapshotRunService(db).get_history(limit=limit)


@router.post("/snapshots/run", response_model=SnapshotRunResponse)
async def run_snapshots_now(
    db: AsyncSession = Depends(get_db),
) -> SnapshotRunResponse:
    """Manual trigger for daily snapshots (QA / backfill today)."""
    return await run_daily_snapshots(db, source="manual")
