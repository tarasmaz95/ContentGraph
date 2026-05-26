# Feed Intelligence Audit

**Date:** 2026-05-22  
**Scope:** How `/feed` signals are produced, ranked, filtered, and shown — backend + frontend curation.  
**Not in scope:** UI redesign, backend rewrites, new features.

This document is intentionally blunt. The Feed is not broken because of missing AI; it is broken because several card types are **mislabeled**, **statistically naive**, and **concatenated without research intent**.

---

## 1. System overview

### Request path

```
Browser /feed
  → GET /api/v1/copilot/feed?limit={1..50}   (default limit=20)
    → CopilotService.get_feed()
      → FeedService.get_feed(limit)
        → 6 deterministic generators (SQL + analytics helpers)
        → concatenate in fixed order
        → items[:limit]
  → (frontend) fetchIntelligenceFeed(50)
    → curateFeedItems() in lib/feed-curate.ts
      → drop categories / weak tokens
      → bucket into 4 editorial sections
      → max 5 cards per section
```

**Files:**

| Layer | File |
|-------|------|
| API | `backend/app/api/v1/copilot.py` |
| Orchestration | `backend/app/services/copilot/copilot_service.py` |
| Feed builder | `backend/app/services/copilot/feed_service.py` |
| Schema | `backend/app/schemas/copilot.py` (`FeedItem`, `IntelligenceFeedResponse`) |
| Keywords input | `backend/app/services/analytics/dashboard_service.py` → `keyword_stats_from_titles()` |
| Token extraction | `backend/app/services/analytics/token_sanitize.py` |
| Growth / breakouts | `backend/app/services/analytics/growth_analytics_service.py` |
| Comment tags | `backend/app/services/comments/sentiment.py` |
| Frontend curation | `frontend/lib/feed-curate.ts` |
| Page | `frontend/app/feed/page.tsx` |

### What Feed is NOT

- **No LLM** in `FeedService` (no ChatGPT, no LangGraph on this path).
- **No semantic search / embeddings** on feed generation.
- **No live YouTube** polling — only Postgres after Sheets sync (+ optional comment ingest + daily snapshots).
- **Not a time-series “trend” feed** — despite names like `rising_keywords` and `viral_trend`.

`InsightEngine` (`insight_engine.py`) powers the **Copilot sidebar**, not the feed card list. It reuses similar dashboard keyword logic for *text* insights but is a separate pipeline.

---

## 2. How cards are assembled (backend)

`FeedService.get_feed()` builds one flat list in **fixed order**, then truncates:

| Order | Generator | Max cards produced | `category` value |
|------|-----------|-------------------|------------------|
| 1 | `_viral_trends()` | 3 | `viral_trend` |
| 2 | `_rising_keywords(120)` | 4 | `keyword` |
| 3 | `_audience_reactions()` | 3 | `audience` |
| 4 | `_creator_anomalies()` | 3 | `anomaly` |
| 5 | `_hook_opportunities()` | 3 | `hook_opportunity` |
| 6 | `_growth_signals()` | ≤3 | `growth` or `breakout` |

**Maximum raw items before `[:limit]`:** ~19 (with default internal caps).

**Global truncate:** `return items[:limit]`. With API default `limit=20`, essentially all generators fit. With `limit=10`, **growth/breakout cards are often dropped entirely** because they are last in the array.

**No backend grouping, dedupe, or cross-card ranking** — only per-generator caps and sorts.

**Response metadata:**

- `catalog_video_count` — `COUNT(*)` on `videos`
- `keyword_sample_size` — hardcoded `120` (used for dashboard keyword sample, not documented on cards)

---

## 3. Scoring, thresholds, sorting (by generator)

### 3.1 `viral_trend` — “Catalog leaders”

**Purpose (as implemented):** Show the highest view-count videos in the synced catalog.

**SQL:**

