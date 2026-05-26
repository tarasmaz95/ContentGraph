# Feed briefing rebuild — philosophy, scoring, and honest limits

**Source of truth for prior problems:** `docs/FEED_INTELLIGENCE_AUDIT.md`  
**Implementation:** backend-ranked research briefing (no keyword / viral_trend).

---

## 1. New feed philosophy (product)

**Question the feed answers:** *What should we study today?*

**Not:** random SQL rows, title tokens, or duplicate “top by views” lists.

The feed is the **front page of research memory** for a 2–3 person team:

- **Deterministic** — every card traceable to Postgres rules
- **Explainable** — `why_appeared`, `why_matters`, evidence counts
- **Sparse** — 3–8 cards total; empty sections OK
- **Momentum-first** when snapshot history exists; otherwise strength/audience/hooks from catalog state

**Explicitly not:** live YouTube trends, social analytics SaaS, BI dashboards.

---

## 2. Architecture: before vs after

### Before

```
viral_trend(3) → keyword(4) → audience(3) → anomaly(3) → hook(3) → growth(3)
→ concat → items[:20]
```

Frontend dropped keywords/leaders and rewrote copy.

### After

```
collect candidates (5 generators only)
  → score each (confidence, importance, actionability, freshness)
  → final_score (weighted)
  → global sort + filter (final ≥ 0.42)
  → dedupe (creator / hook type / audience theme / per-category caps)
  → items[:8]
```

Frontend **groups** by `section`; copy comes from backend.

**New modules:**

| File | Role |
|------|------|
| `feed_service.py` | Collectors only |
| `feed_scoring.py` | Score functions per signal type |
| `feed_signal_ranker.py` | `item_from_parts`, `rank_feed_signals` |
| `feed_signal_classifier.py` | Sections, audience themes, labels |

**API:** `GET /api/v1/copilot/feed?limit=8` (clamped 3–8)

---

## 3. Removed signals (backend — not hidden)

| Category | Status |
|----------|--------|
| `keyword` | **Deleted** from `FeedService` |
| `viral_trend` | **Deleted** from `FeedService` |

`keyword_sample_size` in API response is always **0** (deprecated field).

---

## 4. Signal scoring

Each candidate gets four subscores in `[0, 1]`:

| Score | Meaning |
|-------|---------|
| `confidence_score` | Enough evidence / snapshot depth / sample size |
| `importance_score` | Magnitude of effect (delta, ratio, likes) |
| `actionability_score` | Clear next step (video, creator, hooks) |
| `freshness_score` | Time sensitivity (high for 7d breakouts, low for catalog median) |

**Combined:**

```
final_score = 0.32×confidence + 0.28×importance + 0.22×actionability + 0.18×freshness
```

**Gate:** `final_score ≥ 0.42` or dropped.

### Type-specific notes

- **Breakout:** confidence rises with `snapshot_days`, `views_delta_7d`, `growth_7d_pct`
- **Creator growth:** needs snapshot history; freshness tied to growth %
- **Creator strength:** cross-sectional; freshness capped ~0.35 (not “new”)
- **Audience theme:** needs ≥2 comments or one comment with ≥50 likes; neutral-only skipped
- **Hook pattern:** needs ≥3 indexed rows, ≤15 rows (not saturated), avg ≥1.2× hook mean; confidence crushed if count &lt; 3

---

## 5. Evidence fields (schema)

Each `FeedItem` includes:

```json
{
  "evidence_count": 14,
  "supporting_videos": [{ "video_id", "title", "creator_name", "views_count" }],
  "supporting_creators": ["Lex Fridman"],
  "time_window": "7d | full catalog | synced comments | indexed hooks",
  "snapshot_days": 8,
  "performance_ratio": 1.8,
  "why_appeared": "...",
  "why_matters": "..."
}
```

`IntelligenceFeedResponse.briefing` adds transparency:

- `signals_considered`, `signals_selected`
- `has_snapshot_history` (≥2 distinct snapshot days)
- `comment_count`, `snapshot_date_latest`

---

## 6. Rewritten signal types

| Old | New | Good copy pattern |
|-----|-----|-------------------|
| `anomaly` | `creator_strength` | “{Creator} exceeds catalog median (1.8× across 14 videos)” |
| `growth` (creator) | `creator_growth` | “Channel momentum up over 7 days” + subs/views |
| `breakout` | `breakout` | “View momentum accelerated (42% over 7d)” + video context |
| `audience` (single comment) | `audience` (theme cluster) | “Audience theme: skepticism (4 top comments)” |
| `hook_opportunity` | `hook_pattern` | “Curiosity hooks outperform (1.4×, 6 indexed)” |

