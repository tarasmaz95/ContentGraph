"""Lightweight transcript ingestion from Chrome extension."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.extension_auth import verify_extension_api_key
from app.db.session import get_db
from app.schemas.transcript_ingest import TranscriptIngestRequest, TranscriptIngestResponse
from app.services.transcripts.ingest_service import TranscriptIngestService

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.post("/ingest", response_model=TranscriptIngestResponse)
async def ingest_transcript(
    payload: TranscriptIngestRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_extension_api_key),
) -> TranscriptIngestResponse:
    """
    Save browser-extracted transcript onto an existing catalog video.

    Matches by YouTube video ID in channel_url, then title + creator.
    Optionally creates transcript_embedding when OpenAI is configured.
    """
    service = TranscriptIngestService(db)
    return await service.ingest(payload)
