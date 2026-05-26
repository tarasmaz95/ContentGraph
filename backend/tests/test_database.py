"""
Smoke: database schema after Alembic migrations.

Runs SQL checks against DATABASE_URL (default: Docker Postgres on localhost).
Skipped when Postgres is not reachable.
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Expected tables from migrations 001–007
EXPECTED_TABLES: frozenset[str] = frozenset(
    {
        "videos",
        "creator_profiles",
        "saved_insights",
        "research_notes",
        "hook_patterns",
        "comments",
        "alembic_version",
    }
)

EXPECTED_INDEXES: tuple[str, ...] = (
    "ix_videos_creator_name",
    "ix_videos_views_count",
    "ix_comments_video_id",
    "ix_comments_sentiment",
    "ix_hook_patterns_hook_type",
    "ix_hook_patterns_creator_name",
)


def _database_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://contentgraph:contentgraph@localhost:5432/contentgraph",
    )


@pytest.fixture
async def db_session() -> AsyncSession:
    """One-shot async session for read-only schema checks."""
    engine = create_async_engine(_database_url(), pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_pgvector_extension_enabled(db_session: AsyncSession) -> None:
    """Extension 'vector' must exist for embedding columns."""
    result = await db_session.execute(
        text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
    )
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_all_migrated_tables_exist(db_session: AsyncSession) -> None:
    """Every application table from the migration chain is present."""
    result = await db_session.execute(
        text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename = ANY(:names)"
        ),
        {"names": list(EXPECTED_TABLES)},
    )
    found = {row[0] for row in result.fetchall()}
    missing = EXPECTED_TABLES - found
    assert not missing, f"Missing tables: {sorted(missing)}"


@pytest.mark.asyncio
async def test_alembic_at_head(db_session: AsyncSession) -> None:
    """Alembic revision should be 007 (latest migration in repo)."""
    result = await db_session.execute(
        text("SELECT version_num FROM alembic_version")
    )
    version = result.scalar()
    assert version == "007", f"Expected head 007, got {version!r}"


@pytest.mark.asyncio
async def test_video_embedding_columns_exist(db_session: AsyncSession) -> None:
    """videos.title_embedding and transcript_embedding use vector type."""
    result = await db_session.execute(
        text(
            "SELECT column_name, udt_name::text "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'videos' "
            "AND column_name IN ('title_embedding', 'transcript_embedding')"
        )
    )
    rows = {row[0]: row[1] for row in result.fetchall()}
    assert "title_embedding" in rows
    assert "transcript_embedding" in rows


@pytest.mark.asyncio
async def test_key_indexes_exist(db_session: AsyncSession) -> None:
    """Spot-check indexes created by migrations."""
    result = await db_session.execute(
        text(
            "SELECT indexname FROM pg_indexes "
            "WHERE schemaname = 'public' AND indexname = ANY(:names)"
        ),
        {"names": list(EXPECTED_INDEXES)},
    )
    found = {row[0] for row in result.fetchall()}
    missing = set(EXPECTED_INDEXES) - found
    assert not missing, f"Missing indexes: {sorted(missing)}"
