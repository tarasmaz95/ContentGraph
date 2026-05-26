# Feed Momentum / Breakout Production QA

**Date:** 2026-05-23  
**Target:** https://tm1.website/feed  
**Context:** 2 snapshot days (`2026-05-22`, `2026-05-23`), `has_snapshot_history: true`  
**Method:** API + Postgres + `GrowthAnalyticsService` + browser — read-only audit with **minimal baseline hardening** (no scoring rewrite).

---

## Executive verdict

| Signal type | Verdict | Why |
|-------------|---------|-----|
| **Breakouts** | **Not yet trustworthy** (no signal) | 0 videos with view change between snapshots; formulas would work once deltas exist |
| **Creator growth** | **Not yet trustworthy** (no signal) | Same — all 7d-style deltas = 0 |
| **Audience** | **Partially trustworthy** | Math verified; tiny corpus (46 comments) |
| **Hooks** | **Trustworthy** | Deterministic median-usage rule; identity/authority verified |
| **Creator strength** | **Trustworthy** | Median/ratio math correct; not momentum |
| **Hero selection** | **Correct behavior** | No momentum items in ranked feed → audience hero is expected |
| **Snapshot infra** | **Trustworthy** | Cron + manual runs OK; no duplicate rows; full catalog captured |

**Bottom line:** Momentum layer is **architecturally ready** but **operationally empty** because snapshot rows copy static `videos.views_count` with **zero day-over-day change** so far. Hero **should not** flip to breakout until real deltas exist **and** breakout `final_score` competes in the ranked top-N.

---

## 1. Production state (verified)

### API briefing meta

```json
{
  "snapshot_date_latest": "2026-05-23",
  "snapshot_days_max": 2,
  "has_snapshot_history": true,
  "signals_considered": 13,
  "signals_selected": 6
}
```

### Ranked feed items (no breakout / growth)

| id | category | final_score |
|----|----------|-------------|
| audience-theme-curiosity | audience | 0.835 |
| audience-theme-positive | audience | 0.817 |
| hook-identity | hook_pattern | 0.812 |
| hook-authority | hook_pattern | 0.772 |
| strength-Dan Martell | creator_strength | 0.722 |
| strength-Tina Huang | creator_strength | 0.722 |

**UI:** Hero = curiosity audience theme. **No** “What accelerated” section. Snapshot amber banner **hidden** (`has_snapshot_history: true`) even though momentum cards are absent — **UX gap** (documented, not redesigned in this pass).

---

## 2. Snapshot integrity audit

### Distinct days & row counts

| Table | Rows | Distinct days | Min date | Max date | Rows/day |
|-------|------|---------------|----------|----------|----------|
| `video_stats_history` | 25,044 | **2** | 2026-05-22 | 2026-05-23 | 12,522 each |
| `creator_stats_history` | 216 | **2** | 2026-05-22 | 2026-05-23 | 108 each |

| Check | Result |
|-------|--------|
| Duplicate `(video_id, snapshot_date)` | **0** |
| Duplicate `(creator_name, snapshot_date)` | **0** |
| Latest video snapshot coverage | **12,522 / 12,522** videos |
| UTC dates | Date columns only (no tz drift in PK) |

### Cron / runs (`snapshot_runs`)

| id | started_at (UTC) | status | creators | videos | source |
|----|------------------|--------|----------|--------|--------|
| 2 | 2026-05-23 03:15:00 | success | 108 | 12,522 | **scheduled** |
| 1 | 2026-05-22 12:59:10 | success | 108 | 12,522 | manual |

Scheduled job at **03:15 UTC** is working. History tables are growing as designed.

### Why deltas are zero

```sql
SELECT COUNT(*) FROM (
  SELECT video_id FROM video_stats_history
  GROUP BY video_id HAVING COUNT(DISTINCT views_count) > 1
) t;
-- Result: 0
```

Example (Lex Zelenskyy interview):

