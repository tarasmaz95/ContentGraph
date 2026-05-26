# Creator Intelligence — Architecture (Phase 4 MVP)

## Goal

Turn `/creators/[name]` into a **creator intelligence dashboard** using existing synced data, history snapshots, hook analytics, and saved comments — without LangGraph changes, new queues, or vector clustering infrastructure.

## Page structure

| Section | Source |
|---------|--------|
| Overview | `CreatorIntelligence.overview` + `growth` |
| Growth charts | `creator_stats_history` via `growth` |
| Momentum & videos | `momentum` (breakouts, fastest growing, latest) |
| Hook intelligence | `hooks` (mix % + best patterns) |
| Audience | `audience` (deterministic comment aggregation) |
| Semantic identity | `semantic` (title tokens + nearest creators) |
| Catalog / AI profile | Existing `fetchCreatorAnalytics`, `fetchCreatorProfile` |

Route: `frontend/app/creators/[name]/page.tsx`

## APIs[text](vscode-file://vscode-app/Applications/Cursor.app/Contents/Resources/app/out/vs/code/electron-sandbox/workbench/docs/CREATOR_INTELLIGENCE_ARCHITECTURE.md)

All under `GET /api/v1/creators/{creator_name}/…` (name URL-encoded).

| Endpoint | Returns |
|----------|---------|
| `/intelligence` | Full `CreatorIntelligence` payload |
| `/growth` | Overview + `series` + `momentum` |
| `/hooks` | Mix percentages + best hooks + top titles |
| `/audience` | Phrases, emotions, pain points, top comments |

Existing endpoints unchanged: `/analytics`, `/semantic-search`, profile generation.

### Service

`app/services/creator_intelligence/creator_intelligence_service.py`

- **Growth**: reads `creator_stats_history`; falls back to `GrowthAnalyticsService` for 7d % when history has &lt;2 points.
- **Hooks**: `HookAnalyticsService` + regex mix on creator titles (same families as catalog hook analytics).
- **Audience**: `AudienceIntelligenceService._aggregate()` over `comments` joined to creator’s videos.
- **Semantic**: `keyword_stats_from_titles` + Jaccard-style token overlap vs other creators (top 5).
- **Momentum**: creator-filtered breakouts from `GrowthAnalyticsService.list_video_breakouts`, fastest growing from `video_stats_history`, latest uploads from `videos` table.

## Analytics sources

| Table / service | Use |
|-----------------|-----|
| `creator_stats_history` | Subscriber/views/video count time series |
| `video_stats_history` | Per-video 7d view delta (fastest growing) |
| `videos` | Overview totals, titles, top by views |
| `comments` | Audience aggregation |
| `GrowthAnalyticsService` | Breakouts, velocity when history thin |
| `HookAnalyticsService` | Pattern counts and performance |

## Growth calculations

- **7d subscriber growth %**: `(subs_end - subs_start) / subs_start * 100` from history rows in window, or global growth API fallback.
- **Velocity**: total views delta over 7d / 7 (views per day).
- **Momentum label**: `accelerating` if subs growth % &gt; 2; `slowing` if &lt; -2; else `steady`.

Charts use **recharts** (`AreaChart`) with at most ~90 history points.

## Limitations (MVP)

- **History**: needs ≥2 daily snapshot days for non-zero growth charts; first day after deploy shows flat/zero deltas.
- **Semantic positioning**: title token overlap only — not embedding clustering or topic models.
- **Audience**: only extension-ingested comments; no live YouTube fetch on page load.
- **Breakouts**: heuristic view delta vs catalog median; creator filter applied in intelligence service.
- **Subscribers on overview**: from latest video row in DB, not live YouTube API.

## Future evolution

- Second chart axis / video-level sparklines per upload
- Embedding-based “nearest creators” when semantic index exists per channel
- Feed cards linking to `/creators/{name}` with growth badge
- Compare mode embedding creator intelligence side-by-side
- LLM summary block optional (reuse profile generator, not required for MVP)

## Verification

1. `GET /api/v1/creators/Dan%20Martell/intelligence` → 200 JSON
2. Open `/creators/Dan%20Martell` — sections render, loading states
3. After `POST /api/v1/analytics/snapshots/run`, growth series non-empty
4. Hook mix % cards render; `best_performing_hooks` populated from title analysis
5. Creator with saved comments shows audience block; without → empty message (no crash)
6. Mobile: single column stack (Tailwind `lg:` breakpoints)
7. Growth % matches `creator_stats_history` when ≥2 snapshot days exist

```bash
curl -sS "http://127.0.0.1:8001/api/v1/creators/Dan%20Martell/intelligence" | jq '.overview.creator_name, .growth.metrics, .hooks.mix'
```

Feed growth cards already link to `/creators/{creator_name}` (`feed_service._growth_signals`).
