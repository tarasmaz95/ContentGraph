# Audience Intelligence Layer

Production-grade AI layer built **on top of** the structured comments pipeline
(extension v0.2.9 + structured DB schema from migration `020`). Turns the
`comments` table into a refreshable, cached "what does the audience actually
care about" view per video.

This is an **additive** layer. Nothing in extension, browser worker,
transcript ingestion, Sheets writeback, retrieval, or chat is touched.

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Extension v0.2.9  →  /api/v1/comments/ingest                        │
│                                                                       │
│  Save structured comments WITH comment_score computed on insert       │
│  (compute_comment_score = likes + reply*2 + pinned*1000 + hearted*250)│
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
            ┌──────────────────────────────────────────┐
            │   comments table   (migration 020 + 021) │
            │   ───────────────────────────────────    │
            │   + reply_count, is_pinned, is_hearted,  │
            │     published_text                       │
            │   + comment_score (BIGINT, indexed       │
            │     video_id + score DESC)               │
            └──────────────────────────────────────────┘
                                  │  list_for_video()
                                  │  ORDER BY comment_score DESC
                                  ▼
            ┌──────────────────────────────────────────┐
            │  AudienceInsightsService                 │
            │  ──────────────────────                  │
            │  1. Load 50 highest-scored comments      │
            │  2. Deterministic pass:                  │
            │     - bigram topic frequency             │
            │     - pain/desire phrase hints           │
            │     - sentiment distribution             │
            │  3. Optional LLM pass (skipped if no key │
            │     or < 5 rows):                        │
            │     - structured output (summary, topics │
            │       pain points, desires)              │
            │  4. Snapshot top 25 ranked comments      │
            │  5. UPSERT audience_insights row         │
            └──────────────────────────────────────────┘
                                  │  HTTP
                                  ▼
            ┌──────────────────────────────────────────┐
            │  GET /api/v1/videos/{id}/audience-       │
            │      insights[?refresh=true]             │
            │  ────────────────────────────────        │
            │  • cache-first by default                │
            │  • refresh=true regenerates              │
            │  • 404 on unknown video                  │
            └──────────────────────────────────────────┘
                                  │
                                  ▼
            ┌──────────────────────────────────────────┐
            │  Frontend: AudienceIntelligenceSection   │
            │  ───────────────────────────────────     │
            │  • AI summary card                       │
            │  • Top topics chips                      │
            │  • Pain points / desires (two columns)   │
            │  • Sentiment distribution bar            │
            │  • Viral comments list with score badge  │
            │  • "Generate" / "Refresh AI" CTA         │
            └──────────────────────────────────────────┘
```

No background workers. No queue. No WebSockets. One HTTP request, one
transaction.

## File map

| Layer | File | Change |
| --- | --- | --- |
| Migration | `backend/alembic/versions/021_comment_score.py` | NEW — add `comment_score`, index `(video_id, comment_score DESC)`, backfill |
| Migration | `backend/alembic/versions/022_audience_insights.py` | NEW — create `audience_insights` cache table |
| Model | `backend/app/models/comment.py` | + `comment_score: Mapped[int]` |
| Model | `backend/app/models/audience_insight.py` | NEW — cache row ORM |
| Model | `backend/app/models/__init__.py` | Register `AudienceInsight` |
| Score helper | `backend/app/services/comments/scoring.py` | NEW — single source of truth for the formula |
| Ingest | `backend/app/services/comments/ingest_service.py` | Compute & persist `comment_score` on insert |
| Ingest | `backend/app/services/comments/comments_service.py` | Same for YouTube Data API path; `list_for_video` now orders by `comment_score` |
| Schema | `backend/app/schemas/comments.py` | + `comment_score` field on `CommentRead` |
| Schema | `backend/app/schemas/audience_insights.py` | NEW — full response contract |
| Service | `backend/app/services/audience_insights/audience_insights_service.py` | NEW — deterministic + LLM, upsert cache |
| Service | `backend/app/services/audience_insights/__init__.py` | NEW — public re-export |
| API | `backend/app/api/v1/videos.py` | + `GET /{id}/audience-insights[?refresh]`; CommentRead exposes score |
| Tests | `backend/tests/test_audience_insights.py` | NEW — 5 cases (formula lock, 404, schema, refresh, score exposure) |
| Frontend types | `frontend/types/audience-insights.ts` | NEW |
| Frontend API | `frontend/services/api.ts` | + `fetchAudienceInsights` |
| Frontend UI | `frontend/components/videos/audience-intelligence.tsx` | NEW |
| Frontend wire-in | `frontend/app/videos/[id]/page.tsx` | Section added below video grid |

## Migration info

```bash
docker exec contentgraph-backend-1 alembic current
# → 022 (head)

