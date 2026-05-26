"""Shared helpers — normalize VideoRead / VideoSnapshot for analytics."""

from collections import defaultdict
from statistics import median

from app.schemas.analytics import AnalyticsMetrics, ChartPoint, CreatorStat, KeywordStat
from app.schemas.video_snapshot import VideoSnapshot
from app.schemas.video import VideoRead
from app.services.analytics.pattern_detection import (
    extract_title_features,
    length_bucket,
)
from app.services.analytics.token_sanitize import extract_title_tokens

# Type alias: anything with title + views + creator
VideoLike = VideoRead | VideoSnapshot


def get_title(video: VideoLike) -> str:
    return video["title"] if isinstance(video, dict) else video.title


def get_views(video: VideoLike) -> int:
    return video["views_count"] if isinstance(video, dict) else video.views_count


def get_creator(video: VideoLike) -> str:
    return video["creator_name"] if isinstance(video, dict) else video.creator_name


def compute_base_metrics(videos: list[VideoLike]) -> AnalyticsMetrics:
    """Aggregate views and title-feature percentages across a video set."""
    if not videos:
        return AnalyticsMetrics()

    views = [get_views(v) for v in videos]
    features = [extract_title_features(get_title(v)) for v in videos]
    n = len(videos)

    return AnalyticsMetrics(
        total_videos=n,
        avg_views=round(sum(views) / n, 1),
        median_views=float(median(views)),
        max_views=max(views),
        avg_title_length=round(sum(f.length for f in features) / n, 1),
        titles_with_numbers_pct=round(100 * sum(1 for f in features if f.has_numbers) / n, 1),
        how_to_titles_pct=round(100 * sum(1 for f in features if f.has_how_to) / n, 1),
        curiosity_titles_pct=round(
            100 * sum(1 for f in features if f.curiosity_tags) / n, 1
        ),
        emotional_titles_pct=round(
            100 * sum(1 for f in features if f.emotional_words) / n, 1
        ),
    )


def keyword_stats_from_titles(videos: list[VideoLike], top_n: int = 15) -> list[KeywordStat]:
    """Count meaningful words in titles and average views per keyword."""
    counts: dict[str, list[int]] = defaultdict(list)

    for video in videos:
        title = get_title(video)
        views = get_views(video)
        for word in set(extract_title_tokens(title)):
            counts[word].append(views)

    stats = [
        KeywordStat(
            keyword=k,
            count=len(vs),
            avg_views=round(sum(vs) / len(vs), 1),
        )
        for k, vs in counts.items()
    ]
    stats.sort(key=lambda s: s.avg_views, reverse=True)
    return stats[:top_n]


def creator_stats(videos: list[VideoLike], top_n: int = 10) -> list[CreatorStat]:
    """Per-creator aggregates sorted by total views."""
    buckets: dict[str, list[int]] = defaultdict(list)
    for video in videos:
        buckets[get_creator(video)].append(get_views(video))

    stats = [
        CreatorStat(
            creator_name=name,
            video_count=len(vs),
            total_views=sum(vs),
            avg_views=round(sum(vs) / len(vs), 1),
        )
        for name, vs in buckets.items()
    ]
    stats.sort(key=lambda s: s.total_views, reverse=True)
    return stats[:top_n]


def views_distribution_chart(videos: list[VideoLike]) -> list[ChartPoint]:
    """Bucket videos by view count ranges."""
    buckets = {"0-10K": [], "10K-100K": [], "100K-1M": [], "1M+": []}
    for video in videos:
        v = get_views(video)
        if v < 10_000:
            buckets["0-10K"].append(v)
        elif v < 100_000:
            buckets["10K-100K"].append(v)
        elif v < 1_000_000:
            buckets["100K-1M"].append(v)
        else:
            buckets["1M+"].append(v)

    return [
        ChartPoint(label=label, value=float(len(vals)), count=len(vals))
        for label, vals in buckets.items()
    ]


def title_length_vs_views_chart(videos: list[VideoLike]) -> list[ChartPoint]:
    """Average views per title length bucket."""
    buckets: dict[str, list[int]] = defaultdict(list)
    for video in videos:
        feat = extract_title_features(get_title(video))
        buckets[length_bucket(feat.length)].append(get_views(video))

    order = ["short (<40)", "medium (40-69)", "long (70+)"]
    return [
        ChartPoint(
            label=label,
            value=round(sum(buckets[label]) / len(buckets[label]), 1) if buckets[label] else 0,
            count=len(buckets[label]),
        )
        for label in order
        if label in buckets
    ]
