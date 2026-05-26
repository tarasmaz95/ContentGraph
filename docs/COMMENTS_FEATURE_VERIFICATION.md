# Comments Feature Verification Audit

**Date:** 2026-05-20  
**Scope:** Read-only audit — extension UI, packaging, extraction logic, backend APIs, DB, intelligence integration, production reality.  
**Question:** Is top-comments extraction + save to ContentGraph **fully working end-to-end right now?**

---

## Executive answer

**No — not fully working in production practice.**

The feature is **implemented in source code, packaged in the downloadable ZIP, and backed by live APIs and DB schema**, but production data shows **only 2 comment rows across 12,522 catalog videos** (likely manual/QA ingest, not routine extension usage). Live YouTube DOM scraping was **not** exercised in this audit (no browser session).

| Layer | Status |
|-------|--------|
| Extension source UI + DOM scrape | **Present** |
| Packaged / served ZIP | **Matches source** (`content.js` byte-identical) |
| Backend ingest + list APIs | **Live on production** |
| DB persistence | **Works** (2 rows) |
| Product intelligence consumers | **Wired** (sparse data) |
| Operational E2E in production | **Not demonstrated** |

**Final verdict (letter code):** **D) Partially broken / not operationally end-to-end**

- Not **A** (code-only) — backend and zip are deployed.
- Not **B** (unpackaged) — comments are in `contentgraph-extension.zip`.
- Not **C** (fully working in production) — 2 comments for 12k+ videos.
- Not **E** (stale extension build for logic) — `content.js` in zip === repo source.
- Not **F** (backend only) — extension has full Comments section.
- Not **G** (end-to-end verified) — no live YouTube scrape proof; negligible prod data.

---

## 1. Extension UI

### Source (`extension/`)

The floating panel in `extension/content.js` is **transcript + comments** (not transcript-only).

**Structure (injected HTML):**

| Section | UI elements |
|---------|-------------|
| **Transcript** | `data-action="extract-transcript"`, `copy-transcript`, `export-transcript`, `save-transcript` |
| **Comments** | `data-action="extract-comments"`, `copy-comments`, `save-comments` |

Evidence — panel markup:

```27:37:extension/content.js
    <div class="cg-section">
      <div class="cg-section-title">Comments</div>
      <p class="cg-hint">Scroll to comments (Top sort). Then extract.</p>
      <div class="cg-status" data-status="comments">Ready</div>
      <div class="cg-actions">
        <button type="button" data-action="extract-comments">Extract comments</button>
        <button type="button" data-action="copy-comments" disabled>Copy comments</button>
        <button type="button" data-action="save-comments" disabled>Save comments</button>
      </div>
      <textarea class="cg-preview" data-preview="comments" readonly placeholder="Comments preview…"></textarea>
    </div>
```

**Styling:** `extension/panel.css` includes `button[data-action="save-comments"]`.

**Popup:** `extension/popup.html` only mentions transcript in copy; it does **not** surface comments (minor UX inconsistency, not a functional gap).

**Manifest branding:** `manifest.json` name/description say **"ContentGraph Transcript"** — marketing text is transcript-centric, but `content.js` is loaded on watch pages and includes both workflows.

**Onboarding page:** `/extension` (i18n `en.ts` / `uk.ts`) documents the comments workflow (scroll → Extract → Save).

### Screenshots

Not captured in this audit (headless server environment). Manual Chrome verification on a catalog video is still required for DOM scrape confidence.

---

## 2. Extension packaging

### Artifacts compared

| Path | Size | SHA256 | `content.js` vs source |
|------|------|--------|-------------------------|
| `extension/content.js` (source) | 12,070 B | — | — |
| `frontend/public/downloads/contentgraph-extension.zip` | 7,469 B | `432daf2b…` | **Identical** |
| `dist/extension.zip` | 7,469 B | `432daf2b…` | **Identical** |
| Production `https://tm1.website/downloads/contentgraph-extension.zip` | 7,469 B | (same checks) | **`extract-comments` present** |

Zip contents (all builds): `README.md`, `background.js`, `content.js`, `manifest.json`, `options.html`, `options.js`, `panel.css`, `popup.html`.

