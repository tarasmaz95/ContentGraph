# Dashboard Product Audit

**URL:** https://tm1.website/dashboard  
**Date:** 2026-05-21  
**Scope:** Exploratory QA, product walkthrough, UX audit, DB/API consistency — **no code changes**

---

## Executive summary

| Area | Verdict | Notes |
|------|---------|-------|
| Core catalog counts (6,621 videos) | **PASS** | UI, API, and Postgres agree |
| Dashboard metrics (catalog-wide) | **PASS** | SQL aggregates over all videos; matches Postgres |
| Top videos sidebar | **PASS** | Matches DB top views (Dan Martell 8.6M, etc.) |
| Semantic search (API + UX) | **WARN** | Works on **title embeddings only**; copy promises transcripts; tail results weak (~21% similarity) |
| Keyword search | **PASS** | 6 results for `discipline`; aligns with API |
| Search mode vs dashboard mode | **WARN** | Hides metrics/top videos; copilot + trend brief stay visible; brief loading flash |
| Video detail from dashboard | **FAIL** | `/videos/{id}` shows **Internal Server Error** (LLM temperature vs model) |
| Transcript pipeline | **FAIL** | 0 transcripts, 0 transcript embeddings in DB |
| Copilot / trend brief | **WARN** | Useful hook stats; noisy Topics/Keywords; duplicates sidebar narrative |
| Initial load UX | **WARN** | Header briefly shows **"0 videos"** before data loads |
| Table row → video navigation | **WARN** | Click on result row did not navigate in browser test (may need row handler QA) |

**Overall:** **WARN** — product is usable for catalog browse and semantic/keyword search, but video intelligence and transcript story are broken or misleading.

---

## Screenshots

Captured during QA (Cursor browser). If files are not in the repo, re-capture with the same paths:

| File | Description |
|------|-------------|
| `docs/audit/dashboard-mode.png` | Dashboard mode: quick prompts, AI search, At a glance, keyword table + top videos |
| `docs/audit/dashboard-search-mode.png` | Semantic search mode: sticky search, 40 matches, similarity column |
| `docs/audit/dashboard-analytics.png` | Full Analytics page (200-video sample charts) |
| `docs/audit/dashboard-video-error.png` | Video page `/videos/2001` with main error banner |

---

## 1. Browser walkthrough

### Navigation (global header)

| Element | Result |
|---------|--------|
| Dashboard, Feed, Creators, Chat, Hooks, Scripts, Research, Analytics | All return **200** HTML |
| Settings (gear) | Links to `/settings` |
| EN / UA locale | Toggle present |
| Search ⌘K | Opens command palette (not fully exercised) |
| Data source | Links to `/settings` from dashboard header |
| Sync Sheets | Button present; not run end-to-end (would mutate Sheets/DB) |

### Dashboard mode (no active query)

| Flow | Result |
|------|--------|
| Page load | After ~4s: **6,621 videos** in subtitle; metrics and table populate |
| Initial flash | On cold load / navigate: **"0 videos"** in header for several seconds — confusing |
| Quick prompts | Chips: Trending topics, Top hooks, Semantic: discipline — visible |
| AI Search chips | Discipline, Identity, AI productivity — trigger semantic search |
| Keyword table (empty query) | Shows **top ~100 by views** (viral tech/business mix) |
| Top Videos (right column) | 8 items; #1 Dan Martell 8.6M — matches API `GET /videos/top?limit=8` |
| Full analytics → | `/analytics` loads charts; sample size **200** |
| Research block (`DashboardResearch`) | Empty workspace → CTA to Chat / Creators (no saved insights) |
| AI Copilot sidebar | Trend brief + Smart Insights + Recommended — always visible |

### Semantic search

| Flow | Result |
|------|--------|
| Type `discipline` + Search | Enters **search mode**; ~2–6s load |
| Deep link `?semantic=discipline` | Brief **"0 matches"** + empty state, then **40 matches** |
| Result count | UI **40** = API count |
| Similarity column | Shown (e.g. 59%, 44% Title) — matches API `similarity_score` / `match_source: title` |
| Transcript column | Always **—** (no transcript embeddings) |
| Clear search | Restores dashboard mode; metrics return; URL may still show `?semantic=` until full navigation |

### Keyword search

| Flow | Result |
|------|--------|
| Keyword `discipline` + search button | **6 matches** — matches `GET /videos/search?q=discipline` |
| vs semantic | Semantic **40** vs keyword **6** — expected differentiation |

### Links tested

| Link | Result |
|------|--------|
| Analytics | OK — metrics consistent with dashboard |
| Feed, Creators, Research | Routes OK (not deep-tested) |
| Copilot → Intelligence Feed, Compare creators, Hooks | Present in Recommended |
| Video row click (keyword results) | **Did not navigate** to `/videos/{id}` in automation |
| Direct `/videos/2001` | Page loads copilot brief; **main content: Internal Server Error** |

