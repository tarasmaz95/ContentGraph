"""Sheets sync must not duplicate when published_at is backfilled."""

from datetime import datetime

from google_sheets.sync_service import _pick_existing_row

from app.models.video import Video


def _video(
    vid: int,
    *,
    video_url: str = "",
    published_at: datetime | None = None,
    title: str = "Same Title",
) -> Video:
    v = Video(
        creator_name="Test",
        channel_url="https://youtube.com/@x/videos",
        video_url=video_url,
        subscribers_count=0,
        title=title,
        views_count=0,
        published_at=published_at,
    )
    v.id = vid
    return v


def test_pick_legacy_stub_without_date() -> None:
    legacy = _video(1, published_at=None, video_url="")
    newer = _video(2, published_at=datetime(2025, 5, 19), video_url="https://youtu.be/abc12345678")
    picked = _pick_existing_row(
        [newer, legacy],
        title="Same Title",
        published_at=datetime(2025, 5, 19),
    )
    assert picked.id == 1


def test_pick_empty_video_url_stub_first() -> None:
    legacy = _video(10, video_url="")
    filled = _video(11, video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    picked = _pick_existing_row(
        [filled, legacy],
        title="Same Title",
        published_at=None,
    )
    assert picked.id == 10