# 021 backfills score for every existing row using the same formula.
# 022 creates an empty audience_insights table. First call to the endpoint
# populates the row for that video.
```

Both migrations are **safe to re-run on hot DB**:
- `021` backfill is a single `UPDATE`; no per-row work.
- `022` only creates a new table.

`downgrade()` is provided for both — drops the column/index/table cleanly.

## API contract

### Request

```
GET /api/v1/videos/{video_id}/audience-insights?refresh=false
```

| Param | Type | Default | Meaning |
| --- | --- | --- | --- |
| `video_id` | path int | required | catalog video id |
| `refresh` | query bool | `false` | regenerate insight (runs deterministic + optional LLM) |

### Response (200)

```jsonc
{
  "video_id": 1992,
  "summary": "Viewers worry about rejection and humiliation; want practical tips…",
  "top_topics": [
    { "label": "Fear of Rejection", "weight": 1.0 },
    { "label": "Personal Experiences", "weight": 0.9 }
  ],
  "pain_points": [
    "Fear of rejection and humiliation",
    "Anxiety about asking or trying"
  ],
  "desires": [
    "More practical advice",
    "Quick, actionable tips"
  ],
  "sentiment_distribution": {
    "positive": 32.0,
    "neutral": 56.0,
    "negative": 12.0
  },
  "top_comments": [
    {
      "id": 243,
      "author": "@vitalii.pohoretskyi",
      "text": "If rejection scares you, staying stuck should terrify you. Liked that.",
      "likes_count": 33000,
      "reply_count": 0,
      "is_pinned": false,
      "is_hearted": false,
      "score": 33000,
      "sentiment": "neutral",
      "published_text": null
    }
    // up to 25 entries
  ],
  "comment_count_at_generation": 12,
  "total_comments": 12,
  "model_used": "gpt-4.1-nano",
  "generated_at": "2026-05-27T10:02:30.737084Z",
  "is_empty": false
}
```

### Errors

| Status | Body | When |
| --- | --- | --- |
| 404 | `{ "detail": "Video not found" }` | unknown `video_id` |
| 200 + `is_empty=true` | empty arrays | video exists, no comments yet |

## AI flow

```
top 50 scored comments
        │
        ▼
deterministic pass (always runs)
  - bigram top topics (10)
  - pain/desire phrase hits
  - sentiment counts
  - rule-based one-line summary
        │
        ▼
LLM pass (skipped if no OPENAI_API_KEY OR len(rows) < 5)
  - SystemMessage: audience research framing
  - HumanMessage: 25 comments with `[sentiment] likes=N replies=N PINNED HEARTED: text`
  - Structured output (Pydantic _AudienceLLMOut):
      summary, top_topics[str], pain_points[str], desires[str]
  - On failure → log + fall back to deterministic
        │
        ▼
merge (LLM > deterministic; dedupe by lowercase prefix)
        │
        ▼
snapshot top 25 comments (id, author, text, likes, replies, pinned, hearted, score, sentiment)
        │
        ▼
UPSERT audience_insights (one row per video)
```

The `model_used` field surfaces which model produced the cached insight, so
the UI can show stale-vs-fresh and history.

## Frontend integration

`AudienceIntelligenceSection` renders below the main video-detail grid and
above the existing `CommentsIntelligenceSection`:

```
VideoOverview
  ↓
[ VideoBreakdown | TranscriptIntelligence | StructureAnalysis | ViralAnalysis ]
  ↓
AudienceIntelligenceSection   ← NEW
  ↓
CommentsIntelligenceSection   ← existing, untouched
  ↓