| snapshot_date | views_count |
|---------------|-------------|
| 2026-05-22 | 7,400,000 |
| 2026-05-23 | 7,400,000 |

Snapshots reflect **current catalog views at capture time**. If Sheets sync does not refresh views between runs, momentum will stay flat — **not fake acceleration**, but **no signal**.

---

## 3. Breakout formulas (code + SQL)

### Source

`backend/app/services/analytics/growth_analytics_service.py`

### Baseline (after hardening)

| Step | Logic |
|------|--------|
| `latest_date` | `MAX(snapshot_date)` |
| `day_7` | `latest_date - 7 days` |
| `views_now` | Latest snapshot on/before `latest_date` |
| `views_baseline` | Snapshot on/before `day_7`, **else earliest snapshot** |
| `views_delta_7d` | `views_now - views_baseline` |
| `growth_7d_pct` | `100 * (views_now - views_baseline) / views_baseline` (0 if baseline 0) |
| `velocity_views_per_day` | `delta / max((latest_date - baseline_date).days, 1)` |
| `breakout_score` | `growth_7d_pct * max(delta, 1)^0.25` |

**Previous bug (fixed):** `views_7 = _snapshot_on_or_before(day_7) or views_now` — when history &lt; 7 days, `day_7` (e.g. 2026-05-16) had **no** snapshot → baseline became `views_now` → **forced delta = 0** even if 22→23 changed.

**After fix:** baseline = **earliest snapshot** when nothing exists on/before `day_7`.

**Production today:** still **delta = 0** because views are identical on both days (not because of fallback).

### Exclusion rules

| Layer | Rule |
|-------|------|
| Growth service | Skip if `delta_7 <= 0` AND `growth_pct <= 0` |
| Feed `_collect_breakouts` | Skip if `views_delta_7d <= 0` AND `growth_7d_pct <= 0` |
| Ranker | `final_score >= 0.42` + category caps |

### Production breakout candidates

```
get_video_breakouts(limit=15) → 0 items
_collect_breakouts() → 0 FeedItems
```

**No fake acceleration** — empty set is correct.

### Example calculation (hypothetical)

If `views_baseline = 1,000,000`, `views_now = 1,150,000`, `span_days = 1`:

| Field | Value |
|-------|-------|
| delta | 150,000 |
| growth % | 15% |
| velocity/day | 150,000 |
| breakout_score | 15 × 150000^0.25 ≈ **15 × 19.6 ≈ 294** |

`score_breakout` → `final_score` typically **0.65–0.78** (depends on `snapshot_days`). May still lose hero to audience **0.835** until deltas are large or snapshot_days → 7.

---

## 4. Creator growth formulas

Same baseline helper for `subscribers` and `total_views` per creator.

### Production

```
get_creator_growth(limit=10) → 10 rows, ALL:
  subscribers_delta_7d = 0
  views_delta_7d = 0
  growth_7d_pct = 0.0
```

Feed `_collect_creator_growth` → **0 items** (filtered).

| Verdict | **Not misleading** — correctly silent |

---

## 5. Hero prioritization audit

### Code (`frontend/lib/feed-briefing.ts`)

```
if has_snapshot_history:
  if any ranked item category ∈ {breakout, creator_growth}:
    hero = highest final_score among those
else:
  hero = highest final_score overall
```

### Production

| Condition | Value |
|-----------|-------|
| `has_snapshot_history` | **true** |
| Momentum items in API `items[]` | **0** |
| Hero | **audience-theme-curiosity** (0.835) |

**Conclusion:** Hero logic is **correct**. Momentum does not dominate because **no momentum cards pass collection + ranking**, not because frontend ignores snapshots.

### When hero will flip

1. Sheets/sync updates `videos.views_count` between daily snapshots **OR** snapshots diverge from stale copy.  
2. Breakout/growth items enter ranked top-8 with `final_score >= 0.42`.  
3. Among those, breakout/growth `final_score` must exceed audience (~0.82+) **or** ranker must include them while audience cap (2) already filled — hero only considers **selected** items.

