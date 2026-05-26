# Sheets Sync — Polish Pass

Product-focused UX and resilience improvements on top of Phase 1 (`sync_runs`, polling, floating panel). No Celery, Redis, or WebSockets.

## UX improvements

### Progress panel
- **Visual hierarchy:** mode badge (Quick / Full), stage stepper with icons, animated progress bar, elapsed timer + “stages remaining”
- **Success state:** “Workspace synced successfully” hero with stat rows (videos, transcripts, discussions, duration)
- **Failure state:** human headline + short message (not raw stack traces in UI)
- **Long-run hints:** after 5 minutes, contextual copy for transcript-heavy syncs
- **Warnings:** collapsed by default; expandable groups; blocked transcripts use a single friendly summary
- **Mobile:** full-width bottom sheet on small screens; centered pill; truncated creator names
- **States:** starting, reconnecting after reload, already-running (409)

### Last sync visibility
- `GET /api/v1/sheets/sync/runs/last` → badges on **Dashboard** (compact) and **Settings** (full chips)
- Relative time via `Intl.RelativeTimeFormat` (en / uk)

### Sync modes

| Mode | Backend `sync_runs.mode` | Pipeline |
|------|--------------------------|----------|
| **Quick** (primary) | `quick` | Sheets → save videos → title embeddings → incremental hooks → finalize |
| **Full** (secondary) | `full` | Quick path + transcripts + comments + incremental hooks |

UI: **Quick sync** primary button; **Full sync** outline + short explanation dropdown.

## API changes

```http
POST /api/v1/sheets/sync
Content-Type: application/json
{ "mode": "quick" | "full" }
→ 202 { run_id, status, mode }

GET /api/v1/sheets/sync/runs/last
→ LastSyncStatus | null
```

Migration **016**: `sync_runs.mode` column (default `full` for existing rows).

## Transcript resilience

- Per-video **timeout** (25s) and **3 retries** with exponential backoff for transient errors
- `RequestBlocked` / `IpBlocked`: no per-video spam; counts toward grouped warning
- Completion message: *“Some transcripts could not be processed right now.”*
- Transcript failures **never** fail the whole sync run

## Incremental hook indexing (decision)

**Previous behavior:** `DELETE FROM hook_patterns` + full catalog rebuild every sync (expensive on 12k+ videos).

**New behavior (`HookIndexService.rebuild_index`):**
1. Track **hook-dirty** video IDs: created rows, title changes, sheet transcript changes, newly fetched transcripts (full sync only)
2. Delete patterns only for those `video_id`s, re-extract hooks
3. Full rebuild when: no patterns exist yet, or dirty set is >80% of catalog (cheaper than huge `IN` clause)

**Not done (honest limits):**
- No persistent `hook_dirty` column on `videos` — dirty set is computed per run only
- Metadata-only updates (views/subscribers) skip hook reindex
- Manual “Rebuild hooks” API still does full rebuild when called without IDs

## Screenshots (capture after deploy)

1. Dashboard — Quick sync + last-sync compact line  
2. Progress panel — stage stepper mid-run  
3. Success hero with stats  
4. Collapsed warnings expanded  
5. Mobile (~375px) — panel + pill  
6. Settings — last sync chips + Connect & Sync (full mode)

## QA checklist

| Test | Expected |
|------|----------|
| Quick sync | Finishes faster; no transcript/comment stages in stepper |
| Full sync | All stages; transcripts/comments when configured |
| Reload during sync | Reconnecting copy; polling resumes |
| Close / reopen panel | Pill on mobile/desktop |
| Transcript blocked | Grouped warning; status `completed` |
| Concurrent start | 409 + friendly message |
| Long run (>5m) | Patience hint visible |
| Last sync badge | Updates after completion |

## Remaining limitations

- Background tasks are still **in-process** (API restart can strand `running`)
- Quick sync still re-embeds all missing **titles** (by design — lightweight intelligence)
- No cancel button
- Full sync transcript limit still capped by `transcript_enrich_limit` / `comments_enrich_limit` in config

## Future ideas

- Stale-run sweeper + “Cancel sync”
- `videos.hook_dirty_at` for cross-run incremental without rescanning sheet
- Dashboard “last full sync” vs “last quick sync” separately
- Optional transcript queue with longer backoff when IP blocked
