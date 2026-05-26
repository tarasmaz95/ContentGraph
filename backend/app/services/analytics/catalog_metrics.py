"""Catalog-wide dashboard metrics — single Postgres aggregate query."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.analytics import AnalyticsMetrics


async def fetch_catalog_metrics(db: AsyncSession) -> AnalyticsMetrics:
    """
    Aggregate summary metrics across all rows in videos.

    Uses SQL only (no Python loop over the full catalog).
    """
    row = (
        await db.execute(
            text(
                """
                SELECT
                    COUNT(*)::int AS total_videos,
                    COALESCE(AVG(views_count), 0)::float AS avg_views,
                    COALESCE(
                        percentile_cont(0.5) WITHIN GROUP (ORDER BY views_count),
                        0
                    )::float AS median_views,
                    COALESCE(MAX(views_count), 0)::bigint AS max_views,
                    COALESCE(AVG(LENGTH(title)), 0)::float AS avg_title_length,
                    COALESCE(
                        100.0 * SUM(CASE WHEN title ~ '[0-9]' THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0),
                        0
                    )::float AS titles_with_numbers_pct,
                    COALESCE(
                        100.0 * SUM(CASE WHEN title ~* 'how\\s+to' THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0),
                        0
                    )::float AS how_to_titles_pct,
                    COALESCE(
                        100.0 * SUM(
                            CASE
                                WHEN title LIKE '%?%'
                                    OR title ~* '\\mwhy\\M'
                                    OR title ~* '\\mhow\\M'
                                    OR title ~* '\\msecret\\M'
                                    OR title ~* '\\mtruth\\M'
                                    OR title ~* '\\mnobody\\M'
                                    OR title ~* '\\mdon''?t\\M'
                                    OR title ~* '\\mwhat\\M'
                                    OR title ~* 'this is why'
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        0
                    )::float AS curiosity_titles_pct,
                    COALESCE(
                        100.0 * SUM(
                            CASE
                                WHEN title ~* '\\m(amazing|insane|secret|shocking|ultimate|powerful|proven|breakthrough|mistake|truth|never|always|best|worst|easy|hard|free|new|stop|start|love|hate|fear|dream|success|fail|win|lose)\\M'
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        0
                    )::float AS emotional_titles_pct
                FROM videos
                """
            )
        )
    ).mappings().one()

    if row["total_videos"] == 0:
        return AnalyticsMetrics()

    return AnalyticsMetrics(
        total_videos=int(row["total_videos"]),
        avg_views=round(float(row["avg_views"]), 1),
        median_views=round(float(row["median_views"]), 1),
        max_views=int(row["max_views"]),
        avg_title_length=round(float(row["avg_title_length"]), 1),
        titles_with_numbers_pct=round(float(row["titles_with_numbers_pct"]), 1),
        how_to_titles_pct=round(float(row["how_to_titles_pct"]), 1),
        curiosity_titles_pct=round(float(row["curiosity_titles_pct"]), 1),
        emotional_titles_pct=round(float(row["emotional_titles_pct"]), 1),
    )
