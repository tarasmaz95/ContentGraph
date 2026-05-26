"""Transcript ingest endpoint — validation and happy path when DB has rows."""

from __future__ import annotations

import httpx


def test_transcript_ingest_rejects_short_text(api_v1: httpx.Client) -> None:
    response = api_v1.post(
        "/transcripts/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "Test",
            "creator": "Test Creator",
            "transcript_text": "too short",
        },
    )
    assert response.status_code == 422


def test_transcript_ingest_no_match(api_v1: httpx.Client) -> None:
    response = api_v1.post(
        "/transcripts/ingest",
        json={
            "video_url": "https://www.youtube.com/watch?v=zzzzzzzzzzz",
            "title": "__nonexistent_title_xyz__",
            "creator": "__nonexistent_creator_xyz__",
            "transcript_text": " ".join(["word"] * 50),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["matched"] is False
    assert body["transcript_saved"] is False
    assert body.get("sheets_writeback") == "skipped"
