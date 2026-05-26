# Feed Stabilization — Post-Fix QA

**Date:** 2026-05-23  
**Target:** https://tm1.website/feed  
**Scope:** Targeted hardening after `FEED_PRODUCTION_QA.md` — no scoring rewrite, no AI.

---

## Executive summary

**Verdict: IMPROVED — trustworthy enough for daily internal use with known limits.**

Duplication and fake-smart path issues from the prior audit are **fixed on production**. Hook patterns section **now renders**. Audience copy is **more honest**. Creator rank ties break **deterministically** (with a visible roster change).

**Still weak:** 46 synced comments, 1 snapshot day, no momentum section, hero remains comment-driven not “daily delta.”

---

## Before → After

| Issue | Before | After |
|-------|--------|-------|
| Emerging themes | Duplicate of `audience-theme-positive` | **Section hidden** — no second copy of positive theme |
| Research path | Step 1 = hero; step 4 = positive duplicate; filler “Save to Research” | **4 unique steps**, no hero echo, no artificial 4th filler |
| Audience titles | “(8 top comments)” | **“(8 synced comments in theme)”** |
| Audience description | “cross-channel” / hype | **“signals across 3 creators”** when applicable |
| Hook section | Always empty (`count ≤ 15`) | **Identity + Authority** cards (median-usage rule) |
| Creator ties at 0.722 | Jon Law + Matthew Berman (order arbitrary) | **Dan Martell + Tina Huang** (ratio DESC tie-break) |
| API items | 4 | **6** (2 audience + 2 hooks + 2 creators) |

### Research path (after)

1. Audience theme: strong positive reinforcement (10 synced comments in theme)  
2. Identity hooks outperform catalog hook average (2.1×, 162 indexed)  
3. Authority hooks outperform catalog hook average (1.6×, 190 indexed)  
4. Dan Martell consistently exceeds catalog median (16.5× across 187 videos)  

**No** curiosity repeat (hero excluded). **No** emerging-themes repeat.

### Sections (after)

- Hero: curiosity (8 synced comments in theme)  
- What audiences reacted to: positive  
- Underused winning patterns: identity, authority  
- Creators worth studying: Dan Martell, Tina Huang  
- Recurring audience themes: **not rendered** (correct)  
- What accelerated: **not rendered** (no snapshot history)  

---

## Changed files

| File | Change |
|------|--------|
| `frontend/lib/feed-briefing.ts` | Emerging dedupe; path dedupe by `source.id`; no hero in path; no filler step; optional `t` for emerging copy |
| `frontend/app/feed/page.tsx` | Pass `t` into `buildDailyBriefing`; use `layout.researchPath` directly |
| `frontend/lib/i18n/locales/en.ts` | Emerging + themes section strings; remove saveToResearch path filler |
| `frontend/lib/i18n/locales/uk.ts` | Same (UK) |
| `backend/app/services/copilot/feed_signal_ranker.py` | Tie-break: `final_score`, `performance_ratio`, `evidence_count` DESC |
| `backend/app/services/copilot/feed_service.py` | Honest audience copy; hook rule: usage ≤ median per type (≥3 rows, ratio ≥1.2) |

---

## Hook rule (production)

**Old:** `3 ≤ count ≤ 15` → **0 types** qualified (all types > 15).

**New (deterministic):**

1. `count ≥ 3` indexed `hook_patterns` rows per type  
2. `avg(views) / global_hook_avg ≥ 1.2`  
3. `count ≤ median(count)` across hook types with `count ≥ 3` (production median = **528**)

**Qualifies today:** identity (162), authority (190), fear_loss (242) — fear_loss may rank below cap after audience/hooks.

**Does not qualify:** curiosity (3725), social_proof (6652), etc. (above median usage).

---

## Production verification

### API (`GET /api/v1/copilot/feed?limit=8`)

```
audience-theme-curiosity   0.835
audience-theme-positive    0.817
hook-identity              0.812
hook-authority             0.772
strength-Dan Martell       0.722
strength-Tina Huang        0.722
```

- Titles use new audience wording  
- `briefing.has_snapshot_history: false` unchanged  
- Numbers still match Postgres (5932 likes / 8 comments on curiosity — verified in prior audit)

### UI (browser, 2026-05-23)

- [x] No “Recurring positive / Emerging themes” duplicate block  
- [x] Research path steps all distinct (by title/id)  
- [x] Hero not repeated as path step 1  
- [x] Empty sections omitted (accelerated, themes)  
- [x] Hook section visible with 2 cards  
- [x] Snapshot notice still shown  
- [x] Save / compare / hook links present  

---

## What got better

- **Trust:** No fake second insight; path reads like a real checklist  
- **Honesty:** Comment-based signals labeled as synced catalog evidence  
- **Coverage:** Hook opportunities surface under deterministic catalog rules  
- **Determinism:** Creator selection at equal score is reproducible  

---

## What is still weak

| Area | Why |
|------|-----|
| Audience hero | 46 comments, heavily one interview — “today’s lead” is still thin |
| Creator swap | Dan Martell 16.5× is mathematically correct but may surprise ops who expected Jon Law (173 videos, 3.8×) |
| fear_loss hooks | Eligible in pool but often crowded out by ranker caps |
| Momentum | Needs ≥2 snapshot days — banner correct, section empty |
| `evidence_count` on creators | Still means “video count,” not comment-style evidence |

---

## Recommended follow-ups (not done here)

1. **P2:** Cap extreme creator ratios (e.g. flag when avg driven by &lt;5 viral videos) — copy only, no scoring rewrite  
2. **P2:** Prefer minimum video count for creator_strength tie-break before ratio (optional policy)  
3. **P1:** Daily snapshots cron — unlock accelerated section  

---

*Prior audit: `docs/FEED_PRODUCTION_QA.md` · UX spec: `docs/FEED_DAILY_BRIEFING_UX.md`*
