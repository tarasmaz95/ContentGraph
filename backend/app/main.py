"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal, ensure_pgvector_extension
from app.services.analytics.snapshot_runner import run_daily_snapshots
from app.services.analytics.snapshot_scheduler import (
    shutdown_snapshot_scheduler,
    start_snapshot_scheduler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: pgvector + optional daily stats scheduler."""
    await ensure_pgvector_extension()
    start_snapshot_scheduler()
    settings = get_settings()
    if settings.stats_run_on_startup:
        async with AsyncSessionLocal() as db:
            await run_daily_snapshots(db)
    yield
    shutdown_snapshot_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
