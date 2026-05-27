# Structured comments — additive refactor (v0.2.8)

**Status:** shipped.
**Goal:** stop losing comment metadata between extension → backend → DB.
**Constraint:** zero breaking changes to ingest, embeddings, Sheets writeback,
extension automation, browser-ingestion, or any existing queries.

---

## What was actually wrong

The DB already stores **one row per comment** in `comments` (see `007_create_comments.py`),
so there was no "single text blob" at rest. The metadata leak happened at two
places:

1. **Extension parser** (`extension/content.js → scrapeCommentFromThread`)
   only captured `author`, `text`, `likes`. Reply count, pinned/hearted flags,
   and the relative timestamp shown by YouTube ("2 days ago") were dropped.
2. **Ingest schema** (`CommentIngestItem`) only accepted those three fields,
   so even if the parser had extracted more, the API would reject them.

`format_comments_for_sheet` collapses comments to `Author: text\n…` for the
Sheets cell — that is **derived plain text**, not the source of truth.

## What changed

### DB (`alembic/versions/020_comments_structured_metadata.py`)

Additive columns on `comments`:

| Column | Type | Default | Why |
|--------|------|---------|-----|
| `reply_count` | `BIGINT` | `0` | Thread reply count from YouTube DOM / API `totalReplyCount` |
| `is_pinned` | `BOOLEAN` | `false` | Pinned by creator |
| `is_hearted` | `BOOLEAN` | `false` | Hearted by creator |
| `published_text` | `VARCHAR(64)` | `NULL` | Relative time ("2 days ago") when extension cannot resolve exact timestamp |

Old rows get safe defaults via `server_default`; no backfill required.

### SQLAlchemy model (`app/models/comment.py`)

New mapped columns added — no removals.

### Pydantic ingest schema (`app/schemas/comment_ingest.py`)

`CommentIngestItem` now accepts both shapes:

- **Legacy (v0.2.6 / v0.2.7 extensions):** `{author, text, likes}`
- **Structured (v0.2.8+):** `{author, text, likes_count, reply_count,
  published_at, published_text, is_pinned, is_hearted}`

A `model_validator(mode="before")` aliases `likes` ↔ `likes_count` so old
clients continue to work unchanged.

### Ingest service (`app/services/comments/ingest_service.py`)

- Sort by `max(likes_count, likes) DESC` (structured value wins).
- Dedup unchanged.
- Persist new fields on each row.

### YouTube Data API path (`app/services/comments/comments_service.py`)

Captures `totalReplyCount` from each `commentThread` snippet → `reply_count`.
Pinned/hearted are not exposed by the snippet endpoint, so they stay `false`
on that path.

### Extension parser (`extension/content.js`, v0.2.7 → **v0.2.8**)

`scrapeCommentFromThread` now also reads:

| Field | DOM source |
|-------|-----------|
| `reply_count` | `ytd-comment-replies-renderer` button text (parsed with `parseLikeCount` so "1.2k" works) |
| `is_pinned` | `ytd-pinned-comment-badge-renderer`, `#pinned-comment-badge`, `aria-label*="Pinned"` |
| `is_hearted` | `ytd-creator-heart`, `#creator-heart`, `aria-label*="hearted"` |
| `published_text` | `#published-time-text a` |

The DOM is **best-effort** — selectors silently fall back to safe defaults
when YouTube changes layout, so the extension never breaks.

Top-N selection still sorts by `likes` DESC and caps at 20.

### Read schema (`app/schemas/comments.py`)

`CommentRead` exposes the four new fields with safe defaults so existing API
consumers see no schema break.

### Frontend (`frontend/types/video-intelligence.ts`,
`components/videos/comments-intelligence.tsx`)

- `CommentRead` TS type extended (all new fields optional).
- Top comments list now shows Pinned / Hearted badges and reply count when
  present. Cards stay backward-compatible when the fields are absent.

## What did **not** change

- API contract (`POST /comments/ingest`) — same URL, same response, just
  accepts more optional fields.
- Sheets writeback format — still `Author: text\n…`. Adding a separate
  `Likes` column would require a Sheet-side mapping, which the operator can do
  later without code changes.
- Embeddings, retrieval, hybrid search — still read `comment_text`.
- Browser ingestion worker behaviour — still drives the existing
  `[data-action="extract-comments"]` / `save-comments` buttons.
- Sentiment / emotional tagging — same lexicon.

## Smoke checklist

Run the worker against any video and confirm:

1. `POST /api/v1/comments/ingest` from extension v0.2.8 succeeds.
2. Returned `comments_saved` > 0 for a video with ≥ 1 comment.
3. `SELECT reply_count, is_pinned, is_hearted, published_text FROM comments
   WHERE video_id = …` shows non-default values where DOM exposed them.
4. **Legacy extension (v0.2.7)** still works — POST without `likes_count` /
   `is_pinned` is accepted and saved with default `0` / `false`.
5. Sheets cell after writeback still reads `Author: text` per line.
6. `/videos/[id]` page renders Pinned / replies badges when present; layout
   does not break for comments without those fields.
7. Video Intelligence sentiment / emotional tag widgets behave exactly as
   before.
8. `alembic upgrade head` on a populated DB completes; pre-existing rows have
   `reply_count = 0`, `is_pinned = false`, `is_hearted = false`,
   `published_text IS NULL`.
9. `alembic downgrade -1` drops the new columns cleanly.
