"""In-process TTL cache for creator intelligence — no Redis."""

from __future__ import annotations

import time
from typing import Any

_DEFAULT_TTL_SECONDS = 600  # 10 minutes


class _TTLCache:
    def __init__(self, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.monotonic() + self._ttl, value)

    def invalidate_prefix(self, prefix: str) -> None:
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]

    def clear(self) -> None:
        self._store.clear()


_intelligence_cache = _TTLCache()


def intelligence_cache_key(creator_name: str, *, lite: bool = False) -> str:
    suffix = ":lite" if lite else ":full"
    return f"intel:{creator_name.lower()}{suffix}"


def get_cached_intelligence(key: str) -> Any | None:
    return _intelligence_cache.get(key)


def set_cached_intelligence(key: str, value: Any) -> None:
    _intelligence_cache.set(key, value)


def invalidate_intelligence_cache() -> None:
    """Call after Sheets sync or stats snapshot run."""
    _intelligence_cache.clear()
