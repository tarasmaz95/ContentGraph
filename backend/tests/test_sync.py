"""
Smoke: Google Sheets → Postgres sync pipeline.

Requires service account JSON + GOOGLE_SHEETS_SPREADSHEET_ID on the backend container.
"""

from __future__ import annotations

import httpx
import pytest

from tests.conftest import sheets_credentials_available


@pytest.mark.requires_sheets
def test_sheets_sync(api_v1: httpx.Client) -> None:
    """
    POST /api/v1/sheets/sync — upsert videos and run enrichments.

    Skipped locally when credentials/service_account.json is missing.
    """
    if not sheets_credentials_available():
        pytest.skip(
            "Missing backend/credentials/service_account.json or "
            "GOOGLE_SHEETS_SPREADSHEET_ID"
        )

    response = api_v1.post("/sheets/sync")

    # 403 = sheet not shared; legacy path returned 500 with "permission" in body
    body_lower = response.text.lower()
    if response.status_code == 403 or (
        response.status_code == 500 and "permission" in body_lower
    ):
        pytest.skip(
            "Sheets not shared with service account (Viewer). "
            "Email: see client_email in backend/credentials/service_account.json"
        )

    assert response.status_code == 200, response.text
    data = response.json()

    # SyncResult shape — counts are non-negative integers
    assert data["total_rows"] >= 0
    assert data["created"] >= 0
    assert data["updated"] >= 0
    assert data["embeddings_created"] >= 0
    assert data["transcripts_fetched"] >= 0
    assert data["hooks_indexed"] >= 0
    assert data["comments_fetched"] >= 0
