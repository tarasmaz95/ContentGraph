"""
Smoke: pgvector semantic search endpoint.

Works with empty catalog ([]) or populated DB after sync.
"""

from __future__ import annotations

import httpx


def test_semantic_search_accepts_query(api_v1: httpx.Client) -> None:
    """
    GET /api/v1/videos/semantic-search?q=discipline

    200 + JSON array; may be empty if no embeddings yet.
    """
    response = api_v1.get(
        "/videos/semantic-search",
        params={"q": "discipline", "limit": 10},
    )
    assert response.status_code == 200, response.text
    results = response.json()
    assert isinstance(results, list)

    for item in results[:3]:
        assert "id" in item
        assert "title" in item
        assert "creator_name" in item
        # When vectors matched, backend may attach scores
        if item.get("similarity_score") is not None:
            assert isinstance(item["similarity_score"], (int, float))


def test_catalog_stats(api_v1: httpx.Client) -> None:
    """GET /api/v1/videos/catalog-stats — embedding coverage for UI."""
    response = api_v1.get("/videos/catalog-stats")
    assert response.status_code == 200
    body = response.json()
    assert "video_count" in body
    assert "title_embedding_count" in body
    assert "transcript_embedding_count" in body
    assert body["video_count"] >= 0


def test_videos_list_pagination(api_v1: httpx.Client) -> None:
    """GET /api/v1/videos — list endpoint used by dashboard."""
    response = api_v1.get("/videos", params={"limit": 5, "offset": 0})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 0
    assert len(body["videos"]) <= 5
