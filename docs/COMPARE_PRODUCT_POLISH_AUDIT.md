# Compare page — product polish audit

**Date:** 2026-05-20  
**Scope:** Frontend UX/copy/layout only (`/compare`). No backend scoring, API contracts, charts logic, or data model changes.

**Production URL reviewed:** https://tm1.website/compare (pre-deploy baseline from prior session; post-rebuild local at `http://127.0.0.1:3002/compare`).

---

## Executive summary

Compare was refactored from an analytics-dashboard layout into a narrower, guided research workspace: single combobox pickers, one primary save action, humanized hook/topic copy, flat-growth explanation, collapsed copilot, and clearer section hierarchy.

**Verdict:** **Mostly yes** — the page now reads as “what can I learn?” rather than “how does the engine work?”, with remaining gaps in toolbar density on small screens and full end-to-end browser QA on production (502 during container recycle; local CORS port mismatch).

---

## Before vs after (screenshots reviewed)

| State | Before (production QA) | After (local build `:3002`) |
|-------|------------------------|-----------------------------|
| Empty / picker | Separate search + `<select>`, weak onboarding, spinner-only | Onboarding bullets, dual searchable comboboxes, helper “Select two creators to compare”, intentional disabled Compare |
| Toolbar | Duplicate “Save comparison”, crowded Copy / vs {name} / More | Single **Save to Research**, Copy summary, Study creator links, Compare with… in overflow |
| i18n | `vs {name}` literal (broken interpolation) | `vs {{name}}` in EN + UA; dropdown items use `t("convenience.compareWithLast")` |
| Hook labels | `transformation:from_to`, `curiosity:question` | Display layer → e.g. “Before → after transformations”, “Question-based curiosity titles” |
| Flat growth | `0.0%`, `velocity 0/day` with no context | Inline `compare.growthFlat` when both 7d growth values are flat |
| Copilot | Wide empty sidebar | `setCollapsed(true)` on mount + `compare` context hides trend brief; ~40px strip on desktop |
| Layout | Equal-weight bordered cards | `CompareSection` with border-top rhythm, primary “At a glance”, max-width column |

Screenshots captured in browser QA (empty state, picker filled, toolbar structure). Production before-state matched prior Ukrainian review notes (broken `vs {name}`, duplicate save, raw taxonomy).

---

## P0 — bugs fixed

### 1. i18n interpolation

- **EN / UA:** `convenience.compareWithLast` → `"vs {{name}}"`.
- **Quick compare dropdown:** was hardcoded `vs {name}`; now uses translation helper.

### 2. Duplicate save

- Removed second ghost save from results header.
- **Single primary:** `SaveResearchButton` with `research.saveToResearch` (“Save to Research”) in `compare-toolbar.tsx`.
- `SavedSearchesChips` on compare does not add another save action.

---

## P1 — UX improvements

### Creator pickers

- **One combobox per slot** (`creator-picker.tsx`): search, keyboard-friendly list, clear (X), placeholder “Search creators…”.
- Compare button disabled until two distinct creators; helper text from `compare.selectTwo` / `compare.pickDifferent`.

### Results toolbar hierarchy

| Tier | Actions |
|------|---------|
| Primary | Save to Research |
| Secondary | Copy summary, Study {{name}} (×2) |
| Overflow | More → Quick compare (per creator) |

### Humanization layer

**File:** `frontend/lib/compare-display-copy.ts`

- `humanizeHookType` / `humanizeHookList` — maps API tokens (`transformation:from_to`, etc.) to `compare.hookLabel.*` strings.
- `formatTitleMeta` — title battle subtitle without curiosity-score jargon.
- `formatTopicOverlapMessage` — sentence-level topic similarity (low / medium / high bands).
- `isGrowthLikelyFlat` — triggers `compare.growthFlat` copy when 7d growth displays as 0%.

Backend values unchanged; display-only.

### Flat growth copy

When overview shows `growth_7d_pct` as `0.0%` for both (API still returns `velocity 0/day` internally; labels renamed to “Recent growth” / “View pace” in UI):

> “No meaningful view changes detected between recent updates yet…”

Verified API sample (Dan Martell vs Alex Hormozi): both `growth_7d_pct` = `0.0%` → flat message should appear once comparison loads.

---

## P2 — polish

### Empty state

- Subtitle + 3 onboarding bullets (`onboarding1`–`3`).
- Hidden after first successful compare (reduces noise).

### Copilot sidebar

- Compare route: `context = "compare"` in `copilot-route-sync.tsx`.
- Trend brief hidden on compare (same pattern as feed).
- Page calls `setCollapsed(true)` so main content gets width on desktop.

### Visual hierarchy

