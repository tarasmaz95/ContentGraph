"""AI chat endpoint — OpenAI completion over synced video data."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_chat_service import AIChatService
from app.services.video_service import VideoService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured",
        )

    ai_service = AIChatService(db)
    result = await ai_service.ask(body.message)

    return ChatResponse(
        reply=result.reply,
        analysis_type=result.analysis_type,
        relevant_videos=result.relevant_videos,
        insights=result.insights,
        structured=result.structured,
        context_videos_used=result.context_videos_used,
        suggestions=result.suggestions,
    )