**String checks inside packaged `content.js`:** `extract-comments`, `save-comments`, `ytd-comment-thread-renderer`, `SAVE_COMMENTS`, `scrapeCommentsFromDom` — all **true**.

### Is the downloadable extension outdated?

| Check | Result |
|-------|--------|
| Core logic (`content.js`, `background.js`) | **Not stale** — byte-match source |
| `README.md` inside zip | **Slightly stale** — fresh zip build is 1,122 B vs packaged 882 B (docs only) |
| `extension-meta.json` | `updatedAt: 2026-05-22T07:21:40Z`, version `0.1.0` |

**Served URL:** `https://tm1.website/downloads/contentgraph-extension.zip` (also `frontend/lib/extension-download.ts` → `/downloads/contentgraph-extension.zip`).

**Build script:** `scripts/build-extension-zip.sh` writes only to `frontend/public/downloads/` — `dist/extension.zip` is a duplicate copy (same hash), not a separate release channel.

**Conclusion:** Users downloading from `/extension` get **comments functionality**. Risk is **old unpacked installs** in Chrome (Load unpacked from an old folder), not a stale hosted ZIP for `content.js`.

---

## 3. Frontend extraction logic (`content.js`)

Comments extraction **exists** in source and packaged zip.

### DOM selectors

```163:193:extension/content.js
  function scrapeCommentsFromDom() {
    const threads = document.querySelectorAll("ytd-comment-thread-renderer");
    // ...
      const authorEl =
        thread.querySelector("#author-text span") ||
        thread.querySelector("#author-text") ||
        thread.querySelector("ytd-comment-view-model #author-text");
      const textEl =
        thread.querySelector("#content-text") ||
        thread.querySelector("yt-formatted-string#content-text") ||
        thread.querySelector("#content yt-formatted-string");
      const likesEl =
        thread.querySelector("#vote-count-middle") ||
        thread.querySelector("span#vote-count-middle");
    // ... parse likes (1.2K), sort desc, cap 20
  }
```

### Scroll helper

```153:161:extension/content.js
  async function scrollToComments() {
    const section =
      document.querySelector("ytd-comments#comments") ||
      document.querySelector("#comments");
```

### Save path

1. `handleSaveComments()` → `chrome.runtime.sendMessage({ type: "SAVE_COMMENTS", payload: { video_url, title, creator, comments: [...] } })`
2. `extension/background.js` → `POST ${apiBase}/comments/ingest`

```15:18:extension/background.js
  if (message?.type === "SAVE_COMMENTS") {
    postIngest("/comments/ingest", message.payload)
```

Default API base: `https://tm1.website/api/v1`.

**Fragility note:** YouTube frequently changes comment DOM. Architecture doc and prior QA mark live Chrome scrape as **WARN / manual test required**. This audit did not re-run a live scrape.

---

## 4. Backend APIs

### Routes (registered)

`backend/app/api/v1/router.py` includes `comments.router`.

| Method | Path | Handler | Evidence |
|--------|------|---------|----------|
| **POST** | `/api/v1/comments/ingest` | `comments.ingest_comments` | `backend/app/api/v1/comments.py` |
| **GET** | `/api/v1/videos/{video_id}/comments` | `videos.list_video_comments` | `backend/app/api/v1/videos.py` |

Also related (not extension path): `POST /api/v1/videos/{id}/comments/fetch` — YouTube Data API when `YOUTUBE_API_KEY` is set.

### Schema / service / DB write

- Request/response: `app/schemas/comment_ingest.py`
- Service: `app/services/comments/ingest_service.py` — match video → `DELETE` existing comments for `video_id` → `INSERT` up to 20 with `enrich_comment()` sentiment/tags → `commit`
- Matching: `app/services/ingest/video_match.py` (YouTube ID in `channel_url` if 11-char id, else title+creator)

### Production HTTP checks (2026-05-20)

```bash
# List — 200, returns stored comment
GET https://tm1.website/api/v1/videos/2001/comments
→ [{"id":10,"video_id":2001,"comment_text":"Because comfort never changed...","likes_count":1500,...}]

# Ingest — 200, no match for fake video (expected)
POST https://tm1.website/api/v1/comments/ingest
→ {"matched":false,"comments_saved":0,"message":"No matching catalog video..."}
```

