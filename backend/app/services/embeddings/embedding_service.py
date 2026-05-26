"""OpenAI embeddings for video titles — lightweight semantic search layer."""

from collections.abc import Awaitable, Callable

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.video import Video
from app.services.embeddings.vector_utils import save_video_embedding

# Batch size for OpenAI embeddings API (titles only)
_EMBED_BATCH_SIZE = 100


class EmbeddingService:
    """
    Generates and stores title embeddings using text-embedding-3-small.

    No workers/queues — called inline after Sheets sync or on-demand.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        settings = get_settings()
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_embedding_model
        self._dimensions = settings.embedding_dimensions

    @property
    def is_available(self) -> bool:
        """True when OpenAI key is set (required to embed/search)."""
        return bool(get_settings().openai_api_key)

    async def embed_text(self, text: str) -> list[float]:
        """Single query embedding for semantic search."""
        response = await self._client.embeddings.create(
            model=self._model,
            input=text.strip(),
            dimensions=self._dimensions,
        )
        return response.data[0].embedding

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Batch embed multiple titles in one API call."""
        if not texts:
            return []

        response = await self._client.embeddings.create(
            model=self._model,
            input=texts,
            dimensions=self._dimensions,
        )
        # API returns embeddings sorted by index
        sorted_data = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in sorted_data]

    async def embed_all_missing(
        self,
        on_batch: Callable[[int, int], Awaitable[None]] | None = None,
    ) -> int:
        """
        Find videos without title_embedding and generate vectors.

        Called automatically after Google Sheets sync.
        Returns count of newly embedded videos.
        """
        if not self.is_available:
            return 0

        result = await self._db.execute(
            select(Video).where(Video.title_embedding.is_(None))
        )
        videos = list(result.scalars().all())
        if not videos:
            return 0

        total = len(videos)
        embedded_count = 0
        for i in range(0, len(videos), _EMBED_BATCH_SIZE):
            batch = videos[i : i + _EMBED_BATCH_SIZE]
            titles = [v.title for v in batch]
            vectors = await self.embed_texts(titles)

            for video, vector in zip(batch, vectors):
                await save_video_embedding(
                    self._db, video.id, vector, "title_embedding"
                )
                embedded_count += 1

            await self._db.commit()
            if on_batch:
                await on_batch(min(i + len(batch), total), total)

        return embedded_count

    async def embed_video(self, video: Video) -> None:
        """Embed one video title (e.g. after insert)."""
        if not self.is_available:
            return
        vector = await self.embed_text(video.title)
        await save_video_embedding(self._db, video.id, vector, "title_embedding")
        await self._db.flush()

    async def embed_transcripts_missing(
        self,
        on_batch: Callable[[int, int], Awaitable[None]] | None = None,
    ) -> int:
        """
        Embed videos that have transcript text but no transcript_embedding.

        Truncates long transcripts to stay within token limits.
        """
        if not self.is_available:
            return 0

        settings = get_settings()
        max_chars = settings.transcript_embed_max_chars

        result = await self._db.execute(
            select(Video).where(
                Video.transcript.isnot(None),
                Video.transcript_embedding.is_(None),
            )
        )
        videos = list(result.scalars().all())
        if not videos:
            return 0

        total = len(videos)
        count = 0
        for i in range(0, len(videos), _EMBED_BATCH_SIZE):
            batch = videos[i : i + _EMBED_BATCH_SIZE]
            texts = [v.transcript[:max_chars] if v.transcript else "" for v in batch]
            vectors = await self.embed_texts(texts)

            for video, vector in zip(batch, vectors):
                await save_video_embedding(
                    self._db, video.id, vector, "transcript_embedding"
                )
                count += 1

            await self._db.commit()
            if on_batch:
                await on_batch(min(i + len(batch), total), total)

        return count