```sql
SELECT * FROM videos ORDER BY views_count DESC LIMIT 5
-- Feed keeps first 3
```

**Thresholds:** None beyond “top by views.”

**Sorting:** `views_count DESC`.

**Why it appears:** Always fills 3 slots if catalog has videos.

**Noise / redundancy:**

- Identical information to **Dashboard “Відео”** (top-100 table) and historical **Top Videos** sidebar.
- Label “Viral” / “Leader” implies *new* virality; data is a **static Sheets snapshot**, not momentum.

**Usefulness:** Low for research feed. OK as navigation shortcuts, bad as “insights.”

**Recommendation:** **REMOVE** from feed (frontend already drops). If kept anywhere, rename to “Highest views in catalog” and cap at 1 card.

---

### 3.2 `keyword` — “Rising keywords” (misnamed)

**Purpose (as implemented):** Surface title tokens from a **performance sample** with high average views.

**Source tables:** `videos` (top 120 by views via `VideoService.list_videos(limit=120)`).

**Logic chain:**

1. `DashboardAnalyticsService.get_dashboard(sample_size=120)`
2. `keyword_stats_from_titles(videos, 12)` in `_video_data.py`
3. For each video, `extract_title_tokens(title)` → `sanitize_keyword_token()` per word
4. Per token: `count` = number of titles containing token, `avg_views` = mean views of those titles
5. Sort keywords by **`avg_views` DESC**, take top 6 in dashboard; feed takes **top 4**
6. Feed card: `title="Rising: {keyword}"`, `summary="{count} titles · {avg_views} avg views"`

**Thresholds:**

- Token length ≥ 3, not in stopword list (`token_sanitize._STOP`)
- No minimum title count for feed (a word in **one** mega-viral title can win)

**Sorting:** `avg_views` descending — **not** frequency, not growth over time.

**Why weak cards appear (`fear`, `rejection`, `donald`, `zelenskyy`):**

| Token | Typical trigger |
|-------|-----------------|
| `fear` | Dan Martell title: “…DELETE your **fear** of rejection” — one or few titles, huge views → high `avg_views` |
| `rejection` | Same title |
| `donald` | Lex Fridman Trump interview title token |
| `zelenskyy` | Zelenskyy episode title token |

These are **not trends**. They are **leftover words from outlier titles** in the top-120 view sample. The UI word “Rising” is **false advertising**.

**Usefulness:** Almost none for 2–3 person research. At best, a hint to open Analytics keyword charts — not feed-worthy.

**Recommendation:** **REMOVE** from feed entirely. **REWRITE** naming everywhere from “rising” to “frequent in high-view titles (sample)” if kept on Analytics. **MERGE** into a single “Title language” insight only if aggregated into phrases/bigrams and min-count thresholds (e.g. ≥5 videos).

---

### 3.3 `audience` — Audience reactions

**Purpose (as implemented):** Show the highest-like comments in the database with a sentiment/tag label.

**SQL:**

```sql
SELECT comments.*, videos.title, videos.creator_name
FROM comments JOIN videos ON videos.id = comments.video_id
ORDER BY comments.likes_count DESC
LIMIT 5
-- Feed keeps 3
```

**Tag selection:** `emotional_tags[0]` if present, else `sentiment` (`positive` / `negative` / `neutral` from rule-based lexicon in `sentiment.py`).

**Thresholds:** None on likes minimum, no diversity per video, no filter on tag quality.

**Sorting:** Global `likes_count DESC`.

**Why it appears:** Any synced comments exist; top 3 populate feed.

**Noise:**

- **“Audience: neutral”** — lexicon found no strong positive/negative words; card title is literally the mood word. Reads as useless metadata.
- Dominated by **one channel** if only a few videos have comments ingested (extension/API).
- Comment text truncated to 120 chars in `summary`; title does not explain *which video* or *why it matters*.

