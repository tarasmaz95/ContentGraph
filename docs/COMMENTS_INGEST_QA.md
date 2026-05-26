# Comments Ingest — QA Report

**Date:** 2026-05-21  
**Environment:** Docker backend `http://127.0.0.1:8001`, production `https://tm1.website`  
**Scope:** Phase 2 MVP — extension DOM path + API + DB + intelligence.

---

## Summary

| Area | Verdict |
|------|---------|
| Docker / backend health | **PASS** |
| `POST /comments/ingest` | **PASS** |
| Video matching (title + creator) | **PASS** (after 11-char ID guard) |
| DB persistence (`comments` table) | **PASS** |
| `GET /videos/{id}/comments` | **PASS** |
| Intelligence `audience_intel` | **PASS** |
| Duplicate ingest (replace, no dup rows) | **PASS** |
| Extension package (static) | **PASS** |
| YouTube DOM (manual Chrome) | **WARN** — requires human test |

---

## 1. Docker health — PASS

```
contentgraph-backend-1   Up
contentgraph-postgres-1  Up (healthy)
```

`GET /health` → `{"status":"ok"}`

Ingest logs: `POST /api/v1/comments/ingest HTTP/1.1 200 OK` — no transcript/pgvector tracebacks.

---

## 2. DB — PASS

Table: **`comments`** (existing migration `007`, equivalent to spec `video_comments`).

```sql
SELECT id, video_id, author_name, left(comment_text, 50), likes_count
FROM comments WHERE video_id = 2001
ORDER BY likes_count DESC;
```

Sample after ingest (video **2001**):

| author | likes | text (trimmed) |
|--------|-------|----------------|
| Fan | 2100 | This helped me overcome fear of rejection… |
| ProdQA | 800 | Because comfort never changed anyway… |

---

## 3. API ingest — PASS

```bash
curl -X POST https://tm1.website/api/v1/comments/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "video_url": "https://www.youtube.com/watch?v=REAL11CHARS",
    "title": "Give me 58 sec..i'\''ll DELETE your fear of rejection",
    "creator": "Dan Martell",
    "comments": [
      {"author": "Fan", "text": "…", "likes": 2100}
    ]
  }'
```

Response:

```json
{
  "video_id": 2001,
  "matched": true,
  "comments_saved": 2,
  "message": "Saved 2 comments to catalog video."
}
```

**Fix applied:** YouTube ID match only when `len(video_id) == 11` — prevents test URLs like `?v=x` matching `@AlexHormozi` via `%x%`.

---

## 4. `GET /videos/2001/comments` — PASS

Returns list sorted by `likes_count` desc, max 20.

---

## 5. Intelligence — PASS

`GET /videos/2001/intelligence` → HTTP 200

```json
"audience_intel": {
  "top_reactions": ["…"],
  "repeated_phrases": ["…"],
  "pain_points": [],
  "top_comment_preview": "This helped me overcome fear…"
},
"comments": { "total_comments": 2, "top_comments": […] }
```

Deterministic aggregation only — no LLM required for MVP.

---

## 6. Duplicate ingest — PASS

Second POST with 1 comment → `comments_saved: 1`  
SQL: `SELECT count(*) FROM comments WHERE video_id = 2001` → **1** (replaced, not appended).

---

## 7. Extension — PASS (static) / WARN (runtime)

Updated `extension/content.js`:

- **Comments** section: Extract / Copy / Save  
- `SAVE_COMMENTS` → `POST /comments/ingest`

Manual Chrome steps:

1. Reload unpacked extension  
2. Open catalog YouTube video → scroll to **Top** comments  
3. Extract comments → Save  
4. Confirm status: `Saved N comments to video #<id>`

---

## Known issues

1. **Short `?v=` test IDs** — use real 11-char IDs or rely on title+creator only.  
2. **Visible comments only** — no auto load-more.  
3. **YouTube API path** still available via `POST /videos/{id}/comments/fetch` when `YOUTUBE_API_KEY` set — extension path preferred.

---

## Reproduction

```bash
# Ingest
curl -X POST http://127.0.0.1:8001/api/v1/comments/ingest -H 'Content-Type: application/json' -d @payload.json

# List
curl http://127.0.0.1:8001/api/v1/videos/2001/comments

# Intelligence
curl http://127.0.0.1:8001/api/v1/videos/2001/intelligence
```