---

## 2. Dashboard structure audit

### Section order (dashboard mode, top → bottom)

1. **Page header** — Research workspace, video count, Data source, Sync Sheets  
2. **Quick prompts** — secondary discovery  
3. **AI Search** — **primary** retrieval entry (semantic)  
4. **At a glance** — **secondary** metrics (catalog-wide SQL aggregates)  
5. **Two-column grid**  
   - **Videos (keyword)** — **primary** browse/search table (2/3 width)  
   - **Top Videos** — **secondary** shortcut list (1/3)  
6. **Research workspace** — empty state CTA (when no saved research)  
7. **AI Copilot (global sidebar)** — trend brief + insights + recommendations  

### Search mode layout

1. Sticky: compact AI search + optional keyword row + **status bar** + Clear search  
2. Full-width **Videos** table only  
3. **Hidden:** Quick prompts, At a glance, keyword/top-videos grid, `DashboardResearch`  
4. **Still visible:** Header, Sync, **Copilot sidebar** (including Catalog Trends)

### Primary vs secondary

| Primary (job-to-be-done) | Secondary / supporting |
|--------------------------|-------------------------|
| AI semantic search | Quick prompts |
| Keyword video table | Top Videos list |
| Sync + catalog count | At a glance metrics |
| | Copilot trend brief |
| | Research empty CTA |

### Noise / duplication

- **Copilot trend brief** still uses a top-performing sample for topics/keywords (dashboard At a glance is catalog-wide).  
- **Topics vs Keywords** in copilot: nearly identical (`rejection`, `sec..i'll`, `fear` vs +`delete`) — low incremental value.  
- **Smart Insights** repeats hook-type stats also listed under “From your data right now”.  
- **Topics tokens** like `sec..i'll` are tokenizer artifacts from viral Dan Martell titles — looks broken to users.  
- **“AI Copilot”** label on deterministic stats — can feel like “fake AI” though copy says “No ChatGPT” in places.

### Genuinely useful

- Catalog total **6,621** with sync entry point  
- Semantic search with **similarity %** and clear semantic vs keyword help text  
- Hook-type performance insights (identity +104%, etc.) with real row counts  
- Top Videos aligned with real view counts  
- Search mode focus (hides metrics clutter)

---

## 3. Data verification (UI vs API vs DB)

**Postgres (production):**

```text
videos:                 6621
title_embedding:        6621
transcript_embedding:   0
transcript text:        0
hook_patterns:          9836
distinct creators:      54
```

| Metric | UI | API | DB | Match? |
|--------|----|-----|-----|--------|
| Catalog total | 6,621 | `GET /videos` → `total: 6621` | `COUNT(videos)` 6621 | **PASS** |
| Avg views (metrics) | 136,048 (catalog) | `analytics/dashboard` | `AVG` all videos ≈ 136,048 | **PASS** |
| Median views | 43,000 (catalog) | `analytics/dashboard` | `percentile_cont(0.5)` ≈ 43,000 | **PASS** |
| Max views | 8,600,000 | API | top video 8.6M | **PASS** |
| Top video #1 | Dan Martell 8.6M | `/videos/top` id 2001 | same | **PASS** |
| Hooks indexed | 9,836 (copilot) | — | 9836 | **PASS** |
| Semantic `discipline` count | 40 | 40 | — | **PASS** |
| Keyword `discipline` count | 6 | 6 | — | **PASS** |
| Transcript search | UI column empty | `has_transcript: false` | 0 embeddings | **FAIL** (product copy overclaims) |

**Note (2026-05-21):** Dashboard **At a glance** metrics are **catalog-wide** (single SQL aggregate over all `videos`). Copilot trend brief and `/analytics` charts may still use a top-N sample for performance.

---

## 4. Runtime / API verification

| Check | Finding |
|-------|---------|
| Failed API | `GET /api/v1/videos/{id}/intelligence` → **500** (`temperature` unsupported for configured OpenAI model, e.g. gpt-5.x) |
| Video base record | `GET /api/v1/videos/2001` → **200** OK |
| Console / network tools | Not available in automation; no manual DevTools session |
| Hydration | Suspense on dashboard; semantic deep link shows empty state before client fetch — feels like hydration/race, not SSR data |
| Loading | Semantic search disables inputs; skeleton on table; header count wrong during load |
| Broken links | Video detail broken via intelligence endpoint |
| Duplicate rendering | Copilot + main content separate; a11y tree merges sidebar headings into flat list |
| Empty states | Semantic deep link: “No videos yet. Sync…” briefly incorrect |

---

