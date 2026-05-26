"""Read service account email from credentials JSON (for UI + error messages)."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import get_settings

DEFAULT_SERVICE_ACCOUNT_EMAIL = (
    "contentgraph-lite@denis-automation.iam.gserviceaccount.com"
)


def get_service_account_email() -> str:
    """client_email from GOOGLE_SERVICE_ACCOUNT_FILE, or known default."""
    settings = get_settings()
    path = Path(settings.google_service_account_file)
    if not path.is_file():
        return DEFAULT_SERVICE_ACCOUNT_EMAIL
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle).get("client_email") or DEFAULT_SERVICE_ACCOUNT_EMAIL
    except (json.JSONDecodeError, OSError):
        return DEFAULT_SERVICE_ACCOUNT_EMAIL
