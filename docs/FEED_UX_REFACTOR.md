# Feed UX refactor (research-first)

Product-only change: same `GET /api/v1/copilot/feed` endpoint; curation and copy on the frontend.

## Before

- Flat 2-column grid of up to 20 mixed cards
- Heavy intro panel with per-category legend and footnotes
- **Keyword** cards showing single tokens (`fear`, `donald`, `zelenskyy`, …)
- **Catalog leader** (`viral_trend`) cards duplicating “top by views”
- Category chips, badge rows, and second “explain” paragraph on every card
- Felt like a database dump, not research insights

## After

Four vertical sections (2–5 cards each, empty sections hidden):

| Section | Source categories | Max cards |
|---------|-------------------|-----------|
| **Breakouts** | `breakout`, `growth` (video breakouts only) | 5 |
| **Strong creators** | `anomaly`, `growth` (creator acceleration) | 5 |
| **Audience reactions** | `audience` | 5 |
| **Hook patterns** | `hook_opportunity` | 5 |

Light header: title + one-line subtitle + ⓘ glossary tooltip (`intelligence_feed`).

Editorial cards: insight title → why it matters → metric line → text actions + Save to Research + Quick Compare.

## Removed card types

| Removed | Reason |
|---------|--------|
| `keyword` | Single-word / low-signal; not actionable |
| `viral_trend` | Duplicate “catalog leader” vs breakouts |
| Weak audience themes | Tokens in blocklist (`fear`, `donald`, …) |
| Single-token titles | &lt; 8 chars or blocklist |

## Example rewritten copy

**Before:** Title `fear` · explain “High-performing word fear in 3 titles…”

**After (hook):**  
- **Title:** Curiosity hooks outperform with low usage  
- **Description:** Few indexed titles use this pattern, but they earn strong view counts…  
- **Metric:** 6 indexed · 1,240,000 avg views  

**Before:** Title `Donald Trump Interview…` · badge “Leader”

**After:** *(removed — `viral_trend` filtered; breakout uses editorial template)*  
- **Title:** Breakout velocity in your catalog  
- **Description:** {video} is accelerating — {creator}. Momentum from daily snapshots…

## Files

- `frontend/lib/feed-curate.ts` — filter, group, insight copy
- `frontend/components/feed/feed-header.tsx` — light intro
- `frontend/components/feed/feed-section.tsx` — section layout
- `frontend/components/feed/feed-card.tsx` — `FeedInsightCard`
- `frontend/app/feed/page.tsx` — sectioned page
- Removed: `frontend/components/feed/feed-intro.tsx`

## Preserved

- `fetchIntelligenceFeed(50)` — same API, higher limit for curation headroom
- Save to Research (`feed_signal`)
- Quick Compare on creator/breakout cards
- Deterministic backend `FeedService` unchanged
