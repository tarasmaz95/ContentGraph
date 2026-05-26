"""Retrieval — hybrid semantic search or full creator video aggregation."""

from typing import Callable

from app.ai.state import GraphState
from app.schemas.video_snapshot import VideoSnapshot
from app.schemas.video import VideoRead
from app.services.comments.comments_service import CommentsService
from app.services.creator_intelligence.creator_profile_service import CreatorProfileService
from app.services.video_service import VideoService


def _read_to_snapshot(video: VideoRead) -> VideoSnapshot:
    return VideoSnapshot(
        id=video.id,
        creator_name=video.creator_name,
        channel_url=video.channel_url,
        title=video.title,
        views_count=video.views_count,
        subscribers_count=video.subscribers_count,
        published_at=video.published_at.isoformat() if video.published_at else None,
        has_transcript=video.has_transcript,
        transcript_snippet=video.transcript_snippet,
        match_source=video.match_source,
        similarity_score=video.similarity_score,
    )


def _extract_keywords(query: str, search_terms: list[str]) -> list[str]:
    keywords: list[str] = list(search_terms)
    stop = {
        "what", "which", "how", "why", "does", "do", "the", "a", "an",
        "for", "get", "most", "best", "analyze", "analysis", "about", "compare", "vs",
    }
    for token in query.lower().split():
        cleaned = token.strip("?.,!")
        if len(cleaned) >= 3 and cleaned not in stop and cleaned not in keywords:
            keywords.append(cleaned)
    return keywords[:8]


def create_retrieval_node(
    video_service: VideoService,
    profile_service: CreatorProfileService,
) -> Callable[[GraphState], GraphState]:
    """
    Creator intelligence: aggregate ALL videos for named creators.

    Other queries: hybrid pgvector + keyword retrieval.
    """

    async def retrieval_node(state: GraphState) -> GraphState:
        query = state.get("query", "")
        analysis_type = state.get("analysis_type", "general_chat")
        creator_filter = state.get("creator_filter")
        creator_names = state.get("creator_names", [])

        # --- Creator-level: pull full creator catalogs ---
        if analysis_type == "creator_comparison" and creator_names:
            hits = await profile_service.get_videos_for_creators(creator_names, limit_per=50)
        elif analysis_type == "creator_profile" and creator_filter:
            hits = await profile_service.get_videos_for_creator(creator_filter, limit=60)
        elif analysis_type == "creator_analysis" and creator_filter:
            hits = await profile_service.get_videos_for_creator(creator_filter, limit=50)
            if len(hits) < 5:
                extra = await video_service.hybrid_retrieve(
                    query=query,
                    keywords=_extract_keywords(query, state.get("search_terms", [])),
                    creator_filter=creator_filter,
                    limit=30,
                )
                seen = {v.id for v in hits}
                hits.extend(v for v in extra if v.id not in seen)
        elif analysis_type in (
            "video_breakdown",
            "transcript_analysis",
            "viral_analysis",
            "audience_analysis",
            "comments_analysis",
        ):
            vid = state.get("video_id")
            if vid:
                detail = await video_service.get_by_id(vid)
                hits = []
                if detail:
                    hits = [detail]
                    extra = await profile_service.get_videos_for_creator(
                        detail.creator_name, limit=15
                    )
                    seen = {detail.id}
                    hits.extend(v for v in extra if v.id not in seen)
                    # Pull comment-matched videos for audience context
                    if analysis_type in ("audience_analysis", "comments_analysis"):
                        comments_svc = CommentsService(video_service._db)
                        for c in await comments_svc.search_comment_text(query, limit=10):
                            v = await video_service.get_by_id(c.video_id)
                            if v and v.id not in seen:
                                hits.append(v)
                                seen.add(v.id)
            elif creator_filter:
                hits = await profile_service.get_videos_for_creator(creator_filter, limit=40)
            else:
                hits = await video_service.hybrid_retrieve(
                    query=query,
                    keywords=_extract_keywords(query, state.get("search_terms", [])),
                    limit=30,
                )
        elif analysis_type in ("script_generation", "script_analysis") and creator_filter:
            # Creator-aware scripts: full catalog + topic semantic hits
            hits = await profile_service.get_videos_for_creator(creator_filter, limit=50)
            topic = state.get("topic") or query
            extra = await video_service.hybrid_retrieve(
                query=topic,
                keywords=_extract_keywords(topic, state.get("search_terms", [])),
                creator_filter=creator_filter,
                limit=25,
            )
            seen = {v.id for v in hits}
            hits.extend(v for v in extra if v.id not in seen)
        else:
            hits = await video_service.hybrid_retrieve(
                query=query,
                keywords=_extract_keywords(query, state.get("search_terms", [])),
                creator_filter=creator_filter,
                limit=40,
            )

        return {"relevant_videos": [_read_to_snapshot(v) for v in hits]}

    return retrieval_node