**Usefulness:** **Medium** when comments are diverse and tags are meaningful (confusion, skepticism, inspiration). **Low** when only neutral/positive generic praise.

**Improves with:** More comment ingest, per-video coverage, filtering neutral-only cards, grouping by theme across comments.

**Recommendation:** **KEEP** but **REWRITE** rules: require non-neutral tag OR min likes OR question-shaped comment; title = insight (“Skepticism spikes on {creator} interview”) not `Audience: {token}`.

---

### 3.4 `anomaly` — Strong creators

**Purpose (as implemented):** Flag creators whose **average views per video** exceed **150% of global catalog mean**.

**SQL:**

```sql
SELECT creator_name, AVG(views_count), COUNT(*)
FROM videos
GROUP BY creator_name
HAVING COUNT(*) >= 2
```

**Rule:** `avg_views >= global_avg * 1.5` where `global_avg = AVG(views_count)` over all videos.

**Sorting:** `sorted(items, key=lambda x: x.summary, reverse=True)[:3]` — sorts by **formatted summary string**, not numeric avg. This is a **bug-level quirk** (order is unreliable vs true performance).

**Why it appears:** Any creator with ≥2 videos and high mean views — in a catalog dominated by podcast/longform, **many** “Lex Fridman”-scale names qualify.

**Example: “Design Theory outperforming baseline”** (if present):

- `title = "{creator_name} outperforming baseline"`
- Triggered purely by `AVG(views)` vs global mean, not by hook taxonomy.
- “Design Theory” may be a **creator_name** string from Sheets, not a hook type.

**Noise:**

- Confuses **creator scale** with **insight** (big channels are supposed to have high averages).
- Does not compare creator to **their own** historical baseline or niche peers.
- Duplicates “open creator page” navigation.

**Usefulness:** **Medium** as a “who to study first” nudge if deduped and sorted by effect size (ratio over global mean). **Low** as repeated “X outperforming baseline” cards.

**Recommendation:** **REWRITE** — compare creator avg to catalog median, require min video count (e.g. ≥5), sort by `avg_views` numeric, express as “1.8× catalog average”. **MERGE** with growth creator signals to avoid two “strong creator” stories.

---

### 3.5 `hook_opportunity` — Hook patterns

**Purpose (as implemented):** Surface hook **types** that are rare in `hook_patterns` but have high average `views_count` on indexed rows.

**SQL:**

```sql
SELECT hook_type, AVG(views_count), COUNT(*)
FROM hook_patterns
GROUP BY hook_type
```

**Rule:**

- `avg_views >= global_hook_avg * 1.2`
- `count <= 8` (rare type)

**Cap:** 3 cards (`[:3]` after loop — order depends on DB return order, **not sorted by score**).

**Source:** `hook_patterns` rebuilt on Sheets sync (`HookExtractionService`) from **titles** (and transcript hooks if indexed) — not live YouTube.

**Noise:**

- Rare + high avg often means **one viral video** carried the type.
- `count <= 8` is arbitrary; “opportunity” is speculative.
- Title “Try more {hook_type} hooks” sounds like generic advice, not research.

**Usefulness:** **Medium-high** for hook-led research **when** counts ≥3 and avg is stable — aligns with product thesis.

**Improves with:** More videos synced, hook reindex, showing example video links.

**Recommendation:** **KEEP** but **REWRITE** — sort by `avg_views * log(count)`, min count 3, show 2 example titles, rename to “Underused high-performing hook type”. **MERGE** with Hooks workspace, not duplicate it weakly.

---

### 3.6 `growth` + `breakout` — Snapshot momentum

**Purpose (as implemented):** Show **7-day delta** from daily snapshot tables when they exist.

**Dependencies:**

- `creator_stats_history` — creator growth cards (`id=growth-creator-{name}`, `category=growth`)
- `video_stats_history` — video breakouts (`id=breakout-{video_id}`, `category=breakout`)

**Service:** `GrowthAnalyticsService`

