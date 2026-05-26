"""
Shared smoke-test configuration.

Tests hit a *running* API (Docker or local uvicorn), not mocked internals.
Set SMOKE_BASE_URL to override the default backend root.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

# Project root .env — spreadsheet id for sync skip logic
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# Backend root URL — no trailing slash
BASE_URL: str = os.getenv("SMOKE_BASE_URL", "http://localhost:8001").rstrip("/")
API_V1: str = f"{BASE_URL}/api/v1"

# Longer timeout for LLM + Sheets sync
HTTP_TIMEOUT: float = float(os.getenv("SMOKE_HTTP_TIMEOUT", "120"))

# Google service account path (repo convention)
SERVICE_ACCOUNT_PATH: Path = (
    Path(__file__).resolve().parents[1] / "credentials" / "service_account.json"
)


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers used by optional integration checks."""
    config.addinivalue_line(
        "markers",
        "requires_openai: needs OPENAI_API_KEY on the running backend",
    )
    config.addinivalue_line(
        "markers",
        "requires_sheets: needs Google Sheets credentials + spreadsheet id",
    )


@pytest.fixture
def api() -> Iterator[httpx.Client]:
    """HTTP client scoped to the live backend."""
    with httpx.Client(base_url=BASE_URL, timeout=HTTP_TIMEOUT) as client:
        yield client


@pytest.fixture
def api_v1() -> Iterator[httpx.Client]:
    """HTTP client with /api/v1 prefix."""
    with httpx.Client(base_url=API_V1, timeout=HTTP_TIMEOUT) as client:
        yield client


def sheets_credentials_available() -> bool:
    """True when sync smoke can realistically call Google Sheets."""
    return SERVICE_ACCOUNT_PATH.is_file() and bool(
        os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
    )
