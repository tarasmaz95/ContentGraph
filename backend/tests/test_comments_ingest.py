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


def test_comments_ingest_accepts_long_comment_text(api_v1: httpx.Client) -> None:
    long_text = "word " * 2500
    response = api_v1.post(
        "/comments/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=zzzzzzzzzzz",
            "title": "__nonexistent_title_xyz__",
            "creator": "__nonexistent_creator_xyz__",
            "comments": [{"author": "User", "text": long_text, "likes": 1}],
        },
    )
    assert response.status_code == 200
    assert response.json()["matched"] is False


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


def test_comments_ingest_accepts_structured_v028_payload(api_v1: httpx.Client) -> None:
    """v0.2.8+ extensions send full structured metadata; schema must accept it."""
    response = api_v1.post(
        "/comments/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=zzzzzzzzzzz",
            "title": "__nonexistent_title_xyz__",
            "creator": "__nonexistent_creator_xyz__",
            "comments": [
                {
                    "author": "Creator",
                    "text": "Top pinned comment with full metadata",
                    "likes_count": 532,
                    "reply_count": 14,
                    "published_text": "2 days ago",
                    "is_pinned": True,
                    "is_hearted": True,
                },
                {
                    "author": "Fan",
                    "text": "Reply-rich follow-up",
                    "likes_count": 88,
                    "reply_count": 3,
                },
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    # No matching catalog video — that's fine; we only verify the schema path.
    assert body["matched"] is False


def test_comments_ingest_legacy_v027_payload_still_works(api_v1: httpx.Client) -> None:
    """Legacy clients (v0.2.6 / v0.2.7) send only {author, text, likes} — keep working."""
    response = api_v1.post(
        "/comments/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=zzzzzzzzzzz",
            "title": "__nonexistent_title_xyz__",
            "creator": "__nonexistent_creator_xyz__",
            "comments": [{"author": "Old", "text": "legacy shape", "likes": 7}],
        },
    )
    assert response.status_code == 200
    assert response.json()["matched"] is False