**Creator growth:**

- Latest snapshot date; compare subs/views vs 7 days ago
- Include if `growth_7d_pct > 0` OR `subscribers_delta_7d > 0`
- Feed calls `get_creator_growth(limit=2)`

**Video breakouts:**

- Per video with snapshots: `views_delta_7d`, `growth_7d_pct`, `velocity = delta/7`
- `breakout_score = growth_pct * max(delta_7d, 1)^0.25`
- Skip if `delta_7d <= 0` and `growth_pct <= 0`
- Sort by `breakout_score`, feed takes `get_video_breakouts(limit=2)`

**Combined cap:** `_growth_signals()` returns `items[:3]` total (creators + breakouts compete).

**If no snapshots:** Returns **empty** — feed has zero breakouts. This is correct behavior but invisible to users.

**Noise:**

- First snapshot day → fragile deltas
- Sheets sync updates absolute views; snapshots must run on cron (3:15 UTC) for signal

**Usefulness:** **High** — only feed category that reflects **change over time** in your data.

**Recommendation:** **KEEP** as primary “Breakouts” section. **REWRITE** copy to stress snapshot window. **Do not** call static top views “breakout”.

---

## 4. Frontend curation layer (current production)

After API response, `curateFeedItems()` (`feed-curate.ts`):

**Drops:**

- All `keyword` and `viral_trend`
- Single-token titles & blocklist (`fear`, `donald`, …)
- Weak `audience` themes (blocklist / length)

**Sections:**

| UI section | Backend categories |
|------------|-------------------|
| Breakouts | `breakout`, `growth` (id starts with `breakout-`) |
| Strong creators | `anomaly`, `growth` (creator) |
| Audience reactions | `audience` |
| Hook patterns | `hook_opportunity` |

**Ranking:** Client `scoreItem()` — rough heuristics, max 5 per section, dedupe creators in “Strong creators”.

**Important:** Curation **masks** backend noise but does not fix API consumers or Copilot. Raw `GET /feed` still returns keyword/viral cards.

---

## 5. Answers to specific questions

### 5.1 Why are weak keyword cards appearing?

Because `_rising_keywords()` labels **top avg-view title tokens** from top-120 videos as “Rising”, with **no min document frequency**, no phrase detection, and no stoplist for names/proper nouns. Stopwords in `token_sanitize.py` do **not** include `fear`, `donald`, `zelenskyy`, `rejection`.

### 5.2 Why are “leader” cards repetitive?

`viral_trend` is literally `ORDER BY views_count DESC` — the same ranking as dashboard video table. Up to 3 feed cards repeat what users already see on Панель.

### 5.3 Which signals are truly actionable?

| Signal | Actionable? |
|--------|-------------|
| Video `breakout` (snapshot) | **Yes** — open video, compare velocity, study title/hooks |
| Creator `growth` (snapshot) | **Yes** — open creator, compare peers |
| `hook_opportunity` (with enough rows) | **Yes** — test hook type in scripts/titles |
| `anomaly` (rewritten) | **Somewhat** — prioritize creator deep-dives |
| `audience` (tagged, high-like) | **Somewhat** — copy angles, pain points |
| `keyword` | **No** — do not change strategy from one token |
| `viral_trend` | **No** — duplicate navigation |

### 5.4 Which signals are only DB artifacts?

- **Keyword cards** — artifacts of tokenization + avg on tiny sample.
- **viral_trend** — artifact of sort order in `videos` table.
- **neutral audience** — artifact of default sentiment when lexicon misses.
- **Hook opportunity** with `count=1` — artifact of one row driving avg.

### 5.5 Which signals help research?

**Best:** breakouts, hook patterns (with context), strong audience comments tied to high-value videos.

**Weak:** keywords, catalog leaders.

**Misleading without snapshots:** anything implying “momentum” when `video_stats_history` is empty.

