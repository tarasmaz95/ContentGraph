# Intelligence Coverage & Health — Architecture

Operational observability for the ContentGraph intelligence graph. **Deterministic SQL only** — no LLM, no Redis, no background workers.

## Route

| Layer | Path |
|-------|------|
| API | `GET /api/v1/intelligence/health` |
| UI | `/intelligence/health` |

## Service layout

```
GET /intelligence/health
        ↓
IntelligenceHealthService.get_health()
        ├── Overview (catalog counts, coverage %)
        ├── DataFreshnessSection (staleness windows + severity)
        ├── CreatorCoverageSection (per-creator table, top 100)
        ├── TranscriptHealthSection
        ├── CommentHealthSection
        ├── SnapshotHealthSection (snapshot_runs + view-delta probe)
        ├── build_health_warnings()  ← deterministic rules
        └── build_system_status()    ← threshold headline
```

| Module | Role |
|--------|------|
| `intelligence_health_service.py` | SQL aggregation |
| `intelligence_health_warnings.py` | Warning + status copy |
| `schemas/intelligence_health.py` | Pydantic response |
| `api/v1/intelligence.py` | HTTP router |

## Data sources (Postgres)

| Metric | Tables / columns |
|--------|------------------|
| Videos, transcripts, embeddings | `videos` (`transcript`, `transcript_embedding`, `title_embedding`, `created_at`, `published_at`) |
| Comments | `comments` (`video_id`, `sentiment`, `emotional_tags`, `created_at`) |
| Hooks | `hook_patterns` (count) |
| Snapshots | `video_stats_history`, `snapshot_runs`, `creator_stats_history` |
| Last sync proxy | `app_settings.updated_at` (updated on settings save + Sheets config) |
| Creator staleness | `creator_profiles.updated_at` |

## Key formulas

```text
transcript_coverage_pct = 100 * COUNT(videos WHERE transcript IS NOT NULL AND != '') / total_videos
comment_coverage_pct    = 100 * COUNT(DISTINCT comment.video_id) / total_videos
embedding_coverage_pct  = 100 * COUNT(videos WHERE transcript_embedding IS NOT NULL) / total_videos

videos_with_view_changes = COUNT(video_id GROUP BY HAVING COUNT(DISTINCT views_count) > 1)
  FROM video_stats_history

hook_types_eligible = types with count>=3, count<=median(hook_type counts), avg_views>=1.2*global_avg
```

## Freshness severity (UI colors)

| Metric | Green | Amber | Red |
|--------|-------|-------|-----|
| Published >7d ago | ≤50% catalog | ≤85% | >85% |
| Creator profiles stale >30d | ≤5 | ≤20 | >20 |

## System status levels

| Level | Typical triggers |
|-------|------------------|
| `critical` | ≥2 critical warnings OR transcript &lt;0.5% |
| `degraded` | ≥1 critical OR ≥3 warnings |
| `partial` | ≥1 warning OR transcript &lt;5% |
| `healthy` | Otherwise |

## Transcript source tracking

**Not stored in DB.** All transcripts are reported under `source: unknown` with an explicit note. Ingest paths:

- `POST /transcripts/ingest` (Chrome extension)
- Sheets sync `enrich_missing()` (server-side fetch)

## Snapshot manual run

Reuses `POST /api/v1/analytics/snapshots/run` from the health page (same as Settings).

## Related docs

- `SNAPSHOT_MONITORING.md` — cron and `snapshot_runs`
- `FEED_MOMENTUM_QA.md` — momentum layer truth
- `FEED_INTELLIGENCE_AUDIT.md` — feed signal sources
