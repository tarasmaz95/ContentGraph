# Historical Analytics — QA Report

**Date:** 2026-05-21  
**Environment:** Docker backend + Postgres

## Summary

| Check | Verdict |
|-------|---------|
| Migration `010` | Run on deploy |
| `POST /analytics/snapshots/run` | **PASS** |
| Same-day idempotent upsert | **PASS** |
| Growth API routes | **PASS** |
| APScheduler startup | **PASS** (logs) |
| Feed growth cards | **PASS** when deltas > 0 |

## Verification commands

```bash
# Manual snapshot
curl -X POST http://127.0.0.1:8001/api/v1/analytics/snapshots/run

# DB counts
docker compose exec postgres psql -U contentgraph -d contentgraph -c \
  "SELECT snapshot_date, count(*) FROM creator_stats_history GROUP BY 1 ORDER BY 1;"
docker compose exec postgres psql -U contentgraph -d contentgraph -c \
  "SELECT snapshot_date, count(*) FROM video_stats_history GROUP BY 1 ORDER BY 1;"

# APIs
curl http://127.0.0.1:8001/api/v1/analytics/creators/growth?limit=5
curl http://127.0.0.1:8001/api/v1/analytics/videos/breakouts?limit=5
curl http://127.0.0.1:8001/api/v1/analytics/velocity?limit=5
```

## Docker logs

Look for:

```
stats_scheduler_started hour_utc=3 minute=15
creator_stats_snapshot day=… creators=…
video_stats_snapshot day=… videos=…
daily_snapshots_complete …
```

## Production deploy

1. `docker compose build backend && docker compose up -d backend`
2. Alembic upgrade runs on container start
3. Optional first snapshot: `POST https://tm1.website/api/v1/analytics/snapshots/run`
4. After 2–3 days, verify non-zero `growth_7d_pct` on `/analytics/creators/growth`

## pytest

```bash
docker compose exec backend pytest tests/test_growth_snapshots.py -q
```