### 5.6 Which signals are impossible to trust?

- **“Rising” keywords** — name implies time series; data is cross-sectional.
- **Keyword avg views** on 1–2 titles — statistically meaningless.
- **Hook opportunity** from ≤2 indexed patterns.
- **Creator anomaly** when global avg is skewed by one mega-channel.

### 5.7 Which improve after transcript/comment accumulation?

| Signal | Transcripts | Comments |
|--------|-------------|----------|
| keyword | No (title-only tokens) | No |
| viral_trend | No | No |
| anomaly | No | No |
| hook_opportunity | Indirect (if hooks extracted from transcript) | No |
| audience | No | **Yes** |
| breakout | No (snapshot views) | No |

Semantic search quality improves with transcripts; **feed does not use them today**.

### 5.8 Which depend on historical snapshots?

Only **`growth`** and **`breakout`** via `GrowthAnalyticsService` + `*_stats_history` tables.

Everything else is **current-state catalog** from Sheets.

### 5.9 Fake “trends” vs real catalog patterns

| Label in UI | Reality |
|-------------|---------|
| Rising keyword | **Fake trend** — high-view title word |
| Viral / Leader | **Static leaderboard** |
| Outperforming baseline | **Cross-sectional avg** — real pattern, often obvious |
| Breakout / accelerating | **Real only if** ≥2 snapshot days exist |
| Hook opportunity | **Real pattern** if enough hook rows; often anecdotal |

---

## 6. Per-card-type summary table

| category | Purpose | Tables | Useful? | Verdict |
|----------|---------|--------|---------|---------|
| `viral_trend` | Top views | `videos` | No | **REMOVE** |
| `keyword` | Title tokens in sample | `videos` | No | **REMOVE** |
| `audience` | Top comments | `comments`, `videos` | Conditional | **REWRITE** |
| `anomaly` | High creator avg | `videos` | Conditional | **REWRITE** |
| `hook_opportunity` | Rare strong hook types | `hook_patterns` | Yes | **KEEP** + rewrite |
| `growth` | Creator snapshot momentum | `creator_stats_history` | Yes | **KEEP** |
| `breakout` | Video snapshot momentum | `video_stats_history`, `videos` | Yes | **KEEP** |

---

## 7. Classification (A–E)

### A. High-signal research insights

- Video **breakout** cards (when snapshots exist and deltas are meaningful)
- **Hook opportunity** when `video_count ≥ 3` and avg is not driven by a single outlier
- **Audience** cards with specific emotional tags on high-like comments *for strategically relevant videos*

### B. Useful supporting insights

- **Creator growth** (snapshot)
- **Creator anomaly** after rewrite (ratio vs catalog, min videos, proper sort)
- Breakout + hook links into `/videos/{id}`, `/hooks`, `/compare`

### C. Noisy / low-value insights

- All **keyword** cards
- **viral_trend** catalog leaders
- **Audience: neutral** (and other generic sentiment labels)
- Hook cards with **≤2** indexed rows

### D. Misleading insights

- Anything using the word **“Rising”** for keyword stats
- **“Viral”** on static view leaders
- **“Try more X hooks”** implying causation from correlation on N<3

### E. Redundant insights

- **viral_trend** vs Dashboard video list vs (former) Top Videos sidebar
- Multiple **anomaly** creators saying the same “outperforming baseline” template
- **Keyword** vs Analytics → Topic Trends block

---

## 8. Why the feed felt bad (honest synthesis)

| Lens | Diagnosis |
|------|-----------|
| **Product** | Feed tried to be “daily intelligence” but shipped **six unrelated generators** stapled together. No editorial question like “what should I study today?” |
| **Signal quality** | Half the cards are **misnamed cross-sections** (keyword, viral). The valuable half (breakouts, hooks) is **starved** by `[:3]` caps and last-place concat when limits bite. |
| **Data** | Catalog is **channel URLs + titles + views**, not watch URLs. Comments sparse. Snapshots may be empty. Feed does not admit “insufficient data” per section. |
| **UX** | (Pre-refactor) Long explainer + category badges + raw DB titles (`fear`, `donald`) = **admin panel**. (Post-refactor) Frontend hides worst offenders but **backend still produces them**. |

