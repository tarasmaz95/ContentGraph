"""Lightweight YouTube transcript fetch + store + embed (no workers/queues)."""

import asyncio
import re
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import IpBlocked, RequestBlocked
from youtube_transcript_api.proxies import GenericProxyConfig

from app.core.config import get_settings
from app.models.video import Video
from app.services.embeddings.embedding_service import EmbeddingService

# YouTube video IDs are 11 characters
_VIDEO_ID_PATTERN = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})"
)


class TranscriptService:
    """
    Fetches transcripts from YouTube URLs and stores them on Video rows.

    Flow: channel_url → extract video ID → youtube-transcript-api → save text
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._embeddings = EmbeddingService(db)
        self._settings = get_settings()
        proxy_url = self._settings.transcript_http_proxy.strip()
        if proxy_url:
            proxy_cfg = GenericProxyConfig(http_url=proxy_url, https_url=proxy_url)
            self._yt_api = YouTubeTranscriptApi(proxy_config=proxy_cfg)
        else:
            self._yt_api = YouTubeTranscriptApi()

    @staticmethod
    def extract_video_id(url: str) -> str | None:
        """Parse YouTube video ID from common URL formats."""
        if not url:
            return None

        match = _VIDEO_ID_PATTERN.search(url)
        if match:
            return match.group(1)

        # youtu.be/ID without regex overlap
        parsed = urlparse(url)
        if parsed.netloc in ("youtu.be", "www.youtu.be") and parsed.path.strip("/"):
            vid = parsed.path.strip("/").split("/")[0]
            if len(vid) == 11:
                return vid

        # watch?v= query param
        if "youtube.com" in parsed.netloc:
            qs = parse_qs(parsed.query)
            if "v" in qs and qs["v"]:
                return qs["v"][0][:11]

        return None

    def _fetch_transcript_sync(self, video_id: str) -> str | None:
        """
        Blocking call to youtube-transcript-api (run in thread pool).

        Tries English first, then any available language.
        """
        fetched = None
        try:
            fetched = self._yt_api.fetch(
                video_id, languages=["en", "en-US", "en-GB"]
            )
        except (RequestBlocked, IpBlocked):
            raise
        except Exception:
            try:
                fetched = self._yt_api.fetch(video_id)
            except (RequestBlocked, IpBlocked):
                raise
            except Exception:
                return None

        if not fetched:
            return None

        parts: list[str] = []
        for snippet in fetched:
            raw = getattr(snippet, "text", None)
            if raw:
                parts.append(str(raw).strip())
                continue
            if isinstance(snippet, dict) and snippet.get("text"):
                parts.append(str(snippet["text"]).strip())

        text = " ".join(parts)
        return text if text else None

    async def fetch_transcript_for_video(self, video: Video) -> bool:
        """
        Download transcript and save on the video row.

        Returns True if transcript was saved.
        """
        if video.transcript:
            return False

        video_id = self.extract_video_id(video.video_url or "") or self.extract_video_id(
            video.channel_url
        )
        if not video_id:
            return False

        raw = await asyncio.to_thread(self._fetch_transcript_sync, video_id)
        if not raw:
            return False

        video.transcript = raw
        video.transcript_embedding = None  # embed in next enrichment step
        await self._db.flush()
        return True

    async def embed_transcript(self, video: Video) -> bool:
        """Generate transcript_embedding for one video."""
        if not video.transcript or video.transcript_embedding is not None:
            return False
        if not self._embeddings.is_available:
            return False

        max_chars = self._settings.transcript_embed_max_chars
        text = video.transcript[:max_chars]
        from app.services.embeddings.vector_utils import save_video_embedding

        vector = await self._embeddings.embed_text(text)
        await save_video_embedding(
            self._db, video.id, vector, "transcript_embedding"
        )
        await self._db.flush()
        return True

    async def enrich_missing(self) -> tuple[int, int]:
        """
        After Sheets sync: fetch missing transcripts + embed them.

        Returns (transcripts_fetched, transcript_embeddings_created).
        Limited per sync to keep the pipeline lightweight.
        """
        limit = self._settings.transcript_enrich_limit

        # Videos without transcript text
        result = await self._db.execute(
            select(Video)
            .where(Video.transcript.is_(None))
            .where(Video.channel_url.isnot(None))
            .limit(limit)
        )
        to_fetch = list(result.scalars().all())

        fetched = 0
        for video in to_fetch:
            if await self.fetch_transcript_for_video(video):
                fetched += 1

        await self._db.commit()

        # Embed transcripts that have text but no vector
        embedded = await self._embeddings.embed_transcripts_missing()
        return fetched, embedded

    @staticmethod
    def extract_snippet(transcript: str, query: str, max_len: int = 280) -> str:
        """
        Pull a short excerpt from transcript for LangGraph / UI preview.

        Prefers a window around the first query keyword match.
        """
        if not transcript:
            return ""

        lower = transcript.lower()
        query_words = [w for w in re.findall(r"[a-z]{3,}", query.lower()) if len(w) >= 4]

        start = 0
        for word in query_words:
            idx = lower.find(word)
            if idx >= 0:
                start = max(0, idx - 60)
                break

        snippet = transcript[start : start + max_len].strip()
        if start > 0:
            snippet = "…" + snippet
        if start + max_len < len(transcript):
            snippet = snippet + "…"
        return snippet
