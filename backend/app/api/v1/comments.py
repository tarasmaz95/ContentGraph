"""Lightweight comments ingestion from Chrome extension."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.extension_auth import verify_extension_api_key
from app.db.session import get_db
from app.schemas.comment_ingest import CommentsIngestRequest, CommentsIngestResponse
from app.services.comments.ingest_service import CommentsIngestService

router = APIRouter(prefix="/comments", tags=["comments"])


@router.post("/ingest", response_model=CommentsIngestResponse)
async def ingest_comments(
    payload: CommentsIngestRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_extension_api_key),
) -> CommentsIngestResponse:
    """
    Save browser-extracted top comments onto an existing catalog video.

    Replaces prior comments for that video (no duplicate rows).
    """
    service = CommentsIngestService(db)
    return await service.ingest(payload)
