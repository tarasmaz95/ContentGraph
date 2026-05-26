# Snapshot Monitoring (Internal)

Lightweight observability for the daily historical analytics cron — **not** a scheduler admin UI.

---

## Purpose

Give the 2–3 person team:

- Last run status (success / failed)
- Counts and duration
- Next expected cron time
- Last 5 runs (preview table)
- **Run snapshot now** button

Without: cron editing, queues, retries UI, or DevOps dashboards.

---

## Architecture

```
APScheduler (in FastAPI process)
        ↓
run_daily_snapshots(source=scheduled|manual)
        ↓
creator_stats_history + video_stats_history  (upsert today)
        ↓
snapshot_runs row (log)
        ↓
Settings UI ← GET status / history
```

### Data flow (unchanged)

```
Google Sheets sync
        ↓
videos (+ comments) in Postgres
        ↓
daily snapshot (03:15 UTC or manual)
        ↓
history tables
        ↓
growth analytics
```

---

## Database: `snapshot_runs`

| Column | Type | Notes |
|--------|------|-------|
| id | int | PK |
| started_at | timestamptz | Run start |
| finished_at | timestamptz | Run end |
| status | string | `success` \| `failed` |
| creators_saved | int | |
| videos_saved | int | |
| duration_ms | int | Wall time |
| error_message | text | Only on failure |
| source | string | `manual` \| `scheduled` |

Migration: `013_create_snapshot_runs.py`

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/analytics/snapshots/status` | Latest run + next scheduled time |
| GET | `/api/v1/analytics/snapshots/history?limit=5` | Recent runs |
| POST | `/api/v1/analytics/snapshots/run` | Manual trigger |

### Next scheduled run

Computed from env (`STATS_SNAPSHOT_HOUR_UTC`, `STATS_SNAPSHOT_MINUTE_UTC`), not from live APScheduler job store:

- If scheduler disabled → `next_scheduled_at: null`
- Else → next occurrence of that clock time in UTC (today or tomorrow)

### Status when no runs

All `last_*` fields null; UI shows “No runs yet”.

---

## Scheduler integration

`snapshot_runner.run_daily_snapshots`:

1. Captures stats (existing logic)
2. On success: commit snapshots, then log `success` row
3. On failure: rollback snapshot work, log `failed` row with `error_message`, re-raise

Scheduled job passes `source="scheduled"`; manual POST uses `source="manual"`.

---

## Settings UI

**Settings → Historical analytics** card includes:

1. **Snapshot status** — grid of fields + green/red dot
2. **Run snapshot now** — POST + toast + refresh
3. **History table** — last 5 runs
4. Existing explainer text + flow diagram

---

## Limitations (intentional)

| Not included | Why |
|--------------|-----|
| Edit cron schedule in UI | Use `.env` only |
| Retry / dead-letter queues | Internal tool scale |
| Full log explorer | 5-row preview enough |
| Live APScheduler job list | Computed next run is enough |
| Per-step breakdown | Single atomic job |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Status empty | Run manual snapshot once |
| `failed` + error text | DB down, migration missing, snapshot SQL error |
| Next run null | `STATS_SCHEDULER_ENABLED=false` |
| History not updating | Backend not redeployed with migration 013 |

```bash
curl -sS https://tm1.website/api/v1/analytics/snapshots/status | jq
curl -sS -X POST https://tm1.website/api/v1/analytics/snapshots/run | jq
curl -sS 'https://tm1.website/api/v1/analytics/snapshots/history?limit=5' | jq
```

---

## Related docs

- [HISTORICAL_ANALYTICS_USER_GUIDE.md](./HISTORICAL_ANALYTICS_USER_GUIDE.md)
- [HISTORICAL_ANALYTICS_ARCHITECTURE.md](./HISTORICAL_ANALYTICS_ARCHITECTURE.md)
