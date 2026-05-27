# Deep Comments Extraction — Extension v0.2.9

Production-grade comments collection pipeline that turns the YouTube comments
panel into a high-quality dataset for audience intelligence.

This is an **additive** change. Older extensions (v0.2.7 / v0.2.8) keep working
against the same backend; the worker keeps driving the extension without any
scraping logic of its own.

## TL;DR

```
Sort by → Top
  ↓
deepLoadComments(): scroll many times with human-like delays
  ↓
scrapeCommentsPool(): collect ~300–500 deduped threads with structured fields
  ↓
rankComments(): score = likes + reply*2 + pinned*1000 + hearted*250
  ↓
take top 50 → ingest /api/v1/comments/ingest → DB row-per-comment
```

## Pipeline stages

### 1. Force Top sort (`ensureCommentsTopSort`)

- Multi-layer selectors find the sort button across the legacy paper-button
  shell, polymer renderer, and the polymer-2 dropdown shell.
- Detects current label; bails fast when already "Top".
- Opens the menu, clicks the "Top comments" item (resilient to
  Ukrainian/English labels via regex).
- **Post-switch verification**: polls for `isTop=true` _or_ for the thread
  count to mutate (YouTube refreshes the list on sort change), with a
  `COMMENTS_SORT_WAIT_MS=1500` budget. Returns the confirmation status; the
  caller never throws — degraded sort is acceptable, missing transcript is
  not.

### 2. Deep auto-scroll (`deepLoadComments`)

| Constant | Value | Purpose |
| --- | --- | --- |
| `COMMENTS_DEEP_TARGET` | 400 | Stop once the deduped pool reaches this size |
| `COMMENTS_DEEP_MAX_ITER` | 35 | Hard ceiling — worst case ≈ 80 s, leaves 40 s of the 120 s phase budget for sort/save |
| `COMMENTS_DEEP_STAGNANT_LIMIT` | 5 | Exit when visible thread count fails to grow this many iterations in a row |
| `COMMENTS_DEEP_SCROLL_MIN_MS` | 700 | Lower bound of randomized inter-scroll pause |
| `COMMENTS_DEEP_SCROLL_MAX_MS` | 1800 | Upper bound — combined with min gives ~1.25 s average, mimics a casual reader |
| `COMMENTS_DEEP_SETTLE_MIN_MS` | 200 | Jitter so we don't catch the DOM mid-render |
| `COMMENTS_DEEP_SETTLE_MAX_MS` | 480 |  |
| `COMMENTS_PROGRESS_EVERY` | 4 | How often the panel status text updates (worker watchdog touch point) |

Each iteration:

1. Re-counts visible `ytd-comment-thread-renderer` nodes.
2. Re-scrapes the deduped pool (O(threads), cheap).
3. Exits on `pool >= TARGET` _or_ `stagnant >= LIMIT`.
4. Scrolls last thread into view, then sleeps `random(MIN, MAX)` ms followed
   by a smaller random settle pause.

### 3. Dedupe (`commentDedupeKey`)

- Key = `author + "|" + text.slice(0, 80)` (lowercased).
- Falls back to text-only when author is empty.
- On collision, keeps the row with higher likes (YouTube occasionally
  re-renders the same comment with stale "0" likes during scroll).

### 4. Structured extraction (`scrapeCommentFromThread`)

Unchanged from v0.2.8 — every collected row carries:

```ts
{
  author: string,
  text: string,
  likes: number,            // legacy mirror
  likes_count: number,
  reply_count: number,      // parseReplyCountFromThread
  published_text: string | null,  // "2 days ago" / "Show N replies" style
  is_pinned: boolean,       // ytd-pinned-comment-badge-renderer
  is_hearted: boolean,      // ytd-creator-heart
}
```

### 5. Ranking (`rankComments`)

```ts
score = likes_count
      + reply_count * COMMENTS_RANK_REPLY_WEIGHT     // 2
      + (is_pinned ? COMMENTS_RANK_PINNED_BONUS : 0) // 1000
      + (is_hearted ? COMMENTS_RANK_HEARTED_BONUS : 0) // 250

tie-break: longer comment first
```