## 5. Semantic search QA

Queries via `GET /api/v1/videos/semantic-search?limit=50`:

| Query | Count | Top result quality | Tail / weird matches |
|-------|-------|--------------------|----------------------|
| discipline | 40 | Strong (titles with Discipline) | LeetCode dev video, “8 Claude Skills”, Adam Erhart “DARK Psychology” ~**21%** |
| identity transformation | 41 | Strong (reinvent yourself) | — |
| AI productivity | 40 | Strong (Google productivity, AI hours) | — |
| personal brand | 40 | Strong (personal brand courses) | — |
| fear of rejection | 40 | Strong (Dan Martell fear titles) | — |
| dopamine | 40 | Strong (dopamine reset/control) | “Dopamine Driven Development” (dev meme) |
| business advice | 41 | Strong (broke / no BS business) | — |

**Observations:**

- Cap ~40–41 results (backend limit/threshold).  
- All matches `match_source: title`; scores in UI ~35–59% for good hits.  
- **Transcript column always empty** — DB has zero transcript embeddings.  
- Marketing text: “titles **and** transcripts” is **inaccurate** today.  
- Loading UX: acceptable; deep link empty flash is **WARN**.

---

## 6. UX observations

**Strongest**

- Clear positioning as **research workspace** with real catalog scale  
- Semantic vs keyword explanation + example in AI Search card  
- Search mode simplification (sticky bar, clear status, hide metrics)  
- Transparent “top 200 sample” labeling for metrics  
- Deterministic hook insights feel **data-backed** (baseline, row counts)

**Weakest**

- Video detail **500** breaks core “open video intelligence” loop  
- **0 videos** flash on load  
- Transcript / semantic promise vs reality  
- Tokenized topics (`sec..i'll`) undermine trust  
- Very long dashboard page (table 100 rows + copilot + metrics)

**Polished**

- Visual hierarchy, cards, sticky header, EN/UA, settings entry  
- Similarity badges in semantic results  
- Sync result toast pattern (not re-tested live)

**Feels like fake AI**

- “AI Copilot” branding on rule-based trend brief  
- Recommended links generic (“Viral trends, keywords…”)  
- Video page error while sidebar still shows a crisp “video brief”

**Overloaded**

- Full dashboard: prompts + AI search + 8 metric cards + 100-row table + top 8 + copilot  
- Repeated disclaimers and hook insight lists

**Confusing**

- “0 videos” vs 6,621  
- Metrics avg views look like “whole catalog” at a glance  
- Keyword vs semantic both labeled “discipline” in copilot recommendation after search

**Valuable**

- Semantic discovery across 6k titles  
- Hook-type lift stats for content strategy  
- One-click chips for common research themes

---

## 7. Copilot audit

| Block | Useful? | Notes |
|-------|---------|-------|
| **Trend brief / Catalog Trends** | Partial | Good hook-type and avg-views summary; Topics/Keywords noisy and duplicate |
| **Topics** | Low | Dominated by viral-title tokens (`rejection`, `sec..i'll`) |
| **Keywords** | Low | Almost same as Topics |
| **Top hook types** | Medium | `general`, `numbers`, `how_to` — actionable |
| **Smart Insights** | High | Identity/authority/contrarian % vs baseline — specific, verifiable |
| **Trending topic: rejection** | Medium | Aligns with #1 video title theme |
| **Recommended** | Medium | Deep links to Feed, Creators compare, Hooks, Chat search — sensible |
| **Hallucination risk** | Low | Explicit “No ChatGPT” on trend brief; stats match API/DB |

**Repetitive:** Insight list mirrors brief topics and “From your data right now” bullets.  
**Noise:** Sidebar stays fully expanded during search mode (competes with results).  
**Generic:** Recommended subtitles could be tighter to current query/context.

---

## 8. Search mode vs dashboard mode

| Aspect | Works well? | Detail |
|--------|-------------|--------|
| Enter search | Yes | Semantic panel or keyword button sets `activeSearchQuery` |
| Hide metrics | Yes | At a glance + top videos hidden |
| Sticky search | Yes | `sticky top-14` bar |
| Status + Clear | Yes | “40 matches · search mode”, Clear restores exploration |
| Full-width results | Yes | Single column table |
| Return state | Mostly | Clear reloads catalog; URL `?semantic=` may persist |
| Copilot during search | **Debatable** | Still shows unrelated “rejection” trends while searching “discipline” |

**Verdict:** Separation is **good enough for v1** with **WARN** on loading flash and copilot distraction.

---

## 9. Recommendations (observations only — not implemented)

