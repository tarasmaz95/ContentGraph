"""Settings API — Google Sheets + OpenAI model."""

from __future__ import annotations

import httpx

ALLOWED_OPENAI_MODELS = (
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.3-instant",
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
)

DEFAULT_OPENAI_MODEL = "gpt-5.4"


def test_get_data_source_settings(api_v1: httpx.Client) -> None:
    response = api_v1.get("/settings/data-source")
    assert response.status_code == 200
    body = response.json()
    assert "spreadsheet_id" in body
    assert "range" in body
    assert "openai_model" in body
    assert "service_account_email" in body
    assert "@" in body["service_account_email"]
    assert body["openai_model"] in ALLOWED_OPENAI_MODELS
    assert body["source"] in ("database", "env", "database+env")
    assert body["model_source"] in ("database", "env")


def test_put_data_source_validation(api_v1: httpx.Client) -> None:
    response = api_v1.put(
        "/settings/data-source",
        json={"spreadsheet_id": "", "range": "bad", "openai_model": "invalid-model"},
    )
    assert response.status_code == 422


def test_put_data_source_persists(api_v1: httpx.Client) -> None:
    before = api_v1.get("/settings/data-source").json()
    payload = {
        "spreadsheet_id": "test-sheet-id-123",
        "range": "Titles!A:F",
        "openai_model": "gpt-5.2",
    }
    try:
        put = api_v1.put("/settings/data-source", json=payload)
        assert put.status_code == 200
        body = put.json()
        assert body["spreadsheet_id"] == payload["spreadsheet_id"]
        assert body["range"] == payload["range"]
        assert body["openai_model"] == payload["openai_model"]
        assert body["source"] == "database"
        assert body["model_source"] == "database"

        get = api_v1.get("/settings/data-source")
        assert get.json()["openai_model"] == payload["openai_model"]
    finally:
        if before.get("spreadsheet_id") and before.get("range"):
            api_v1.put(
                "/settings/data-source",
                json={
                    "spreadsheet_id": before["spreadsheet_id"],
                    "range": before["range"],
                    "openai_model": before.get("openai_model", DEFAULT_OPENAI_MODEL),
                },
            )
