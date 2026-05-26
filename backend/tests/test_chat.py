"""
Smoke: LangGraph chat pipeline against a live backend.

Skipped when the server returns 503 (OPENAI_API_KEY missing on backend).
"""

from __future__ import annotations

import httpx
import pytest

from tests.conftest import API_V1


@pytest.mark.requires_openai
def test_chat_returns_structured_response(api_v1: httpx.Client) -> None:
    """
    POST /api/v1/chat — minimal question; expects reply + analysis_type.

    Uses a short prompt to limit token cost during smoke runs.
    """
    response = api_v1.post(
        "/chat",
        json={"message": "What topics appear in my video catalog?"},
    )

    if response.status_code == 503:
        pytest.skip("Backend has no OPENAI_API_KEY — chat unavailable")

    assert response.status_code == 200, response.text
    data = response.json()

    assert isinstance(data.get("reply"), str) and len(data["reply"]) > 0
    assert isinstance(data.get("analysis_type"), str)
    assert isinstance(data.get("insights"), list)
    assert isinstance(data.get("relevant_videos"), list)
    assert "structured" in data
    assert isinstance(data.get("context_videos_used"), int)
    assert isinstance(data.get("suggestions"), list)
