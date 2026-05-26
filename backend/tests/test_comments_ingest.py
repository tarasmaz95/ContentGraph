"""Comments ingest endpoint — validation and no-match path."""

from __future__ import annotations

import httpx


def _sample_comments(n: int = 3) -> list[dict]:
    return [
        {
            "author": f"User{i}",
            "text": f"This is comment number {i} with enough text for validation.",
            "likes": 100 - i,
        }
        for i in range(n)
    ]


def test_comments_ingest_rejects_empty_list(api_v1: httpx.Client) -> None:
    response = api_v1.post(
        "/comments/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=x",
            "title": "Test",
            "creator": "Test",
            "comments": [],
        },
    )
    assert response.status_code == 422


def test_comments_ingest_no_match(api_v1: httpx.Client) -> None:
    response = api_v1.post(
        "/comments/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=zzzzzzzzzzz",
            "title": "__nonexistent_title_xyz__",
            "creator": "__nonexistent_creator_xyz__",
            "comments": _sample_comments(2),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["matched"] is False
    assert body["comments_saved"] == 0
    assert body.get("sheets_writeback") == "skipped"
