"""Async database session factory."""

from collections.abc import AsyncGenerator

from pgvector.asyncpg import register_vector
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

# Engine uses asyncpg driver via postgresql+asyncpg URL
engine = create_async_engine(settings.database_url, echo=False)


@event.listens_for(engine.sync_engine, "connect")
def _register_pgvector(dbapi_connection, _connection_record) -> None:
    """Register vector type with asyncpg for pgvector column I/O."""
    # AdaptedConnection.run_async exists on SQLAlchemy's asyncpg dialect wrapper
    dbapi_connection.run_async(register_vector)


async def ensure_pgvector_extension() -> None:
    """Create pgvector extension on startup (idempotent)."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields one session per request."""
    async with AsyncSessionLocal() as session:
        yield session
