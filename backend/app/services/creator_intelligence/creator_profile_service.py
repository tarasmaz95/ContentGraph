"""Creator profile persistence and video aggregation."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.creator_profile import CreatorProfile
from app.models.video import Video
from app.schemas.creator import CreatorListItem, CreatorProfileRead
from app.schemas.video import VideoRead
from app.services.video_helpers import video_to_read


class CreatorProfileService:
    """Load/save creator profiles and fetch all videos per creator."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_creators(self) -> list[CreatorListItem]:
        """List unique creators from videos with basic stats + profile flag."""
        stmt = (
            select(
                Video.creator_name,
                func.count(Video.id).label("video_count"),
                func.avg(Video.views_count).label("avg_views"),
                func.sum(Video.views_count).label("total_views"),
            )
            .group_by(Video.creator_name)
            .order_by(func.sum(Video.views_count).desc())
        )
        result = await self._db.execute(stmt)
        rows = result.all()

        profiles = await self._all_profiles_by_name()
        items: list[CreatorListItem] = []
        for row in rows:
            profile = profiles.get(row.creator_name)
            items.append(
                CreatorListItem(
                    creator_name=row.creator_name,
                    total_videos=int(row.video_count),
                    avg_views=round(float(row.avg_views or 0), 1),
                    has_profile=profile is not None,
                    creator_summary=profile.creator_summary if profile else "",
                )
            )
        return items

    async def get_profile(self, creator_name: str) -> CreatorProfileRead | None:
        """Fetch stored profile by creator name (case-insensitive)."""
        profile = await self._find_profile(creator_name)
        if profile is None:
            return None
        return self._to_read(profile)

    async def upsert_profile(self, data: CreatorProfileRead) -> CreatorProfileRead:
        """Save or update AI-generated profile."""
        existing = await self._find_profile(data.creator_name)
        if existing is None:
            row = CreatorProfile(
                creator_name=data.creator_name,
                content_style=data.content_style,
                top_topics=data.top_topics,
                hook_patterns=data.hook_patterns,
                communication_style=data.communication_style,
                emotional_triggers=data.emotional_triggers,
                audience_type=data.audience_type,
                creator_summary=data.creator_summary,
                avg_views=data.avg_views,
                total_videos=data.total_videos,
                total_views=data.total_views,
            )
            self._db.add(row)
        else:
            existing.content_style = data.content_style
            existing.top_topics = data.top_topics
            existing.hook_patterns = data.hook_patterns
            existing.communication_style = data.communication_style
            existing.emotional_triggers = data.emotional_triggers
            existing.audience_type = data.audience_type
            existing.creator_summary = data.creator_summary
            existing.avg_views = data.avg_views
            existing.total_videos = data.total_videos
            existing.total_views = data.total_views

        await self._db.commit()
        refreshed = await self._find_profile(data.creator_name)
        return self._to_read(refreshed)  # type: ignore[arg-type]

    async def get_videos_for_creator(
        self,
        creator_name: str,
        limit: int = 60,
    ) -> list[VideoRead]:
        """All videos for one creator — used by intelligence generation."""
        pattern = f"%{creator_name}%"
        stmt = (
            select(Video)
            .where(Video.creator_name.ilike(pattern))
            .order_by(Video.views_count.desc())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return [video_to_read(v) for v in result.scalars().all()]

    async def get_videos_for_creators(
        self,
        creator_names: list[str],
        limit_per: int = 40,
    ) -> list[VideoRead]:
        """Aggregate videos for multiple creators (comparison / multi-creator chat)."""
        collected: list[VideoRead] = []
        seen: set[int] = set()
        for name in creator_names:
            for video in await self.get_videos_for_creator(name, limit=limit_per):
                if video.id not in seen:
                    seen.add(video.id)
                    collected.append(video)
        return collected

    async def compute_stats(self, creator_name: str) -> tuple[int, float, int]:
        """Returns (total_videos, avg_views, total_views) from video table."""
        stmt = (
            select(
                func.count(Video.id),
                func.avg(Video.views_count),
                func.sum(Video.views_count),
            )
            .where(Video.creator_name.ilike(f"%{creator_name}%"))
        )
        row = (await self._db.execute(stmt)).one()
        return (
            int(row[0] or 0),
            round(float(row[1] or 0), 1),
            int(row[2] or 0),
        )

    async def _find_profile(self, creator_name: str) -> CreatorProfile | None:
        stmt = select(CreatorProfile).where(
            CreatorProfile.creator_name.ilike(creator_name.strip())
        )
        return (await self._db.execute(stmt)).scalar_one_or_none()

    async def _all_profiles_by_name(self) -> dict[str, CreatorProfile]:
        result = await self._db.execute(select(CreatorProfile))
        return {p.creator_name: p for p in result.scalars().all()}

    @staticmethod
    def _to_read(profile: CreatorProfile) -> CreatorProfileRead:
        return CreatorProfileRead(
            creator_name=profile.creator_name,
            content_style=profile.content_style or "",
            top_topics=list(profile.top_topics or []),
            hook_patterns=list(profile.hook_patterns or []),
            communication_style=profile.communication_style or "",
            emotional_triggers=list(profile.emotional_triggers or []),
            audience_type=profile.audience_type or "",
            creator_summary=profile.creator_summary or "",
            avg_views=profile.avg_views,
            total_videos=profile.total_videos,
            total_views=profile.total_views,
            updated_at=profile.updated_at,
        )
