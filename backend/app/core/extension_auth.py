"""Optional API key for Chrome extension ingest endpoints."""

from fastapi import Header, HTTPException

from app.core.config import get_settings

EXTENSION_KEY_HEADER = "X-Extension-Key"


async def verify_extension_api_key(
    x_extension_key: str | None = Header(None, alias=EXTENSION_KEY_HEADER),
) -> None:
    """
    When EXTENSION_API_KEY is set, require matching X-Extension-Key header.

    If unset, ingest remains open (backward compatible).
    """
    expected = get_settings().extension_api_key.strip()
    if not expected:
        return
    if not x_extension_key or x_extension_key.strip() != expected:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing extension API key",
        )
