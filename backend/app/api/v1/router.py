"""API v1 route aggregator."""

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    chat,
    compare,
    copilot,
    creators,
    hooks,
    intelligence,
    research,
    scripts,
    settings,
    sheets,
    comments,
    browser_ingestion,
    transcript_api_ingestion,
    transcripts,
    videos,
)

api_router = APIRouter()
api_router.include_router(settings.router)
api_router.include_router(sheets.router)
api_router.include_router(videos.router)
api_router.include_router(transcripts.router)
api_router.include_router(transcript_api_ingestion.router)
api_router.include_router(browser_ingestion.router)
api_router.include_router(comments.router)
api_router.include_router(compare.router)
api_router.include_router(creators.router)
api_router.include_router(hooks.router)
api_router.include_router(scripts.router)
api_router.include_router(analytics.router)
api_router.include_router(intelligence.router)
api_router.include_router(research.router)
api_router.include_router(copilot.router)
api_router.include_router(chat.router)