1. **P0:** Fix `/videos/{id}/intelligence` 500 (model temperature / LLM settings) so video links work.  
2. **P0:** Fix initial load to avoid **0 videos** in header (SSR or skeleton with “Loading…”).  
3. **P1:** Align copy: “title embeddings only” until transcript pipeline runs; or run transcript fetch+embed on sync.  
4. **P1:** Filter semantic tail (min similarity threshold) to drop ~21% “DARK Psychology” noise for discipline-like queries.  
5. **P2:** Collapse or slim copilot in search mode (query-aware insights only).  
6. **P2:** Normalize topic tokens (no `sec..i'll` in UI).  
7. **P2:** Deduplicate Topics vs Keywords or merge into one list.  
8. **P3:** Make table rows reliably open `/videos/{id}`; verify click target.  
9. **P3:** Clear `?semantic=` from URL on Clear search for shareable state.

---

## 10. PASS / WARN / FAIL checklist

| Item | Status |
|------|--------|
| Dashboard loads with data | PASS |
| Catalog count consistency | PASS |
| Metrics vs analytics API | PASS |
| Top videos consistency | PASS |
| Semantic search relevance (head) | PASS |
| Semantic search tail quality | WARN |
| Keyword search | PASS |
| Search mode UX | WARN |
| Clear search / return | WARN |
| Sync button present | PASS (not executed) |
| Analytics link | PASS |
| Video detail page | FAIL |
| Transcript semantic story | FAIL |
| Copilot data accuracy | PASS |
| Copilot UX noise | WARN |
| No console errors verified | WARN (not measured) |

---

*Audit performed against production https://tm1.website/dashboard. No application code was modified.*

---

## P0 stabilization (2026-05-21)

Follow-up fixes deployed after this audit. Re-verification summary:

| Item | Before | After | Status |
|------|--------|-------|--------|
| `GET /videos/{id}/intelligence` | 500 (GPT-5 `temperature`) | HTTP 200 stable | **PASS** |
| Dashboard header count flash | "0 videos" then 6621 | "Loading catalog…" until ready | **PASS** |
| Semantic search copy | "titles and transcripts" | Title-only when 0 transcript embeddings | **PASS** |
| Viral keywords / topics | `sec..i'll`, `i'll` fragments | `rejection`, `fear`, … (sanitized tokens) | **PASS** |
| Semantic tail noise (~21% matches) | ~40 results | Min similarity 0.25 → **7** discipline results | **PASS** |
| Search mode copilot | Unrelated "rejection" trend brief | Collapsed + hidden trend brief + query note | **PASS** |
| Table → video navigation | Unreliable click | Row `role=button` + title `Link` + keyboard | **PASS** |
| Video page UI error | Intermittent 500 / parse errors | LLM list coercion + fallback to defaults | **PASS** |

### Code touched (stabilization only)

- `backend/app/services/settings/llm.py` — skip `temperature` for `gpt-5*` models
- `backend/app/services/video_intelligence/video_intelligence_service.py` — resilient structured output
- `backend/app/services/retrieval_service.py` — `SEMANTIC_MIN_SIMILARITY = 0.25`
- `backend/app/services/analytics/token_sanitize.py` — keyword/token cleanup
- `backend/app/api/v1/videos.py` — `GET /catalog-stats`
- `frontend/app/dashboard/page.tsx` — `dataReady`, catalog stats, copilot search mode
- `frontend/components/videos/videos-table.tsx`, `semantic-search.tsx`, `copilot-panel.tsx`

### Remaining WARN (not P0)

- Brief "0 matches" flash on `?semantic=` deep link before search completes (header uses Loading catalog, status bar still updates)
- Transcript pipeline still empty (0 embeddings) — copy is honest; feature not added
- Some viral tokens still short (`ais` from "AIs") — acceptable vs `sec..i'll`

---

## Catalog-wide dashboard metrics (2026-05-21)

**Change:** Dashboard **At a glance / Коротко** now uses **full catalog** SQL aggregates, not top-200 by views.

| Metric | Top-200 sample (old) | Full catalog (new) | Postgres verify |
|--------|----------------------|--------------------|-------------------|
| Total videos | 200 (mislabeled as catalog) | **6,621** | `COUNT(*)` = 6621 |
| Avg views | 1,444,620 | **136,048** | `AVG(views_count)` ≈ 136048 |
| Median views | 1,200,000 | **43,000** | `percentile_cont(0.5)` = 43000 |
| Max views | 8,600,000 | **8,600,000** | same |

**API:** `GET /api/v1/analytics/dashboard` — `metrics` always catalog-wide; optional `charts_limit=200` only affects charts/trends blocks.

**UI:** Removed top-200 disclaimers and `DashboardMetricsNotice` from dashboard; copy now says catalog-wide metrics.

**Unchanged:** Semantic search, keyword search, LangGraph, embeddings. `/analytics` page still passes `charts_limit=200` for heavy charts.