Charts + Similar Videos
```

Loading states:
- initial mount: spinner card
- empty (no comments): CTA "Згенерувати" (calls `?refresh=true`)
- error: red box + "Спробувати ще раз"
- ready: full layout with refresh button at top right

The component is self-contained — it calls `/audience-insights` on mount and
on user-driven refresh. No coupling to `VideoIntelligence` payload.

## Smoke test checklist

1. **Alembic head**
   ```bash
   docker exec contentgraph-backend-1 alembic current   # 022 (head)
   ```

2. **Schema column visible**
   ```bash
   docker exec contentgraph-backend-1 python -c \
     "from app.schemas.comments import CommentRead; \
      print(CommentRead.model_fields['comment_score'])"
   ```

3. **Pytest** (12/12 green)
   ```bash
   docker exec -e SMOKE_BASE_URL=http://backend:8000 contentgraph-backend-1 \
     python -m pytest tests/test_audience_insights.py tests/test_comments_ingest.py -v
   ```

4. **Cold endpoint call** (regenerates):
   ```bash
   curl -s 'http://localhost:8001/api/v1/videos/<VID>/audience-insights?refresh=true' | jq
   ```
   Expect `model_used != "rules"` when `OPENAI_API_KEY` is set on backend.

5. **Cache hit** (second call):
   ```bash
   curl -s 'http://localhost:8001/api/v1/videos/<VID>/audience-insights' | jq '.generated_at, .model_used'
   ```
   Same `generated_at` as in step 4 → cache works.

6. **404 for unknown video**:
   ```bash
   curl -i 'http://localhost:8001/api/v1/videos/999999999/audience-insights'
   ```
   Expect `HTTP/1.1 404`.

7. **Frontend** — open `/videos/{id}` in the app:
   - Section "Аудиторна інтелігенція" renders below the main grid.
   - Click "Оновити AI" → regenerates within a few seconds.
   - Top comments show pinned/hearted/score badges.

## Risks & limitations

| Risk | Mitigation |
| --- | --- |
| LLM call latency on cold path (1–4s) | endpoint is synchronous; UI shows spinner; cache eliminates subsequent loads. Background pre-warm can be added later without API contract change. |
| LLM API failure | service catches `Exception`, logs, falls back to deterministic results. Endpoint never errors due to LLM. |
| Stale insight after new comment batch ingested | `comment_count_at_generation` exposed → UI can show a "X new comments since last analysis" hint and prompt refresh. Not yet implemented. |
| Sentiment is rule-based (lexicon) | Good enough for distribution view; for high-accuracy use an LLM sentiment pass per comment — out of scope for v1. |
| `comment_score` formula tuning | All weights in one file (`scoring.py`); a script `UPDATE comments SET comment_score = ...` rebackfills in seconds. Extension constants must be bumped in lock-step. |
| LLM cost | Single structured call per regen, up to 25 comments × ~280 chars ≈ 7k tokens input. With `gpt-4.1-nano` (~$0.0001/1k tokens) ≈ $0.0007 per refresh. Negligible at expected refresh cadence. |

## Deploy notes

```bash
# 1. Rebuild backend (picks up new alembic versions + service code)
docker compose build backend
docker compose up -d backend
# Wait for "Application startup complete" — alembic runs on entrypoint.

# 2. Verify head
docker exec contentgraph-backend-1 alembic current   # 022 (head)

# 3. Rebuild frontend (picks up new component + API client)
bash /opt/contentgraph/deploy/remote-up.sh

# 4. Cold-call one video to populate first cache row
curl -s 'http://localhost:8001/api/v1/videos/<some-id>/audience-insights?refresh=true' > /dev/null
```

Rollback:
```bash
docker exec contentgraph-backend-1 alembic downgrade 020
# Drops audience_insights table + comment_score column. Frontend section
# starts returning 500s on /audience-insights — UI shows the error card.
```

## What did NOT change

- `extension/content.js` — same v0.2.9 payload
- `worker/` — same Playwright drive-the-extension flow
- `transcripts/*` — untouched
- `google_sheets/*` — Sheets writeback intact
- `/api/v1/comments/ingest` — same contract; just stores one extra column
- `/api/v1/videos/{id}/intelligence` — still returns `CommentsIntelligence`
  computed at request time, separate from the cached audience layer
- Retrieval / chat / hooks / scripts — no schema changes consumed by them
