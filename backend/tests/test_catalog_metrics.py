"""Catalog-wide metrics SQL aggregation."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.analytics.catalog_metrics import fetch_catalog_metrics


@pytest.mark.asyncio
async def test_fetch_catalog_metrics_matches_db_count(db_session: AsyncSession) -> None:
    """Metrics total should match COUNT(*) on videos."""
    db_count = (
        await db_session.execute(text("SELECT COUNT(*)::int FROM videos"))
    ).scalar_one()
    metrics = await fetch_catalog_metrics(db_session)
    assert metrics.total_videos == db_count
    if db_count > 0:
        assert metrics.avg_views > 0
        assert metrics.max_views >= metrics.median_views