---

## 9. Proposed feed philosophy (product only — not UI spec)

### What Feed SHOULD be

A **curated research briefing** over *your* synced catalog: “what changed, who matters, what language works, what the audience pushes back on.”

### What it should optimize for

1. **Decision-ready insights** — each card answers “why should I care?” and “what do I do next?”
2. **Change + contrast** — momentum (snapshots), underused winners (hooks), audience friction — not raw sorts.
3. **Low card count** — quality over quantity (2–5 per theme); empty sections OK.
4. **Honest data boundaries** — say when snapshots or comments are missing; never imply live YouTube trends.

### What users should learn

- Which **videos/creators accelerated** in their library (snapshot-backed)
- Which **hook formats** outperform with low usage in *their* index
- What **audience language** appears on high-signal comments
- Which **creators** are statistical outliers worth a deep dive — not every big channel

### What belongs in Feed

| Belongs | Does not belong |
|---------|-----------------|
| Breakouts (snapshot) | Single-word keyword cards |
| Hook pattern gaps (aggregated) | Top-3 videos by all-time views |
| Curated audience themes | Generic “neutral” sentiment |
| 1–2 creator outliers (effect size) | Duplicate dashboard tables |
| Links to video/creator/hooks/compare | “Rising” without time series |

### Internal tool framing (2–3 people)

Feed is **not** a consumer social analytics product. It is the **front page of research memory**: deterministic, explainable, good enough to point humans at the next hour of analysis — not to replace thinking.

---

## 10. Stay vs remove (decision list)

| Signal | Backend | Frontend curation | Decision |
|--------|---------|-------------------|----------|
| `keyword` | Still generated | Dropped | **Remove from backend** when allowed |
| `viral_trend` | Still generated | Dropped | **Remove from backend** |
| `audience` | Generated | Filtered | **Keep, rewrite rules** |
| `anomaly` | Generated | Shown | **Keep, rewrite math + copy** |
| `hook_opportunity` | Generated | Shown | **Keep, tighten thresholds** |
| `breakout` / `growth` | Generated | Shown | **Keep, prioritize** |

---

## 11. Related docs

- `docs/FEED_UX_REFACTOR.md` — frontend-only curation (masks backend noise)
- `backend/app/services/copilot/feed_service.py` — source of truth for rules
- `frontend/lib/feed-curate.ts` — client-side filter/section map

---

## Appendix: Example trace — `fear`

1. Sheets sync inserts Dan Martell video with title containing “fear of rejection”.
2. Video sits in top 120 by `views_count`.
3. `extract_title_tokens` → `fear`, `rejection`, …
4. `keyword_stats_from_titles` averages views per token → `fear` ranks high.
5. `_rising_keywords` emits `FeedItem(category=keyword, title="Rising: fear", …)`.
6. Frontend `isLowSignalItem` → **dropped** (category `keyword`).

**User still saw it before curation** or via API/Copilot — the rule absolutely fired.

## Appendix: Example trace — `zelenskyy`

Same path as `fear`, token extracted from Zelenskyy episode title in high-view sample. Not a geopolitical “trend” in your catalog — a **proper noun in a hit title**.

## Appendix: Example trace — audience neutral

1. Comment ingested with text that lexicon scores as `neutral`.
2. No emotional tag or tag list empty → `title="Audience: neutral"`.
3. Card surfaces because it is in top 5 by likes globally.
4. Frontend may drop if `neutral` is short/blocklisted; if not, user sees weak card.

**Fix direction:** Skip `sentiment == neutral` unless comment has question or min length + likes threshold.
