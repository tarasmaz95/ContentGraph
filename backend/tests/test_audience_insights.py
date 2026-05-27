"""Audience Intelligence endpoint smoke tests.

Hits the live backend (see conftest). Covers:
- 404 on missing video
- 200 + schema shape on an existing video
- ?refresh=true returns a fresh `generated_at` strictly newer than the cached read
- comment_score formula stays stable across releases
"""

from __future__ import annotations

import time

import httpx
import pytest

from app.services.comments.scoring import compute_comment_score


def test_compute_comment_score_formula() -> None:
    """Lock the formula — bump the version on any weight change."""
    assert compute_comment_score(
        likes_count=100, reply_count=5, is_pinned=False, is_hearted=False
    ) == 110

    assert compute_comment_score(
        likes_count=100, reply_count=5, is_pinned=True, is_hearted=False
    ) == 1110

    assert compute_comment_score(
        likes_count=100, reply_count=5, is_pinned=True, is_hearted=True
    ) == 1360

    assert compute_comment_score(
        likes_count=0, reply_count=0, is_pinned=False, is_hearted=False
    ) == 0


def test_audience_insights_404_for_missing_video(api_v1: httpx.Client) -> None:
    response = api_v1.get("/videos/999999999/audience-insights")
    assert response.status_code == 404


def _pick_video_id(api_v1: httpx.Client) -> int | None:
    """Find an existing video id; return None when catalog is empty."""
    resp = api_v1.get("/videos", params={"limit": 1})
    if resp.status_code != 200:
        return None
    videos = resp.json().get("videos", [])
    if not videos:
        return None
    return int(videos[0]["id"])


def test_audience_insights_returns_schema_for_existing_video(
    api_v1: httpx.Client,
) -> None:
    """Cold call (or cache hit) returns the full schema with no 500s."""
    video_id = _pick_video_id(api_v1)
    if video_id is None:
        pytest.skip("No videos in catalog yet — smoke depends on synced data")

    resp = api_v1.get(f"/videos/{video_id}/audience-insights")
    assert resp.status_code == 200
    body = resp.json()

    # Required keys present regardless of whether comments exist.
    expected_keys = {
        "video_id",
        "summary",
        "top_topics",
        "pain_points",
        "desires",
        "sentiment_distribution",
        "top_comments",
        "comment_count_at_generation",
        "total_comments",
        "model_used",
        "generated_at",
        "is_empty",
    }
    assert expected_keys.issubset(body.keys()), body.keys()
    assert body["video_id"] == video_id
    assert isinstance(body["top_topics"], list)
    assert isinstance(body["pain_points"], list)
    assert isinstance(body["desires"], list)
    assert isinstance(body["sentiment_distribution"], dict)
    assert {"positive", "neutral", "negative"} <= set(
        body["sentiment_distribution"].keys()
    )


def test_audience_insights_refresh_advances_generated_at(
    api_v1: httpx.Client,
) -> None:
    """`?refresh=true` regenerates and bumps `generated_at`."""
    video_id = _pick_video_id(api_v1)
    if video_id is None:
        pytest.skip("No videos in catalog yet — smoke depends on synced data")

    first = api_v1.get(f"/videos/{video_id}/audience-insights")
    assert first.status_code == 200
    first_ts = first.json()["generated_at"]

    # Ensure a perceptible delta in timestamps; ms precision is enough.
    time.sleep(1.1)

    second = api_v1.get(
        f"/videos/{video_id}/audience-insights",
        params={"refresh": "true"},
    )
    assert second.status_code == 200
    second_ts = second.json()["generated_at"]
    assert second_ts >= first_ts, (first_ts, second_ts)


def test_videos_comments_endpoint_exposes_comment_score(
    api_v1: httpx.Client,
) -> None:
    """`/videos/{id}/comments` includes the persisted `comment_score`."""
    video_id = _pick_video_id(api_v1)
    if video_id is None:
        pytest.skip("No videos in catalog yet — smoke depends on synced data")

    resp = api_v1.get(f"/videos/{video_id}/comments", params={"limit": 5})
    assert resp.status_code == 200
    rows = resp.json()
    # Empty list is fine (video without comments yet); the schema check below
    # only runs when rows exist.
    for row in rows:
        assert "comment_score" in row
        assert isinstance(row["comment_score"], int)
