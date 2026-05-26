# Comments Pipeline Live QA — 2026-05-22

**Video:** https://www.youtube.com/watch?v=u321m25rKXc&t=1288s  
**Catalog video ID:** `7094`  
**Extension version tested:** `0.1.3` (DOM logic; panel not installed in automation browser)  
**Environment:** Production `https://tm1.website`

---

## Final verdict: **PASS** (pipeline)

| Stage | Result | Notes |
|-------|--------|-------|
| YouTube DOM extraction | **PASS** | 20 comments, all selectors hit |
| Extension panel UI click | **N/A** | Automation browser has no extension loaded |
| `POST /comments/ingest` | **PASS** | `matched: true`, `comments_saved: 20` |
| DB persistence | **PASS** | 20 rows, `likes_count` up to 39000 |
| Replace-on-save (2× ingest) | **PASS** | Still 20 rows, not 40 |
| `GET /videos/7094/comments` | **PASS** | 20 comments, sorted by likes |
| `GET /videos/7094/intelligence` | **PASS** | `total_comments: 20`, charts + `audience_intel` |
| Feed audience cards | **PASS** | 3 cards linking to `/videos/7094` |
| Emotional tags richness | **PARTIAL** | Field present; most tags `[]`, sentiment `neutral` |

**Success condition met:** Real YouTube comments → extracted → stored → surfaced in API/feed/intelligence.

---

## 1. Browser automation (YouTube)

### Steps performed

