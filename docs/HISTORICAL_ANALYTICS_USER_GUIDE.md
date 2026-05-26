# Historical Analytics — User Guide (Internal)

Plain-language guide for the 2–3 person team. Matches the **Settings → Historical analytics** card in the app.

---

## What this is

ContentGraph can show **growth %**, **velocity**, and **breakout** metrics by saving a **daily snapshot** of your catalog — not by scraping YouTube live.

Snapshots live in:

- `creator_stats_history` — one row per creator per day  
- `video_stats_history` — one row per video per day  

Analytics pages read these tables and compare **today vs ~7 days ago**.

---

## How it works (cron)

| Piece | Detail |
|-------|--------|
| Scheduler | **APScheduler** inside the backend (same process as FastAPI) |
| Schedule | **Daily 03:15 UTC** (default; `STATS_SNAPSHOT_HOUR_UTC=3`, `STATS_SNAPSHOT_MINUTE_UTC=15`) |
| Job id | `daily_stats_snapshot` |
| Safety | `max_instances=1` — no overlapping runs after Docker restart |

Each run **upserts** rows for **today’s calendar date** (UTC). Running twice the same day **updates** rows; it does not duplicate.

---

## Data flow

```
Google Sheets sync
        ↓
videos (+ comments) updated in Postgres
        ↓
daily snapshot cron (03:15 UTC)
        ↓
creator_stats_history / video_stats_history
        ↓
growth analytics (Analytics page, Feed, Compare)
```

---

## What gets tracked

### Per creator (aggregated from catalog)

- `subscribers_count` — max across that creator’s videos  
- `total_views` — sum of `views_count`  
- `total_videos` — row count  
- `youtube_channel_id` — parsed from channel URL when possible  

### Per video

- `views_count` — from `videos` table  
- `comments_count` — count of rows in `comments` for that video  
- `likes_count` — placeholder `0` in MVP  

---

## Critical limitation (read this)

**The cron does not scrape YouTube.**

It does **not**:

- Open YouTube watch pages  
- Refresh your Google Sheet  
- Call YouTube Data API on a schedule  

It only copies **whatever is already in Postgres** after:

1. **Google Sheets sync** (Settings → Connect & Sync), and/or  
2. Manual catalog updates (extension transcripts/comments, etc.)

So the chain is:

**Sheets sync → `videos` updated → snapshot saves that state.**

If you never sync, snapshots still run but growth reflects **stale sheet data**, not live YouTube.

---

## Why growth shows 0%

Common reasons:

| Symptom | Cause |
|---------|--------|
| `growth_7d_pct = 0` everywhere | Only **one** snapshot day in DB — need ≥2 days for deltas |
| All metrics flat | Sheet not synced; views/subs unchanged between days |
| Breakout list empty | No 7d view delta yet |
| “Last snapshot” missing in Settings | Cron not run yet; DB empty |

**Fix:**  
1. Run Sheets sync so catalog is current.  
2. Optional: `POST /api/v1/analytics/snapshots/run` for today.  
3. Wait **several days** (cron or daily manual POST).  
4. Check **Analytics** growth section or `GET /api/v1/analytics/creators/growth`.

---

## Manual snapshot (QA / backfill)

```bash
curl -X POST https://tm1.website/api/v1/analytics/snapshots/run
# or local:
curl -X POST http://127.0.0.1:8001/api/v1/analytics/snapshots/run
```

Example response:

```json
{
  "snapshot_date": "2026-05-22",
  "creators_saved": 120,
  "videos_saved": 12522,
  "message": "Daily snapshots complete."
}
```

Use for:

- First day after deploy  
- Verifying cron logic  
- Same-day re-run (idempotent upsert)  

There are **no toggles** in Settings for cron — by design (internal tool, env-only).

---

## Where you see results

| Surface | What it uses |
|---------|----------------|
| **Analytics** page | Growth trends, breakouts, velocity |
| **Feed** | Growth / breakout cards when deltas exist |
| **Creator compare** | 7d growth when snapshots exist |
| **Settings** | Explainer card + last snapshot date |

---

## Troubleshooting checklist

1. **Synced recently?** Settings → Save & Sync.  
2. **Snapshots exist?** Settings card shows “Last snapshot date”.  
3. **At least 2 days?**  
   ```sql
   SELECT snapshot_date, count(*) FROM creator_stats_history GROUP BY 1 ORDER BY 1;
   ```  
4. **Cron enabled?** Backend logs: `stats_scheduler_started hour_utc=3 minute_15`.  
5. **Manual run OK?** POST `/analytics/snapshots/run` returns 200.  

---

## Related docs

- [HISTORICAL_ANALYTICS_ARCHITECTURE.md](./HISTORICAL_ANALYTICS_ARCHITECTURE.md) — technical design  
- [HISTORICAL_ANALYTICS_QA.md](./HISTORICAL_ANALYTICS_QA.md) — deploy/QA commands  

---

## Settings UI

Open **Settings** (under **More** in nav). Below **Connect Google Sheet**, the dashed **Historical analytics (snapshot cron)** card summarizes this guide and shows **Last snapshot date (UTC)** when the API has data.
