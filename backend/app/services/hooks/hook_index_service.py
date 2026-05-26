"""Index videos into hook_patterns — full or incremental after sync."""

from collections.abc import Awaitable, Callable

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hook_pattern import HookPattern
from app.models.video import Video
from app.services.hooks.hook_extraction import (
    effectiveness_score,
    extract_hooks_from_text,
)


class HookIndexService:
    """Rebuild or incrementally update HookPattern rows from videos."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def rebuild_index(
        self,
        *,
        video_ids: list[int] | None = None,
        on_progress: Callable[[int, int, str], Awaitable[None]] | None = None,
    ) -> int:
        """
        Update hook patterns.

        - ``video_ids`` set: delete patterns for those videos only, re-extract.
        - ``video_ids`` None / empty catalog patterns: full catalog rebuild.
        - If >80% of catalog is in ``video_ids``, use full rebuild (cheaper than huge IN).
        """
        existing_count = await self._db.scalar(select(func.count()).select_from(HookPattern)) or 0
        total_videos = await self._db.scalar(select(func.count()).select_from(Video)) or 0

        use_full = existing_count == 0 or not video_ids
        if video_ids and total_videos > 0 and len(video_ids) > total_videos * 0.8:
            use_full = True

        if use_full:
            return await self._rebuild_all(on_progress=on_progress)

        return await self._rebuild_for_videos(video_ids or [], on_progress=on_progress)

    async def _rebuild_all(
        self,
        on_progress: Callable[[int, int, str], Awaitable[None]] | None = None,
    ) -> int:
        await self._db.execute(delete(HookPattern))
        await self._db.commit()

        result = await self._db.execute(select(Video))
        videos = list(result.scalars().all())
        return await self._index_videos(videos, on_progress=on_progress)

    async def _rebuild_for_videos(
        self,
        video_ids: list[int],
        on_progress: Callable[[int, int, str], Awaitable[None]] | None = None,
    ) -> int:
        if not video_ids:
            return 0

        await self._db.execute(
            delete(HookPattern).where(HookPattern.video_id.in_(video_ids))
        )
        await self._db.commit()

        result = await self._db.execute(
            select(Video).where(Video.id.in_(video_ids))
        )
        videos = list(result.scalars().all())
        return await self._index_videos(videos, on_progress=on_progress)

    async def _index_videos(
        self,
        videos: list[Video],
        on_progress: Callable[[int, int, str], Awaitable[None]] | None = None,
    ) -> int:
        if not videos:
            return 0

        total = len(videos)
        global_avg = await self._db.scalar(select(func.avg(Video.views_count))) or 1.0

        creator_avgs: dict[str, float] = {}
        creator_stmt = (
            select(Video.creator_name, func.avg(Video.views_count))
            .group_by(Video.creator_name)
        )
        for name, avg in (await self._db.execute(creator_stmt)).all():
            creator_avgs[name] = float(avg or global_avg)

        count = 0
        for idx, video in enumerate(videos):
            transcript_lead = (video.transcript or "")[:400] if video.transcript else None
            baseline = creator_avgs.get(video.creator_name, global_avg)
            extracted = extract_hooks_from_text(video.title, transcript_lead)

            for hook in extracted:
                eff = effectiveness_score(video.views_count, baseline)
                row = HookPattern(
                    video_id=video.id,
                    hook_text=hook.hook_text,
                    hook_type=hook.hook_type,
                    creator_name=video.creator_name,
                    views_count=video.views_count,
                    video_title=video.title,
                    effectiveness_score=eff,
                    confidence_score=hook.confidence,
                    keywords=hook.keywords,
                    emotional_triggers=hook.emotional_triggers,
                )
                self._db.add(row)
                count += 1

            if on_progress and (idx + 1) % 25 == 0:
                await on_progress(idx + 1, total, video.creator_name)

        await self._db.commit()
        if on_progress:
            await on_progress(total, total, videos[-1].creator_name if videos else "")
        return count