**Ingest works** when payload matches a catalog row; **fails softly** with `matched: false` otherwise.

### Tests

`backend/tests/test_comments_ingest.py` — validation (empty list → 422) and no-match path (200, `matched: false`). Does not assert successful save against real catalog IDs in CI.

---

## 5. DB verification

### Schema

Migration `backend/alembic/versions/007_create_comments.py` — table `comments` with `video_id`, `comment_text`, `author_name`, `likes_count`, `sentiment`, `emotional_tags`, etc.

Model: `backend/app/models/comment.py`.

### Production counts (Postgres via Docker)

| Metric | Value |
|--------|-------|
| Total `comments` rows | **2** |
| Distinct `video_id` with comments | **2** |
| Total `videos` in catalog | **12,522** |
| Coverage | **~0.016%** of videos |

### Sample rows

| id | video_id | title (truncated) | creator | author | likes | created_at (UTC) |
|----|----------|-------------------|---------|--------|-------|------------------|
| 7 | 2336 | 13 Years of No BS Business Advice… | Alex Hormozi | X | 1 | 2026-05-22 05:23:33 |
| 10 | 2001 | Give me 58 sec..i'll DELETE your fear… | Dan Martell | Fan | 1500 | 2026-05-22 05:24:21 |

`channel_url` for these videos is a **channel hub URL** (`@creator/videos`), not a watch URL — matching likely used **title + creator** from extension payload (consistent with `find_catalog_video` fallback).

Text on id **7** ("Second test comment for matching debug only") strongly suggests **QA/debug ingest**, not organic extension usage at scale.

---

## 6. Intelligence integration

Comments are **consumed in code** when rows exist; most surfaces are **empty or weak** due to data sparsity.

| Consumer | Uses `comments` table? | Evidence |
|----------|------------------------|----------|
| **Video page — Comments intelligence** | Yes | `frontend/app/videos/[id]/page.tsx` → `CommentsIntelligenceSection`; prod `GET /videos/2001/intelligence` → `total_comments: 1`, `audience_intel` populated |
| **Audience insights service** | Yes | `AudienceIntelligenceService` aggregates stored comments |
| **Creator intelligence / compare** | Yes | `CreatorIntelligenceService.get_audience()` joins `Comment`; compare merges `audience` intel |
| **Feed audience cards** | Yes | `FeedService._audience_reactions()`; prod `GET /api/v1/copilot/feed` → **2** `category: "audience"` items (matches 2 DB rows) |
| **Copilot / brief / insight engine** | Yes | `brief_service`, `insight_engine`, `copilot_service` reference `Comment` |
| **Chat retrieval (LangGraph)** | Yes | `app/ai/nodes/retrieval.py` uses `video_service.hybrid_retrieve()` |
| **Hybrid keyword retrieval** | Yes | `HybridRetrievalService.hybrid_retrieve()` → `_comment_search()` boost |
| **Semantic search API** (`GET /videos/semantic-search`) | **No** | `semantic_search()` only title + transcript vectors — **no** `_comment_search` |
| **Basic SQL search** (`GET /videos/search`) | **No** | ILIKE on title/creator/transcript only |

**Practical impact today:** With 2 comments, feed audience cards and creator-level audience intel are **technically live** but **not meaningful** for the catalog as a whole.

---

## 7. Production reality check

### What is proven

1. Hosted ZIP includes comments UI and scrape/save logic.
2. `POST /comments/ingest` and `GET /videos/{id}/comments` respond on `https://tm1.website`.
3. Comments persist and surface on video intelligence, feed, and list endpoint for videos **2001** and **2336**.

### What is not proven

1. Extension **Save comments** on a real YouTube watch page in 2026 DOM (selectors may be outdated).
2. Routine team usage — **2 rows** vs **12,522** videos.
3. High-volume catalog match success rate (title/creator must align with sheet; many `channel_url` values are not watch URLs).

### Letter verdict

**D) Partially broken** — full stack exists; production operation and live scrape are **not** verified at scale.

Closest honest one-liner: **Implemented and deployable; not fully working as a relied-on production workflow.**

---

## 8. If broken/missing — root cause (no fixes)

If users report "comments don't work," the audit points to these causes **in priority order**:

| Cause | Likelihood | Detail |
|-------|------------|--------|
| **Catalog match failure** | High | Ingest returns `matched: false` unless video exists in DB with matching title+creator (or YT id in `channel_url`). Most catalog rows use `@channel/videos` URLs. |
| **No / few successful saves** | High (prod evidence) | Only 2 comments ever stored; feature may never have been used broadly. |
| **YouTube DOM drift** | Unknown (needs manual test) | Selectors target `ytd-comment-thread-renderer`, `#content-text`, `#vote-count-middle`. YouTube UI changes break extract without code updates. |
| **User workflow** | Medium | Must scroll to load Top comments before Extract; empty DOM → "No comments found". |
| **Stale unpacked extension** | Medium (per user) | Old `extension/` folder in Chrome ≠ hosted ZIP; **not** the case for fresh download (zip matches source). |
| **Stale hosted ZIP (logic)** | **Low** | `content.js` identical to repo; only README size drift. |
| **Missing rebuild/deploy** | Low for logic | Zip built 2026-05-22; production serves same bytes. Re-run `./scripts/build-extension-zip.sh` + frontend deploy only needed after **future** code edits. |
| **Missing UI merge** | **Ruled out** | Comments section present in source and zip. |

**Not root cause:** Backend missing — APIs and table exist and respond.

---

## 9. Deliverable summary tables

### Extension status

| Item | Finding |
|------|---------|
| Comments UI in source | **Yes** — second panel section |
| Transcript-only? | **No** |
| Packaged zip | **Includes comments** |
| Production download | **Same as source `content.js`** |
| Outdated zip (core) | **No** |

### Backend status

| Item | Finding |
|------|---------|
| `POST /comments/ingest` | **Exists, live** |
| `GET /videos/{id}/comments` | **Exists, live** |
| Ingest service + DB writes | **Implemented** |
| Replace-on-save semantics | **Yes** (`DELETE` then `INSERT`) |

### Packaging status

| Item | Finding |
|------|---------|
| Build script | `scripts/build-extension-zip.sh` |
| Served file | `/downloads/contentgraph-extension.zip` |
| `dist/extension.zip` | Duplicate of public zip (same SHA256) |

### Production status

| Item | Finding |
|------|---------|
| API health | **OK** |
| Comment rows | **2** (test-like) |
| Catalog coverage | **~0.016%** |
| E2E verified in prod | **No** |

---

## Evidence commands (reproducible)

```bash
# Zip vs source
python3 -c "
import zipfile, hashlib
from pathlib import Path
src = Path('extension/content.js').read_bytes()
zp = Path('frontend/public/downloads/contentgraph-extension.zip')
with zipfile.ZipFile(zp) as z:
    assert z.read('content.js') == src
print('content.js: zip matches source')
"

# Production DB (docker)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U contentgraph -d contentgraph \
  -c "SELECT COUNT(*) FROM comments;" \
  -c "SELECT COUNT(*) FROM videos;"

# Production APIs
curl -sS 'https://tm1.website/api/v1/videos/2001/comments'
curl -sS -X POST 'https://tm1.website/api/v1/comments/ingest' \
  -H 'Content-Type: application/json' \
  -d '{"video_url":"https://www.youtube.com/watch?v=x","title":"x","creator":"y","comments":[{"author":"a","text":"hello world test","likes":5}]}'
curl -sS 'https://tm1.website/api/v1/copilot/feed' | jq '[.items[] | select(.category=="audience")] | length'
```

---

## Related docs

- `docs/COMMENTS_INGEST_ARCHITECTURE.md` — intended design
- `docs/COMMENTS_INGEST_QA.md` — 2026-05-21 QA (notes DOM manual test **WARN**)

---

## Recommended manual verification (outside this audit)

1. Install from `https://tm1.website/extension` (or rebuild zip + reload unpacked).
2. Open a video **known** in catalog (same title/creator as sheet).
3. Scroll comments (Top), Extract → Save.
4. Confirm panel status: `Saved N comments to video #…`.
5. Reload `https://tm1.website/videos/{id}` — Comments intelligence section populated.

Until that passes on a current YouTube page, treat live extraction as **unverified** even though code and packaging are in place.