Pinned creator comments always float to the top. Hearted comments get a
strong but not overpowering boost. Reply count nudges threads with discussion
above pure-like outliers.

### 6. Slice + ship

- `COMMENTS_TOP_N = 50` — exactly the new backend cap.
- Status text becomes: `"50 top comments (by likes, ranked) extracted from
  412 loaded"` — keeps the `"top comments"` substring the worker watchdog
  matches.

## Backend changes (additive, non-breaking)

| File | Change |
| --- | --- |
| `backend/app/schemas/comment_ingest.py` | `CommentsIngestRequest.comments.max_length`: 20 → 50 |
| `backend/app/services/comments/ingest_service.py` | Inner cap: 20 → 50 |
| `backend/app/services/comments/comments_service.py` | `list_for_video` default limit: 30 → 60 |
| `backend/app/services/comments/audience_intelligence_service.py` | `_aggregate` top slice: 25 → 50, **passes new structured fields through `CommentRead`** (bug fix from v0.2.8 — fields were silently lost at API boundary) |
| `backend/app/api/v1/videos.py` | `list_video_comments` query default 20 → 50, max 50 → 100, **passes structured fields through `CommentRead`** (same fix) |

The `Comment` SQL model and Alembic schema are **unchanged**. The four
structured columns added in migration `020_comments_structured_metadata`
already exist in prod.

## Worker / browser worker

- **No worker code changes.** `extension-ui.ts` still waits for the
  `"top comments"` substring in panel status. New status format keeps it.
- `REQUIRED_EXTENSION_VERSION` bumped to `0.2.9` in config + `.env.example` so
  fresh installs pin the matching pair.
- `worker/package.json` version bump to `0.2.9` keeps zip artifact name aligned.

## Sheets writeback

Not touched. The existing format truncates per-cell at 10 000 chars; with 50
× ~200-char comments we approach the cap but the truncation suffix still
applies. No schema change needed.

## Safety: phase timeout budget

Worker `phaseTimeoutMs = 120 000 ms` per phase. Worst-case extract phase:

```
scrollToComments         ~800 ms
ensureCommentsTopSort   ~2 000 ms (incl. 1.5 s verification)
35 × (1.8 s + 0.48 s)   ~80 000 ms
final pool scrape       ~few hundred ms
                       ≈ 83 s   (37 s safety margin)
```

Typical run exits via the stagnant-iterations early-exit around iter 15–25
and finishes in 30–50 s.

## Anti-bot hygiene

- Random delays between scrolls (uniform random, no fixed cadence).
- Two-stage pause: scroll wait + settle jitter — looks like natural reading.
- Single page scroll target (last thread into view) — same as a user
  scrolling down by hand.
- No keyboard or click spam; no synthetic mouse events.

## Smoke test checklist

1. **Backend running 020 head + new schema**
   ```bash
   docker exec contentgraph-backend-1 alembic current   # 020 (head)
   docker exec contentgraph-backend-1 python -c \
     "from app.schemas.comment_ingest import CommentsIngestRequest; \
      print(CommentsIngestRequest.model_fields['comments'].metadata)"
   # → [MinLen(min_length=1), MaxLen(max_length=50)]
   ```
2. **Pytest** — `tests/test_comments_ingest.py` covers:
   - empty list → 422
   - 50-row v0.2.9 payload → 200
   - 51-row payload → 422
   - structured v0.2.8 payload → 200
   - legacy v0.2.7 payload → 200
3. **Extension manual** — install v0.2.9, open a popular video:
   - panel shows "Scrolling comments… N/400 loaded (iter X)" progress
   - final status: "50 top comments (by likes, ranked) extracted from ~400 loaded"
   - Save → "Saved K comments to ContentGraph"
4. **Frontend** — open the video page:
   - `/api/v1/videos/{id}/comments?limit=50` returns 50 rows
   - top rows have `is_pinned: true` when creator pinned a comment
   - top rows have non-zero `reply_count` and human `published_text`
5. **Worker integration** — start the browser worker:
   - reports `version_check_ok: extension_version=0.2.9`
   - jobs complete with `comments_outcome: "ok"` and `commentsCount` ≈ 50
   - run a video with comments disabled → `comments_outcome: "disabled"`, transcript still wins partial success
