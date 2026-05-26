# Historical Analytics Architecture (Phase 3 MVP)

Time-series layer on top of the synced catalog: daily snapshots → growth / velocity / breakout metrics. No LangGraph changes, no queues.

## Scheduler design

**APScheduler** (`AsyncIOScheduler`) runs inside the FastAPI process:

| Setting | Default | Purpose |
|---------|---------|---------|
| `STATS_SCHEDULER_ENABLED` | `true` | Enable daily cron |
| `STATS_SNAPSHOT_HOUR_UTC` | `3` | Run hour (UTC) |
| `STATS_SNAPSHOT_MINUTE_UTC` | `15` | Run minute |
| `STATS_RUN_ON_STARTUP` | `false` | Optional snapshot on boot (QA) |

- Job id: `daily_stats_snapshot`
- `max_instances=1`, `coalesce=True` — safe across Docker restarts (no duplicate concurrent runs)
- Shutdown on app lifespan exit

**Manual run (QA / backfill):**

```http
POST /api/v1/analytics/snapshots/run
```

## Snapshot strategy

### Data source (MVP)

**Priority 1 only:** current `videos` + `comments` tables after Sheets sync.

- No yt-dlp, no headless browser, no quota-heavy YouTube API in the cron path
- Optional future: lightweight metadata refresh before snapshot

### Creator snapshot (`creator_stats_history`)

Per `creator_name` per calendar day (`snapshot_date`):

| Field | Source |
|-------|--------|
| `subscribers_count` | `max(subscribers_count)` across creator’s videos |
| `total_views` | `sum(views_count)` |
| `total_videos` | `count(*)` |
| `youtube_channel_id` | parsed from `channel_url` (`@handle` or `/channel/UC…`) |

### Video snapshot (`video_stats_history`)

Per `video_id` per day:

| Field | Source |
|-------|--------|
| `views_count` | `videos.views_count` |
| `likes_count` | `0` (MVP placeholder) |
| `comments_count` | `count(comments)` for video |

### Idempotency

PostgreSQL `UNIQUE (creator_name, snapshot_date)` and `UNIQUE (video_id, snapshot_date)` with `INSERT … ON CONFLICT DO UPDATE` — rerunning the same day **updates** rows, no duplicates.

## Growth formulas (deterministic)

Let `latest` = max `snapshot_date`, `day_7` = latest − 7 days.

**Creator**

- `subscribers_delta_7d` = subs(latest) − subs(day_7)
- `growth_7d_pct` = `100 * delta / past` (100% if past = 0 and current > 0)
- `velocity_views_per_day` = `(total_views(latest) − total_views(day_7)) / 7`

**Video breakout**

- `views_delta_7d`, `growth_7d_pct` same pattern on `views_count`
- `breakout_score` = `growth_7d_pct * (max(delta_7d, 1) ** 0.25)` — favors % + absolute lift

**Velocity endpoint**

- Sorted by `velocity_views_per_day` from breakout candidates

Requires **≥ 2 snapshot days** for non-zero deltas; after 7–30 days, 7d/30d trends become meaningful.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/creators/growth` | Top creators by 7d subscriber growth |
| GET | `/analytics/videos/breakouts` | Top breakout videos by score |
| GET | `/analytics/velocity` | Top views/day velocity |
| POST | `/analytics/snapshots/run` | Manual daily capture |

## UI integration (minimal)

- **Analytics page:** `GrowthTrends` section (3 cards)
- **Feed:** up to 3 cards from growth/breakout when snapshots exist

No dashboard redesign.

## Limitations

| Limitation | Notes |
|------------|--------|
| Catalog is point-in-time | Snapshots reflect Sheets sync, not live YouTube |
| Same-day reruns overwrite | By design |
| Likes not tracked | `likes_count` = 0 until enriched |
| Short history | 7d/30d need accumulated days |
| Subscriber per row | Uses max subs across videos per creator |

## Future improvements

- Optional yt-dlp / API refresh before snapshot (bounded batch)
- `likes_count` from metadata
- Channel-level total views from YouTube (not sum of catalog videos)
- Charts: sparklines per creator on `/creators/[name]`
- Alert thresholds (webhook) without Kafka

## Files

- Models: `app/models/creator_stats_history.py`, `video_stats_history.py`
- Migration: `alembic/versions/010_create_stats_history.py`
- Services: `creator_stats_service.py`, `video_stats_service.py`, `growth_analytics_service.py`, `snapshot_runner.py`, `snapshot_scheduler.py`
