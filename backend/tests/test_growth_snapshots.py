"""Historical snapshot + growth analytics smoke tests (live API)."""

from __future__ import annotations

import httpx


def test_snapshot_run_idempotent(api_v1: httpx.Client) -> None:
    """POST /analytics/snapshots/run twice — same-day upsert."""
    r1 = api_v1.post("/analytics/snapshots/run")
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert body1["creators_saved"] >= 0
    assert body1["videos_saved"] >= 0

    r2 = api_v1.post("/analytics/snapshots/run")
    assert r2.status_code == 200, r2.text


def test_snapshot_status_and_history(api_v1: httpx.Client) -> None:
    api_v1.post("/analytics/snapshots/run")
    status = api_v1.get("/analytics/snapshots/status")
    assert status.status_code == 200, status.text
    body = status.json()
    assert body["last_status"] == "success"
    assert body["creators_saved"] >= 0

    hist = api_v1.get("/analytics/snapshots/history?limit=5")
    assert hist.status_code == 200, hist.text
    assert len(hist.json()["items"]) >= 1


def test_growth_api_routes(api_v1: httpx.Client) -> None:
    api_v1.post("/analytics/snapshots/run")

    for path in (
        "/analytics/creators/growth?limit=5",
        "/analytics/videos/breakouts?limit=5",
        "/analytics/velocity?limit=5",
    ):
        r = api_v1.get(path)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