**Important:** Even with valid breakouts, **audience may keep hero** on score alone unless breakout deltas are large (by design — no scoring change in this pass).

---

## 6. Signal-type trust matrix

| Signal | Verdict | Evidence |
|--------|---------|----------|
| Breakouts | **Misleading if shown without deltas**; **N/A today** | 0 candidates; formulas OK after baseline fix |
| Creator growth | **Same** | 0 positive deltas |
| Audience | **Partially trustworthy** | 8/10 counts, 5932/12645 likes verified (prior QA) |
| Hooks | **Trustworthy** | Median usage rule; identity 2.05×, authority 1.6× |
| Creator strength | **Trustworthy** | Catalog median math; not “momentum” |
| Snapshot gating | **Partially trustworthy** | `has_history` at ≥2 days hides banner but momentum still empty |

---

## 7. Feed usefulness (honest)

### Production-grade today

- Deterministic ranking and dedupe  
- Honest audience wording  
- Hook “underused” section with real SQL rule  
- Snapshot cron + full-catalog capture  
- No hallucinated momentum cards  

### Still weak / “feels fake”

- Hero labeled “Today’s lead” while driven by **comments**, not daily view change  
- `has_snapshot_history` hides “need snapshots” banner but **accelerated section empty**  
- 46 comments / 5 videos — audience “cross-creator” is thin  
- Creator strength at 16.5× (Dan Martell) is catalog math, easy to misread as momentum  

### Radically better after 7+ snapshot days **if views update**

- True 7d baseline via `day_7` anchor  
- Velocity averaged over 7 days  
- `score_breakout` confidence term reaches full `snapshot_days/7` weight  
- Breakout section + possible hero competition  

**Requirement:** Views must **change** in `videos` between syncs — snapshots alone do not create deltas.

---

## 8. Changes in this pass (hardening only)

| File | Change |
|------|--------|
| `growth_analytics_service.py` | `_baseline_views()` — earliest snapshot when `day_7` anchor missing; velocity uses actual span days |
| `feed_service.py` | Labels `2d snapshot window` instead of hardcoded `7d` when `snapshot_days < 7` |

**Not changed:** `feed_scoring.py`, hero algorithm, ranker weights, UI layout.

---

## 9. Recommended ops (no code required)

1. **Confirm Sheets sync refreshes `views_count`** between 03:15 UTC snapshots.  
2. After first non-zero deltas, re-run this QA SQL:

```sql
SELECT video_id,
  MAX(views_count) FILTER (WHERE snapshot_date = MAX(snapshot_date)) AS now,
  MIN(views_count) AS baseline,
  MAX(views_count) - MIN(views_count) AS delta
FROM video_stats_history
GROUP BY video_id
HAVING COUNT(DISTINCT views_count) > 1
ORDER BY delta DESC
LIMIT 10;
```

3. Accumulate **≥7 snapshot days** before treating `% over 7d` as canonical.  
4. Optional product follow-up: show banner when `has_snapshot_history && no momentum in feed` (“Snapshots run; views unchanged since last capture”).

---

## 10. UI ↔ API ↔ Postgres checklist

| Check | Status |
|-------|--------|
| `has_snapshot_history` matches DB days ≥ 2 | ✅ |
| Breakout absent when all deltas 0 | ✅ |
| Hero = top ranked; no momentum in feed | ✅ |
| Formulas match SQL on sample video 7094 | ✅ (delta 0 both days) |
| No duplicate snapshot rows | ✅ |
| Cron scheduled run 2026-05-23 | ✅ |
| Fake acceleration | **None** |
| Misleading “7d” label with 2 days | **Mitigated** (window label) |

---

*Related: `FEED_PRODUCTION_QA.md`, `FEED_STABILIZATION_QA.md`, `SNAPSHOT_MONITORING.md`*
