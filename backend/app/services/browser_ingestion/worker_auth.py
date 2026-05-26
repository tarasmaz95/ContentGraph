"""Worker bearer token hashing and verification."""

from __future__ import annotations

import hashlib
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.browser_ingestion import BrowserIngestionWorker

WORKER_AUTH_HEADER = "Authorization"


def generate_worker_token() -> str:
    return secrets.token_urlsafe(32)


def hash_worker_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def get_worker_from_token(
    db: AsyncSession,
    token: str,
) -> BrowserIngestionWorker | None:
    digest = hash_worker_token(token.strip())
    result = await db.execute(
        select(BrowserIngestionWorker).where(BrowserIngestionWorker.token_hash == digest)
    )
    return result.scalar_one_or_none()


async def verify_worker_token(
    authorization: str | None = Header(None, alias=WORKER_AUTH_HEADER),
    db: AsyncSession = Depends(get_db),
) -> BrowserIngestionWorker:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing worker bearer token")
    token = authorization[7:].strip()
    worker = await get_worker_from_token(db, token)
    if worker is None:
        raise HTTPException(status_code=401, detail="Invalid worker token")
    return worker
