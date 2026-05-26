"""Browser ingestion queue — unit tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_browser_ingestion_dashboard():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/browser-ingestion/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "catalog_videos_total" in data
    assert "worker" in data


@pytest.mark.asyncio
async def test_register_worker_returns_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/browser-ingestion/workers/register",
            json={"name": "test-worker"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["token"]
    assert body["worker_id"] > 0