1. Toolbar headline (creator A vs B)
2. **At a glance** (`primary` section — larger title, no top border)
3. Growth → Hooks → Audience → Topic similarity → Fast-growing videos → Top-performing titles
4. Sections use top dividers + descriptions instead of repeated card chrome.

### Language cleanup (EN + UA)

| Removed / reduced | Replaced with |
|-------------------|---------------|
| Semantic overlap | Topic similarity |
| Velocity (label) | View pace / Темп переглядів |
| Snapshot jargon in breakouts | “Fast-growing videos” + human empty state |
| Breakout rate (label) | Breakout videos |
| 2+ snapshot days | Plain sync guidance |

Full `compare.*` block updated in `en.ts` and `uk.ts`.

---

## P3 — mobile + scanning

**Code review (not full device lab):**

- `max-w-3xl sm:max-w-[44rem]` column reduces wall-of-cards feel.
- Toolbar `flex-wrap` for actions; combobox grid `sm:grid-cols-2`.
- Overview table `min-w-[480px]` + horizontal scroll on narrow viewports.
- Charts remain `h-52` dual column → stacks at `lg` breakpoint.

**Remaining:** Long creator names in toolbar headline may wrap awkwardly on very small screens; Study creator buttons are verbose (includes full name).

---

## QA checklist

| Step | Result |
|------|--------|
| Open `/compare` | ✅ Empty state, onboarding, collapsed copilot (local) |
| Empty state UX | ✅ Helper + bullets; Compare disabled with explanation |
| Dan Martell vs Alex Hormozi | ⚠️ API ✅ via curl; UI blocked locally by CORS (`frontend` on `:3002`, `CORS_ORIGINS` defaults to `:3000`) |
| EN locale | ✅ Strings render in browser |
| UA locale | ✅ Keys mirrored in `uk.ts` (not re-clicked in browser after CORS failure) |
| Desktop layout | ✅ Narrow column, section dividers observed in code + empty/picker screenshots |
| Mobile | ⚠️ Not device-tested; responsive classes present |
| Actions (save, copy, links) | ✅ Wired in toolbar; not clicked end-to-end due to fetch failure |
| Backend regressions | ✅ None intended; compare endpoint unchanged |
| Numbers vs API | ✅ Overview values match curl for test pair (see below) |

### API ↔ UI number check (Dan Martell vs Alex Hormozi, `depth=core`)

| Signal | A | B | Notes |
|--------|---|---|-------|
| subscribers | 2,710,000 | 4,180,000 | Display formatting from API strings |
| avg_views | 496,380 | 476,902 | |
| growth_7d_pct | 0.0% | 0.0% | Should show `growthFlat` message |
| title battle hook (sample) | `emotional` | — | UI shows humanized “Emotional titles” |
| topic overlap | 25.4% | — | UI: medium-band sentence (~25%) |

---

## Files touched

- `frontend/app/compare/compare-client.tsx`
- `frontend/components/compare/compare-toolbar.tsx` (new)
- `frontend/components/compare/creator-picker.tsx` (new)
- `frontend/components/compare/compare-section.tsx` (new)
- `frontend/components/compare/compare-sections.tsx`
- `frontend/lib/compare-display-copy.ts` (new)
- `frontend/components/convenience/quick-compare.tsx`
- `frontend/components/copilot/copilot-route-sync.tsx`
- `frontend/components/copilot/copilot-context.tsx`
- `frontend/components/copilot/copilot-panel.tsx`
- `frontend/lib/i18n/locales/en.ts`, `uk.ts`

---

## Remaining weak spots

1. **Production deploy** — Site returned 502 immediately after local `docker compose up`; redeploy / proxy check needed before live screenshot parity.
2. **Local QA friction** — Map `CORS_ORIGINS` to `:3002` or standardize frontend port to `:3000` for dev.
3. **Toolbar on mobile** — Five controls before overflow; consider hiding one Study link behind More on `xs`.
4. **Overview table** — Still tabular/dashboard-like; acceptable for “at a glance” but least “creator-friendly” section.
5. **Momentum winner** — Removed from UI chips (was technical); OK unless product wants a plain-language “who’s picking up speed” line back.
6. **Saved searches chips** — Still below toolbar; low visual weight but adds a second row of affordances.

---

## Final verdict

**Does Compare now feel like a polished creator research workspace instead of an internal analytics dashboard?**

**Yes, with caveats.** Copy, picker UX, toolbar hierarchy, hook humanization, flat-growth explanation, copilot collapse, and section rhythm all move the page toward a calm research tool. The overview table and chart blocks still expose metrics, but framing (“At a glance”, topic sentences, title battle context) shifts the narrative to learning.

**Ship when:** production is healthy, CORS matches frontend origin, and one full compare run is confirmed in EN + UA on desktop and mobile.
