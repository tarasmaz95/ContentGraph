"""Resolve YouTube video IDs for catalog rows (channel hub URLs, not watch links)."""

from __future__ import annotations

import asyncio
import re

from googleapiclient.discovery import build

from app.core.config import get_settings
from app.models.video import Video
from app.services.analytics.channel_id import extract_youtube_channel_id
from app.services.transcripts.transcript_service import TranscriptService

_HANDLE_PATTERN = re.compile(r"youtube\.com/@([A-Za-z0-9._-]+)")


class YouTubeVideoResolver:
    """
    Lookup watch IDs via YouTube Data API when channel_url has no ?v= id.

    Used by the transcript enrichment batch — not a separate ingest path.
    """

    def __init__(self) -> None:
        self._settings = get_settings()

    @property
    def is_available(self) -> bool:
        return bool(self._settings.youtube_api_key.strip())

    def resolve_from_url(self, url: str) -> str | None:
        """Parse ID from watch/youtu.be URLs."""
        vid = TranscriptService.extract_video_id(url)
        return vid if vid and len(vid) == 11 else None

    async def resolve_for_video(self, video: Video) -> str | None:
        """URL parse first, then YouTube search by channel handle + title."""
        yt_id = self.resolve_from_url(video.channel_url or "")
        if yt_id:
            return yt_id
        if not self.is_available:
            return None
        return await asyncio.to_thread(
            self._search_sync,
            video.title,
            video.channel_url or "",
        )

    def _search_sync(self, title: str, channel_url: str) -> str | None:
        api_key = self._settings.youtube_api_key
        youtube = build("youtube", "v3", developerKey=api_key, cache_discovery=False)

        channel_id = self._channel_id_for_url(youtube, channel_url)
        if not channel_id:
            return None

        # Trim title for search — long titles still work with first 100 chars
        q = (title or "").strip()[:120]
        if not q:
            return None

        response = (
            youtube.search()
            .list(
                part="snippet",
                channelId=channel_id,
                q=q,
                type="video",
                maxResults=5,
                order="relevance",
            )
            .execute()
        )

        items = response.get("items") or []
        if not items:
            return None

        title_lower = title.lower().strip()
        for item in items:
            snippet = item.get("snippet") or {}
            found_title = (snippet.get("title") or "").strip()
            if found_title.lower() == title_lower:
                return item.get("id", {}).get("videoId")

        # Fallback: best-ranked result from channel-scoped search
        return items[0].get("id", {}).get("videoId")

    def _channel_id_for_url(self, youtube, channel_url: str) -> str | None:
        """Resolve UC… channel id from @handle or /channel/ URL."""
        url = (channel_url or "").strip()
        if not url:
            return None

        if "/channel/" in url:
            cid = url.split("/channel/", 1)[-1].split("/")[0].split("?")[0].strip()
            if cid.startswith("UC"):
                return cid

        handle_match = _HANDLE_PATTERN.search(url)
        handle = handle_match.group(1) if handle_match else None
        if not handle:
            key = extract_youtube_channel_id(url)
            if key and key != "unknown" and not key.startswith("UC"):
                handle = key.lstrip("@")

        if not handle:
            return None

        try:
            resp = (
                youtube.channels()
                .list(part="id", forHandle=handle)
                .execute()
            )
        except Exception:
            return None

        items = resp.get("items") or []
        if not items:
            return None
        return items[0].get("id")
