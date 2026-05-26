# Semantic Retrieval & Performance Hardening (Phase 7)

Stabilization pass: better semantic quality, faster compare, UX polish — no new product systems.

## 1. Hybrid semantic retrieval

**Before:** Fixed `SEMANTIC_MIN_SIMILARITY = 0.25`; blend `max(0.2·title + 0.3·transcript, title, transcript)`; transcript-only hits (e.g. ~19% similarity) often dropped.

**After** (`app/services/retrieval_scoring.py` + `retrieval_service.py`):

```
hybrid_score = 0.65 × title_sim + 0.35 × transcript_sim
```

- Transcript-only: use `transcript_sim` when `title_sim ≈ 0`
- Boost when `transcript_sim ≥ 0.85 × title_sim`

### Dynamic threshold

| Query length | Base min hybrid |
|--------------|-----------------|
| 1 token | 0.26 |
| 2–3 tokens | 0.22 |
| 4–5 tokens | 0.20 |
| 6+ tokens | 0.18 |

**Transcript rescue:** include if `transcript_sim ≥ 0.17` and beats title by >0.03, even below base threshold.

**Tail cleanup:** keep results ≥ 52% of top hybrid score (floor 0.16) to drop noisy distant tail.

### Match labels (API + UI)

`match_source`: `title` | `transcript` | `both` | `keyword` | `comment`

UI: “Matched in title”, “Matched in transcript”, “Title + transcript”.

## 2. Compare performance

### In-memory intelligence cache

- Module: `app/services/cache/intelligence_cache.py`
- TTL: **10 minutes**
- Keys: `intel:{creator}:lite` / `intel:{creator}:full`
- Invalidated on: Sheets sync, daily stats snapshot

### Parallel intelligence build

`CreatorIntelligenceService.get_intelligence` runs in parallel:

- `growth`, `hooks`, `semantic` (+ `audience`, `momentum` when not lite)

### Compare depth

`GET /compare?creator_a=&creator_b=&depth=`

| depth | Behavior |
|-------|----------|
| `core` | Lite intel (no audience, no nearest-creator scan, no momentum) — fast overview |
| `extended` | Audience + momentum only (merged client-side) |
| `full` | Legacy single call (lite=false path avoided; use core+extended in UI) |

**Frontend:** loads `core` first (skeleton → overview/hooks/growth), then `extended` in background with spinner on audience/breakout sections.

### Other optimizations

- Video breakouts fetch: limit 200 → **80**
- Nearest-creator loop skipped in **lite** mode

## 3. UX polish

- Compare: skeleton placeholders instead of blank flash
- Semantic results: clearer match labels (i18n EN/UK)
- Compare overview table: horizontal scroll on small screens
- Extended sections: inline loading spinner

## 4. Before / after (expected)

| Scenario | Before | After |
|----------|--------|-------|
| Transcript phrase ~19% sim | Often filtered | Included via rescue |
| Cold compare | ~9s | Core ~2–4s perceived; extended async |
| Repeat compare (cache) | ~9s | Sub-second core |
| Short query “ai” | Noisy tail possible | Stricter threshold |

*Run local timing after deploy; numbers depend on catalog size.*

## 5. Verification

```bash
# Unit tests
cd backend && pytest tests/test_retrieval_scoring.py -q

# Semantic search
curl "http://127.0.0.1:8001/api/v1/videos/semantic-search?q=comfort%20never%20changed%20anyway&limit=10"

# Compare core vs extended
curl "http://127.0.0.1:8001/api/v1/compare?creator_a=Dan%20Martell&creator_b=Alex%20Hormozi&depth=core"
curl "...&depth=extended"

# Cache invalidation after sync
curl -X POST http://127.0.0.1:8001/api/v1/sheets/sync
```

Checklist:

1. Transcript-heavy queries return transcript-labeled rows  
2. No duplicate video rows in semantic results  
3. Compare shows overview before audience loads  
4. Second compare within 10m is faster  
5. `/creators`, `/research`, `/compare` unchanged functionally  

## 6. Limitations

- Cache is **per process** (lost on container restart; not shared across workers)
- `depth=full` still exists but UI uses core+extended
- No embedding model change — same OpenAI/pgvector stack
- Creator-scoped semantic search uses same hybrid rules after merge

## 7. Files touched

| Area | Path |
|------|------|
| Scoring | `backend/app/services/retrieval_scoring.py` |
| Retrieval | `backend/app/services/retrieval_service.py` |
| Cache | `backend/app/services/cache/intelligence_cache.py` |
| Intelligence | `creator_intelligence_service.py` |
| Compare | `creator_compare_service.py`, `api/v1/compare.py` |
| Invalidation | `google_sheets/sync_service.py`, `snapshot_runner.py` |
| UI | `compare-client.tsx`, `videos-table.tsx` |
| Tests | `tests/test_retrieval_scoring.py` |
