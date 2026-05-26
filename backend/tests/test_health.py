"""
Smoke: process is up and API root responds.
"""

from __future__ import annotations

import httpx

from tests.conftest import BASE_URL


def test_health_returns_ok(api: httpx.Client) -> None:
    """GET /health — FastAPI liveness (no DB required)."""
    response = api.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("status") == "ok"


def test_api_v1_reachable(api: httpx.Client) -> None:
    """OpenAPI or videos list proves the v1 router is mounted."""
    response = api.get(f"{BASE_URL}/api/v1/videos", params={"limit": 1})
    assert response.status_code == 200
    body = response.json()
    assert "videos" in body
    assert "total" in body
    assert isinstance(body["videos"], list)