---

## 7. Ranking logic

1. Collect all candidates (no concat order bias).
2. Assign scores per type.
3. Sort by `final_score` descending.
4. Select up to `limit` (3–8) with:
   - `final_score ≥ 0.42`
   - Max **one** of breakout/growth/strength per `creator_name` (highest score wins)
   - One card per `hook_type`, per `audience_theme`
   - Per-category caps: breakout 3, growth 2, strength 2, audience 2, hook 2

**Breakouts and growth rank highest** when snapshots exist because freshness + actionability are weighted.

---

## 8. Example outputs (live API shape)

**With only 1 snapshot day** (`has_snapshot_history: false`) — typical on fresh deploy:

- No `breakout` or `creator_growth` cards (rule: need ≥2 snapshot days).
- Feed may fill with `creator_strength` + `audience` (what we observed: 8 items, categories `creator_strength`, `audience`).

Example titles:

1. *Audience theme: curiosity and follow-up questions (8 top comments)* — evidence 8, final ~0.84  
2. *Jon Law consistently exceeds catalog median (3.8× across 173 videos)* — strength  
3. *Matthew Berman … (3.3× across 437 videos)* — strength  

**With healthy snapshots (≥2 days):**

- Top slots should be `breakout` / `creator_growth` (higher freshness).
- Strength and hooks fill remaining slots if they pass the gate.

---

## 9. Before vs after (honest)

| Dimension | Before | After |
|-----------|--------|-------|
| Card count | Up to 20 | 3–8 |
| Keywords | 4 cards “Rising: fear” | **Zero** |
| Catalog leaders | 3 duplicate dashboard rows | **Zero** |
| Ordering | Generator concat | **Global score** |
| Explainability | UI guess + long intro | **why_appeared / why_matters** |
| Evidence | None | **counts + sample videos** |
| Neutral audience | Shown | **Filtered out** |
| Hooks | count ≤ 8 only | **≥3 rows, ≤15, multi-video check** |

---

## 10. Remaining weak points (do not fake intelligence)

1. **No snapshot history → no breakouts**  
   With `snapshot_days_max < 2`, the feed cannot answer “what accelerated this week.” It falls back to catalog outliers — exactly what the audit criticized. **Fix:** run daily snapshots (cron 3:15 UTC) for several days.

2. **Creator strength still fills the feed**  
   In a large catalog, many creators exceed 1.35× median. Caps limit to 2 strength cards, but they can still dominate when momentum signals are absent. **Not wrong**, but **not “study today”** — it’s “who is big in the sheet.”

3. **Scores can cluster high**  
   When evidence is strong (173 videos), confidence/importance saturate. Ranking still works but margins are small.

4. **Sparse comments**  
   Audience themes need ≥2 tagged comments. With 46 comments total, one theme can dominate (e.g. curiosity on Lex/AI videos). **Improves with extension ingest**, not magic.

5. **Sparse transcripts**  
   Feed does not use `transcript` or embeddings. Transcript enrichment improves **semantic search**, not this feed, until hook/audience pipelines use transcript text.

6. **Hook patterns ≠ causal proof**  
   Still correlation on indexed title hooks. Minimum 3 rows helps; still not “use curiosity and win.”

7. **Median catalog views**  
   Strength uses median of all video views — skewed by mega-hit creators. Ratio is more honest than old “150% of mean” but still coarse.

---

## 11. Classification (A–E) after rebuild

| Class | Signals |
|-------|---------|
| **A — High-signal** | `breakout`, `creator_growth` (when snapshots ≥2 days) |
| **B — Supporting** | `hook_pattern` (≥3 evidence), `audience` theme clusters |
| **C — Low-value** | (removed) keyword, viral_trend |
| **D — Misleading if misread** | `creator_strength` when labeled as “trend” (it's static scale) |
| **E — Redundant** | (removed) leaders vs dashboard |

---

## 12. What to do next (product, not code mandate)

1. Run snapshots for 7+ days so breakouts/growth activate.  
2. Ingest comments on top 50 catalog videos so audience themes diversify.  
3. Revisit strength threshold (1.35× median) if feed still feels like “big creators list.”  
4. Optional later: feed uses transcript themes — **out of scope** for this rebuild.

---

## 13. Files changed

**Backend:** `feed_service.py`, `feed_scoring.py`, `feed_signal_ranker.py`, `feed_signal_classifier.py`, `schemas/copilot.py`, `api/v1/copilot.py`  

**Frontend:** `feed-curate.ts` (group only), `feed-card.tsx`, `feed-header.tsx`, `types/copilot.ts`, `api.ts`, i18n

**Docs:** this file + audit reference
