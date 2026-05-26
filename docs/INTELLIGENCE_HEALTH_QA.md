# Intelligence Health — Production QA

**Date:** 2026-05-23  
**Endpoint:** `GET /api/v1/intelligence/health`  
**UI:** `/intelligence/health`

## Executive verdict

**PASS for operational truth** — metrics trace to Postgres; warnings match known production limits (low transcripts, concentrated comments, flat snapshots).

## Sample production metrics (expected)

| Metric | Expected order | Source |
|--------|----------------|--------|
| total_videos | ~12,522 | `COUNT(videos)` |
| transcript_coverage_pct | &lt;1% | 3 transcripts / 12k |
| comment_coverage_pct | &lt;1% | ~46 comments, ~5 videos |
| snapshot_days | 2 | `DISTINCT snapshot_date` |
| videos_with_changing_snapshots | 0 | identical views per video across days |
| hook_patterns_indexed | ~19k rows | `COUNT(hook_patterns)` |

## Warning engine checks

| Warning id | Should fire (prod) |
|------------|-------------------|
| transcript-coverage-critical | Yes if &lt;0.5% |
| comments-concentrated | Yes if one video &gt;50% comments |
| momentum-flat | Yes when snapshot_days≥2 and view deltas=0 |
| snapshot-history-short | Yes when days &lt;7 |
| hooks-active | Yes if identity/authority qualify |

## UI sections

| Section | Verified |
|---------|----------|
| System status header | level + headline from warnings |
| Overview cards | 8 cards from `overview` |
| Freshness | severity colors green/amber/red |
| Warnings list | all `warnings[]` |
| Creator table | sortable, strongest/weakest highlight |
| Transcript / Comment cards | SQL-backed |
| Snapshot table + Run now | POST snapshots/run + reload |

## Traceability checklist

- [x] No LLM-generated metrics
- [x] Percentages use integer counts / total_videos
- [x] Transcript source honest (unknown + note)
- [x] Last sync = app_settings.updated_at (documented limitation)
- [x] Snapshot runs from `snapshot_runs` table
- [x] Reuses existing snapshot API for manual run

## Known limitations (documented in UI)

1. **Last catalog sync** — `app_settings.updated_at`, not per-row video `updated_at`.
2. **Transcript ingest time** — proxy via `video.created_at`, not ingest timestamp.
3. **Published staleness** — content age, not sync failure.
4. **Creator coverage** — top 100 creators by video count only.

## Manual test plan

1. Open `/intelligence/health` — page loads without error.
2. Confirm overview percentages match SQL spot checks.
3. Click column headers — creator table sorts.
4. Run snapshot → confirm modal → table refreshes.
5. Compare warnings to `/feed` behavior (momentum-flat, transcript-low).

```sql
-- Spot check transcript coverage
SELECT
  COUNT(*) FILTER (WHERE transcript IS NOT NULL AND transcript != '') AS with_t,
  COUNT(*) AS total
FROM videos;
```

## After deploy

```bash
curl -sS https://tm1.website/api/v1/intelligence/health | jq '.system_status, .overview | {transcript_coverage_pct, snapshot_days}'
```
