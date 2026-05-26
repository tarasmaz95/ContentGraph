"""Sync pipeline: Sheets -> Postgres -> enrichment with optional progress reporting."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import TYPE_CHECKING, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api._errors import IpBlocked, RequestBlocked

from app.core.config import get_settings
from app.models.video import Video
from app.schemas.video import SyncResult
from app.services.cache.intelligence_cache import invalidate_intelligence_cache
from app.services.embeddings.embedding_service import EmbeddingService
from app.services.comments.comments_service import CommentsService
from app.services.hooks.hook_index_service import HookIndexService
from app.services.settings import AppSettingsService
from app.services.transcripts.transcript_service import TranscriptService
from google_sheets.client import GoogleSheetsClient
from google_sheets.row_index import rebuild_sheet_row_index

if TYPE_CHECKING:
    from app.services.sheets.sync_progress import SyncProgressBridge

logger = logging.getLogger(__name__)

SyncMode = Literal["quick", "full"]

_TRANSCRIPT_FETCH_TIMEOUT = 25.0
_TRANSCRIPT_MAX_RETRIES = 3


def _pick_existing_row(
    rows: list[Video],
    *,
    title: str,
    published_at: datetime | None,
) -> Video:
    """When several rows share creator+title, update the legacy stub first."""
    title_lower = title.lower()
    matching = [r for r in rows if r.title.lower() == title_lower] or rows

    for row in matching:
        if not (row.video_url or "").strip() or row.published_at is None:
            return row
    if published_at is not None:
        for row in matching:
            if row.published_at == published_at:
                return row
    return matching[0]


class SheetsSyncService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._embeddings = EmbeddingService(db)
        self._transcripts = TranscriptService(db)
        self._settings = get_settings()

    async def sync(
        self,
        progress: SyncProgressBridge | None = None,
        *,
        mode: SyncMode = "quick",
    ) -> tuple[SyncResult, dict]:
        """
        Sheets sync pipeline.

        quick: catalog refresh + title patterns + incremental hooks (no transcripts/comments).
        full: everything including transcript/comment enrichment.
        """
        warnings: list[dict[str, str]] = []
        hook_dirty_ids: list[int] = []
        transcript_blocked = 0

        if progress:
            await progress.stage("reading_sheet", processed=0, total=None)

        settings_svc = AppSettingsService(self._db)
        config = await settings_svc.resolve_sheets()
        column_mapping = await settings_svc.resolve_column_mapping()
        client = GoogleSheetsClient(
            spreadsheet_id=config.spreadsheet_id,
            sheets_range=config.range,
            column_mapping=column_mapping,
        )
        sheet_rows = client.fetch_rows()
        total_rows = len(sheet_rows)
        created = 0
        updated = 0
        sheet_transcripts = 0

        if progress:
            await progress.stage(
                "saving_videos",
                processed=0,
                total=total_rows,
            )

        for idx, row in enumerate(sheet_rows):
            published_at = self._parse_date(row["published_at_raw"])
            existing = await self._find_existing(
                creator_name=row["creator_name"],
                title=row["title"],
                published_at=published_at,
                video_url=row["video_url"],
            )

            if existing is None:
                video = Video(
                    creator_name=row["creator_name"],
                    channel_url=row["channel_url"],
                    video_url=row["video_url"],
                    subscribers_count=row["subscribers_count"],
                    title=row["title"],
                    views_count=row["views_count"],
                    published_at=published_at,
                    transcript=row["transcript"] or None,
                )
                self._db.add(video)
                await self._db.flush()
                hook_dirty_ids.append(video.id)
                created += 1
            else:
                title_changed = existing.title != row["title"]
                existing.channel_url = row["channel_url"]
                existing.video_url = row["video_url"]
                existing.subscribers_count = row["subscribers_count"]
                existing.views_count = row["views_count"]
                if published_at is not None and existing.published_at is None:
                    existing.published_at = published_at
                if title_changed:
                    existing.title = row["title"]
                    existing.title_embedding = None
                sheet_transcript = (row["transcript"] or "").strip()
                transcript_changed = False
                if sheet_transcript:
                    sheet_transcripts += 1
                    if sheet_transcript != (existing.transcript or ""):
                        existing.transcript = sheet_transcript
                        existing.transcript_embedding = None
                        transcript_changed = True
                if title_changed or transcript_changed:
                    hook_dirty_ids.append(existing.id)
                updated += 1

            if progress and (idx + 1) % 50 == 0:
                await progress.stage(
                    "saving_videos",
                    processed=idx + 1,
                    total=total_rows,
                    current_entity_name=row["creator_name"],
                )

        await self._db.commit()

        try:
            indexed = await rebuild_sheet_row_index(
                self._db, config.spreadsheet_id, sheet_rows
            )
            logger.info(
                "Sheet video row index rebuilt: %s entries for %s",
                indexed,
                config.spreadsheet_id,
            )
        except Exception as exc:
            logger.error(
                "Sheet row index rebuild failed for %s: %s",
                config.spreadsheet_id,
                exc,
                exc_info=True,
            )

        if progress:
            await progress.stage(
                "saving_videos",
                processed=total_rows,
                total=total_rows,
            )

        embeddings_created = await self._embeddings.embed_all_missing(
            on_batch=self._title_embed_progress(progress) if progress else None,
        )

        transcripts_fetched = 0
        transcript_embeddings_created = 0
        comments_fetched = 0

        transcript_dirty_ids: list[int] = []
        if mode == "full":
            (
                transcripts_fetched,
                transcript_embeddings_created,
                transcript_blocked,
                transcript_dirty_ids,
            ) = await self._enrich_transcripts_resilient(progress, warnings)
            comments_fetched = await self._enrich_comments_resilient(progress, warnings)
            hook_dirty_ids.extend(transcript_dirty_ids)

        unique_dirty = list(dict.fromkeys(hook_dirty_ids))
        hooks_indexed = await HookIndexService(self._db).rebuild_index(
            video_ids=unique_dirty,
            on_progress=self._hook_progress(progress) if progress else None,
        )

        if transcript_blocked > 0:
            warnings.append(
                {
                    "code": "transcript_source_blocked",
                    "detail": (
                        f"{transcript_blocked} videos could not fetch transcripts "
                        "(source temporarily unavailable)"
                    ),
                }
            )
            if progress:
                await progress.warning(
                    "transcript_source_blocked",
                    "Some transcripts could not be processed right now.",
                )

        if progress:
            await progress.stage("finalizing", processed=1, total=1)

        invalidate_intelligence_cache()

        catalog_video_count = int(
            await self._db.scalar(select(func.count()).select_from(Video)) or 0
        )

        result = SyncResult(
            created=created,
            updated=updated,
            total_rows=total_rows,
            embeddings_created=embeddings_created,
            transcripts_fetched=transcripts_fetched,
            transcript_embeddings_created=transcript_embeddings_created,
            hooks_indexed=hooks_indexed,
            comments_fetched=comments_fetched,
        )

        summary = {
            "mode": mode,
            "total_rows": total_rows,
            "created": created,
            "updated": updated,
            "titles_analyzed": embeddings_created,
            "transcripts_processed": transcripts_fetched + transcript_embeddings_created,
            "transcript_text_from_sheet": sheet_transcripts,
            "hook_patterns_found": hooks_indexed,
            "audience_discussions_added": comments_fetched,
            "warning_count": len(warnings),
            "warnings": warnings,
            "videos_touched": created + updated,
            "hooks_reindexed_videos": len(unique_dirty),
            "catalog_video_count": catalog_video_count,
            "sheet_rows": total_rows,
        }
        return result, summary

    def _title_embed_progress(self, progress: SyncProgressBridge):
        async def on_batch(done: int, total: int) -> None:
            await progress.stage(
                "analyzing_titles",
                processed=done,
                total=total,
            )

        return on_batch

    def _hook_progress(self, progress: SyncProgressBridge):
        async def on_progress(done: int, total: int, name: str) -> None:
            await progress.stage(
                "finding_hook_patterns",
                processed=done,
                total=total,
                current_entity_name=name,
            )

        return on_progress

    async def _fetch_transcript_safe(
        self,
        video: Video,
        warnings: list[dict[str, str]],
        progress: SyncProgressBridge | None,
    ) -> tuple[bool, bool]:
        """
        Fetch transcript with retries and timeout.

        Returns (saved, was_blocked).
        """
        last_exc: Exception | None = None
        for attempt in range(_TRANSCRIPT_MAX_RETRIES):
            try:
                saved = await asyncio.wait_for(
                    self._transcripts.fetch_transcript_for_video(video),
                    timeout=_TRANSCRIPT_FETCH_TIMEOUT,
                )
                return saved, False
            except (RequestBlocked, IpBlocked):
                return False, True
            except asyncio.TimeoutError:
                last_exc = asyncio.TimeoutError("transcript fetch timed out")
                if attempt < _TRANSCRIPT_MAX_RETRIES - 1:
                    await asyncio.sleep(2**attempt)
            except Exception as exc:
                last_exc = exc
                if attempt < _TRANSCRIPT_MAX_RETRIES - 1:
                    await asyncio.sleep(2**attempt)

        if last_exc:
            detail = f"{video.creator_name}: {str(last_exc)[:200]}"
            warnings.append({"code": "transcript", "detail": detail})
            if progress:
                await progress.warning("transcript", detail)
            logger.warning("Transcript fetch failed for video %s: %s", video.id, last_exc)
        return False, False

    async def _enrich_transcripts_resilient(
        self,
        progress: SyncProgressBridge | None,
        warnings: list[dict[str, str]],
    ) -> tuple[int, int, int, list[int]]:
        limit = self._settings.transcript_enrich_limit

        result = await self._db.execute(
            select(Video)
            .where(Video.transcript.is_(None))
            .where(
                (Video.video_url.isnot(None))
                | (Video.channel_url.isnot(None))
            )
            .limit(limit)
        )
        to_fetch = list(result.scalars().all())
        total = len(to_fetch)

        if progress:
            await progress.stage(
                "processing_transcripts",
                processed=0,
                total=total or None,
            )

        fetched = 0
        blocked_count = 0
        dirty_ids: list[int] = []
        for idx, video in enumerate(to_fetch):
            saved, was_blocked = await self._fetch_transcript_safe(
                video, warnings, progress
            )
            if saved:
                fetched += 1
                dirty_ids.append(video.id)
            if was_blocked:
                blocked_count += 1

            if progress:
                await progress.stage(
                    "processing_transcripts",
                    processed=idx + 1,
                    total=total,
                    current_entity_name=video.creator_name,
                )

        await self._db.commit()

        if progress:
            await progress.stage("processing_transcripts", processed=total, total=total)

        embedded = 0
        try:
            embedded = await self._embeddings.embed_transcripts_missing(
                on_batch=self._transcript_embed_progress(progress, total)
                if progress
                else None,
            )
        except Exception as exc:
            detail = f"Transcript analysis step: {str(exc)[:200]}"
            warnings.append({"code": "transcript_embed", "detail": detail})
            if progress:
                await progress.warning("transcript_embed", detail)
            logger.exception("Transcript embedding batch failed")

        return fetched, embedded, blocked_count, dirty_ids

    def _transcript_embed_progress(self, progress: SyncProgressBridge, base: int):
        async def on_batch(done: int, total: int) -> None:
            await progress.stage(
                "processing_transcripts",
                processed=base + done,
                total=base + total if total else None,
            )

        return on_batch

    async def _enrich_comments_resilient(
        self,
        progress: SyncProgressBridge | None,
        warnings: list[dict[str, str]],
    ) -> int:
        comments_svc = CommentsService(self._db)
        if not comments_svc.is_available:
            return 0

        limit = self._settings.comments_enrich_limit
        videos = await comments_svc.list_videos_without_comments(limit)

        if progress:
            await progress.stage(
                "syncing_comments",
                processed=0,
                total=len(videos) or None,
            )

        total = 0
        for idx, video in enumerate(videos):
            try:
                total += await comments_svc.fetch_for_video(video)
            except Exception as exc:
                detail = f"{video.creator_name}: {str(exc)[:200]}"
                warnings.append({"code": "comments", "detail": detail})
                if progress:
                    await progress.warning("comments", detail)
                logger.warning("Comments fetch failed for video %s: %s", video.id, exc)

            if progress:
                await progress.stage(
                    "syncing_comments",
                    processed=idx + 1,
                    total=len(videos),
                    current_entity_name=video.creator_name,
                )

        await self._db.commit()
        return total

    async def _find_existing(
        self,
        creator_name: str,
        title: str,
        published_at: datetime | None,
        video_url: str = "",
    ) -> Video | None:
        yt_id = TranscriptService.extract_video_id(video_url or "")
        if yt_id and len(yt_id) == 11:
            pattern = f"%{yt_id}%"
            by_id = await self._db.execute(
                select(Video).where(
                    (Video.video_url.ilike(pattern))
                    | (Video.channel_url.ilike(pattern))
                )
            )
            id_rows = list(by_id.scalars().all())
            if id_rows:
                return _pick_existing_row(id_rows, title=title, published_at=published_at)

        by_title = await self._db.execute(
            select(Video)
            .where(Video.creator_name == creator_name, Video.title == title)
            .order_by(Video.id.asc())
        )
        rows = list(by_title.scalars().all())
        if not rows:
            return None
        return _pick_existing_row(rows, title=title, published_at=published_at)

    @staticmethod
    def _parse_date(raw: str) -> datetime | None:
        if not raw:
            return None
        for fmt in (
            "%Y-%m-%d",
            "%d.%m.%Y",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%b %d, %Y",
        ):
            try:
                return datetime.strptime(raw.strip(), fmt)
            except ValueError:
                continue
        return None