1. Opened watch page (Lex Fridman #456 / Zelenskyy).
2. Scrolled page to load comments section.
3. Confirmed `ytd-comment-thread-renderer` present (**40** threads in DOM).
4. Sort menu present (`Sort by`); Top comments implied by high like counts (39K, 36K, …).
5. Ran **same DOM logic as** `extension/content.js` → `scrapeCommentsFromDom()`.

### DOM selectors (all working)

| Field | Selector(s) | Hits (of 20 extracted) |
|-------|-------------|-------------------------|
| Thread | `ytd-comment-thread-renderer` | 40 threads available |
| Author | `#author-text span`, `#author-text`, `ytd-comment-view-model #author-text` | **20/20** |
| Text | `#content-text`, `yt-formatted-string#content-text`, `#content yt-formatted-string` | **20/20** |
| Likes | `#vote-count-middle`, `span#vote-count-middle` | **20/20** |

### Extraction result

```json
{
  "threads": 40,
  "extracted": 20,
  "selectorHits": { "author": 20, "text": 20, "likes": 20 }
}
```

Top extracted comment (sample):

- **@craigrussell3062** — 39,000 likes  
- **@tweedyharfunkel** — 36,000 likes  
- **@DaveNealComedian** — 24,000 likes  

Artifact: `docs/audit/comments-live-qa-2026-05-22/extract-sample.json`

### Extension panel note

The automated browser session did **not** have the ContentGraph Chrome extension installed, so **Extract comments** / **Save comments** buttons were not clicked in-panel. Save was executed with the **browser-extracted payload** via the same API the extension calls (`POST /api/v1/comments/ingest`). DOM extraction matches extension code path.

---

## 2. Backend ingest (simulates Save comments)

### Request metadata

```json
{
  "video_url": "https://www.youtube.com/watch?v=u321m25rKXc",
  "title": "Volodymyr Zelenskyy: Ukraine, War, Peace, Putin, Trump, NATO, and Freedom | Lex Fridman Podcast #456",
  "creator": "Lex Fridman",
  "comments": [ "... 20 items ..." ]
}
```

### Ingest #1

```http
POST https://tm1.website/api/v1/comments/ingest
```

```json
{
  "video_id": 7094,
  "matched": true,
  "comments_saved": 20,
  "message": "Saved 20 comments to catalog video."
}
```

Artifact: `docs/audit/comments-live-qa-2026-05-22/ingest1.json`

### Ingest #2 (duplicate / replace-on-save test)

Same payload posted again.

```json
{
  "video_id": 7094,
  "matched": true,
  "comments_saved": 20,
  "message": "Saved 20 comments to catalog video."
}
```

**DB after 2× save:** `COUNT(*) = 20`, `COUNT(DISTINCT comment_text) = 20` → **replace-on-save confirmed** (no duplicate rows).

---

## 3. API verification

### `GET /api/v1/videos/7094/comments`

- **HTTP 200**
- Returns **20** comments
- Ordered by `likes_count` desc
- Top row: id **31**, `@craigrussell3062`, **39000** likes

### `GET /api/v1/videos/7094/intelligence`

| Field | Value |
|-------|-------|
| `comments.total_comments` | **20** |
| `comments.top_comments` | **20** items |
| `comments.charts` | `sentiment_distribution`, `emotional_triggers`, `question_frequency`, `recurring_phrases` |
| `audience_intel.top_reactions` | populated (e.g. phrase hints) |
| `audience_intel.top_comment_preview` | present |

Sample tags: mostly `sentiment: "neutral"`, `emotional_tags: []` (deterministic enricher did not tag strong emotion on these lines).

---

## 4. Database

```sql
SELECT COUNT(*) AS rows, COUNT(DISTINCT comment_text) AS distinct_text, MAX(likes_count) AS max_likes
FROM comments WHERE video_id = 7094;
```

| rows | distinct_text | max_likes |
|------|---------------|-----------|
| 20 | 20 | 39000 |

Sample rows (ids 31–38): authors, likes, sentiment stored correctly.

---

## 5. Feed / copilot integration

```http
GET https://tm1.website/api/v1/copilot/feed
```

| Metric | Value |
|--------|-------|
| Total feed items | 13 |
| `category: "audience"` cards | **3** |
| Links | `/videos/7094` |

Examples:

- Audience: neutral — top weapons/money comment (39K likes)
- Audience: neutral — Putin 9-hour version joke (36K likes)
- Audience: neutral — podcasts during wartime (24K likes)

---

## 6. Screenshots

| File | Description |
|------|-------------|
| Browser capture | Comments visible with 1.3K–39K like counts (automation session) |
| Path attempted | `docs/audit/comments-live-qa-2026-05-22/youtube-comments-visible.png` |

If screenshot missing in repo, refer to browser QA session timestamp **2026-05-22 ~11:45 UTC**.

---

## 7. Before / after (this video)

| Metric | Before QA | After QA |
|--------|-----------|----------|
| Comments for video 7094 | 0 | **20** |
| Feed audience cards for 7094 | 0 | **3** |
| Intelligence `total_comments` | 0 | **20** |

---

## 8. Manual extension confirmation (recommended)

Automation validated DOM + API. For full UI E2E:

1. Install extension **0.1.3** from `/extension`.
2. Open same video → scroll to Top comments.
3. **Extract comments** → preview shows 20 lines.
4. **Save comments** → status `Saved 20 comments to video #7094`.
5. Reload `https://tm1.website/videos/7094` → Comments intelligence section populated.

---

## 9. Issues / limitations

| Item | Severity |
|------|----------|
| Extension not clicked in automation | Info — pipeline proven via DOM + API |
| `emotional_tags` often empty | Low — field exists; rules/LLM may not tag neutral text |
| Pinned @lexfridman long sponsor comment included in top 20 | Low — expected when sorted by likes |

---

## 10. Commands to reproduce

```bash
# Ingest (after browser extract)
curl -sS -X POST https://tm1.website/api/v1/comments/ingest \
  -H 'Content-Type: application/json' \
  -d @payload.json

# Verify
curl -sS https://tm1.website/api/v1/videos/7094/comments
curl -sS https://tm1.website/api/v1/videos/7094/intelligence
curl -sS https://tm1.website/api/v1/copilot/feed

# DB
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U contentgraph -d contentgraph \
  -c "SELECT COUNT(*) FROM comments WHERE video_id=7094;"
```

---

## Related docs

- [COMMENTS_FEATURE_VERIFICATION.md](./COMMENTS_FEATURE_VERIFICATION.md)
- [COMMENTS_INGEST_ARCHITECTURE.md](./COMMENTS_INGEST_ARCHITECTURE.md)
