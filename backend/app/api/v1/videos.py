"""Video listing, search, semantic search, detail, and intelligence."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.services.settings import get_chat_llm
from app.schemas.audience_insights import AudienceInsights
from app.schemas.comments import CommentRead
from app.schemas.video import CatalogStats, VideoDetail, VideoListResponse, VideoRead
from app.schemas.video_intelligence import VideoIntelligence
from app.models.video import Video
from app.services.audience_insights import AudienceInsightsService
from app.services.comments.comments_service import CommentsService
from app.services.video_intelligence.video_intelligence_service import (
    VideoIntelligenceService,
)
from app.services.video_service import VideoService

router = APIRouter(prefix="/videos", tags=["videos"])


@router.get("", response_model=VideoListResponse)
async def list_videos(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> VideoListResponse:
    service = VideoService(db)
    videos, total = await service.list_videos(limit=limit, offset=offset)
    return VideoListResponse(videos=videos, total=total)


@router.get("/top", response_model=list[VideoRead])
async def top_videos(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[VideoRead]:
    service = VideoService(db)
    return await service.top_videos(limit=limit)


@router.get("/catalog-stats", response_model=CatalogStats)
async def catalog_stats(db: AsyncSession = Depends(get_db)) -> CatalogStats:
    """Embedding coverage — drives honest semantic-search UI copy."""
    service = VideoService(db)
    stats = await service.catalog_stats()
    return CatalogStats(**stats)


@router.get("/semantic-search", response_model=list[VideoRead])
async def semantic_search_videos(
    q: str = Query(..., min_length=1, description="Natural language query"),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[VideoRead]:
    """
    Transcript-aware semantic search (title + transcript pgvector).

    Example: ?q=identity transformation
    """
    service = VideoService(db)
    results = await service.semantic_search(q=q, limit=limit)
    if results:
        return results
    return await service.search(q=q, limit=limit)


@router.get("/search", response_model=list[VideoRead])
async def search_videos(
    q: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[VideoRead]:
    service = VideoService(db)
    return await service.search(q=q, limit=limit)


@router.get("/{video_id}/intelligence", response_model=VideoIntelligence)
async def get_video_intelligence(
    video_id: int,
    refresh: bool = Query(False, description="Regenerate AI breakdown with LLM"),
    db: AsyncSession = Depends(get_db),
) -> VideoIntelligence:
    """
    Deep video intelligence — breakdown, transcript, structure, viral, similar, charts.

    Example: /videos/123/intelligence
    """
    settings = get_settings()
    llm = await get_chat_llm(db, temperature=0.35) if settings.openai_api_key else None
    svc = VideoIntelligenceService(db)
    intel = await svc.get_intelligence(video_id, llm=llm, refresh=refresh)
    if intel is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return intel


@router.get("/{video_id}/comments", response_model=list[CommentRead])
async def list_video_comments(
    video_id: int,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[CommentRead]:
    """Top stored comments for a video, sorted by likes (extension or API ingest)."""
    video = await db.get(Video, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")

    rows = await CommentsService(db).list_for_video(video_id, limit=limit)
    return [
        CommentRead(
            id=r.id,
            video_id=r.video_id,
            comment_text=r.comment_text,
            author_name=r.author_name or "",
            likes_count=r.likes_count or 0,
            reply_count=getattr(r, "reply_count", 0) or 0,
            comment_score=getattr(r, "comment_score", 0) or 0,
            published_at=r.published_at,
            published_text=getattr(r, "published_text", None),
            is_pinned=bool(getattr(r, "is_pinned", False)),
            is_hearted=bool(getattr(r, "is_hearted", False)),
            sentiment=r.sentiment or "neutral",
            emotional_tags=list(r.emotional_tags or []),
        )
        for r in rows
    ]


@router.get(
    "/{video_id}/audience-insights",
    response_model=AudienceInsights,
)
async def get_audience_insights(
    video_id: int,
    refresh: bool = Query(
        False,
        description=(
            "Regenerate insight (runs deterministic + optional LLM pass). "
            "Default serves the persisted cache row."
        ),
    ),
    db: AsyncSession = Depends(get_db),
) -> AudienceInsights:
    """Audience Intelligence layer on top of structured comments.

    Read-from-cache by default. `?refresh=true` regenerates and overwrites the
    cached row. No background jobs.
    """
    video = await db.get(Video, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")

    settings = get_settings()
    llm = await get_chat_llm(db, temperature=0.3) if settings.openai_api_key else None

    service = AudienceInsightsService(db)
    insights = await service.get_for_video(video_id, refresh=refresh, llm=llm)
    # Service inserts/updates the cache row but defers commit to the caller so
    # one HTTP request = one transaction.
    await db.commit()
    return insights


@router.post("/{video_id}/comments/fetch")
async def fetch_video_comments(
    video_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, int | str]:
    """
    Pull top YouTube comments for one video (requires YOUTUBE_API_KEY).

    Replaces existing stored comments for that video.
    """
    video = await db.get(Video, video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")

    svc = CommentsService(db)
    if not svc.is_available:
        raise HTTPException(
            status_code=503,
            detail="YouTube API key not configured (YOUTUBE_API_KEY)",
        )

    count = await svc.fetch_for_video(video)
    await db.commit()
    return {"video_id": video_id, "comments_saved": count}


@router.get("/{video_id}", response_model=VideoDetail)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
) -> VideoDetail:
    """Single video with full transcript when available."""
    service = VideoService(db)
    video = await service.get_by_id(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return video
