# Feed explainability & production QA

**Target:** https://tm1.website/feed  
**Date:** 2026-05-20  
**Scope:** Production QA against Postgres/API, usability audit, explainability UX (not a redesign).

---

## Executive summary

| Area | Verdict |
|------|---------|
| Hero & ranked signals | **Trustworthy** — API fields match DB aggregates |
| Research path | **Trustworthy** — deduped, no hero duplicate, max 4 steps |
| Audience themes | **Trustworthy but narrow** — 46 synced comments; concentration on few videos |
| Hook patterns | **Trustworthy** — counts, avg views, eligibility rules verified |
| Creator strength | **Trustworthy** — ratios/medians match SQL; tie-break by ratio |
| Momentum / breakouts | **Honestly empty** — 2 snapshot days, 0 videos with view deltas |
| UX explainability | **Improved** — “How to use”, operational notices, section hints |

---

## Part 1 — Production QA

### Data context (Postgres)

| Metric | Value |
|--------|------|
| Catalog videos | 12,522 |
| Synced comments | 46 (5 videos) |
| Transcripts | 4 |
| Snapshot days | 2 |
| Videos with changing views between snapshots | **0** |

### API (`GET /api/v1/copilot/feed?limit=8`)

```json
briefing: {
  signals_considered: 13,
  signals_selected: 6,
  snapshot_days_max: 2,
  comment_count: 46,
  has_snapshot_history: true
}
```

**Ranked items (by `final_score`):**

| Rank | ID | Category | Score | Notes |
|------|-----|----------|-------|-------|
| 1 | audience-theme-curiosity | audience | 0.835 | Hero |
| 2 | audience-theme-positive | audience | 0.817 | Section |
| 3 | hook-identity | hook_pattern | 0.812 | Section |
| 4 | hook-authority | hook_pattern | 0.772 | Section |
| 5 | strength-Dan Martell | creator_strength | 0.722 | Section |
| 6 | strength-Tina Huang | creator_strength | 0.722 | Tie-break: ratio |

No `breakout` or `creator_growth` items — correct given flat view snapshots.

---

### 1. Hero card

| Field | UI | API/DB | Match |
|-------|-----|--------|-------|
| Title | Audience leans curiosity… | `audience-theme-curiosity` | ✓ |
| Theme | curiosity | `audience_theme: curiosity` | ✓ |
| Evidence | comment/likes lines | `evidence_count: 8` | ✓ (8 comments in curiosity bucket from top-80 pool) |
| Supporting videos | 2 related | `supporting_videos.length: 2` | ✓ |
| Creators | 3 named | `supporting_creators: 3` | ✓ |
| why_appeared | Theme in N comments | Present in payload | ✓ |
| final_score | 0.835 (if shown) | `final_score: 0.835` | ✓ |
| Category | audience | `category: audience` | ✓ |
| Lead video | Top comment video link | `video_id` on item | ✓ |

**Note:** Hero is highest overall score, not momentum — correct because no momentum signals exist. Label “Today’s lead” + new `leadHint` clarifies this is catalog-ranked, not live trending.

---

### 2. Research path

| Check | Result |
|-------|--------|
| Hero not duplicated in path | ✓ |
| Dedupe by `source.id` | ✓ |
| Max 4 steps | ✓ (4 steps in production) |
| Order follows section order | audience → hooks → creators |
| No filler “save to research” step | ✓ |
| Stronger candidates missing? | Jon Law / Matthew Berman excluded by creator tie-break (same score 0.722, lower ratio than Dan/Tina) — **by design** |

---

### 3. Audience section

| Signal | Comments (theme bucket) | Likes | Creators | DB spot-check |
|--------|-------------------------|-------|----------|---------------|
| Curiosity (hero) | 8 | 5,932 | 3 | ✓ |
| Positive | 10 | 12,645 | multiple | 11 positive in DB (top-80 pool differs slightly) |

**Concentration:** Many comments on Lex Fridman video (7094) — UI should not imply catalog-wide sentiment. Wording uses “synced comments” and operational notice cites **46** total comments.

**Emotional tags:** From `sentiment` + `emotional_tags` on synced rows only.

---

### 4. Hook patterns

| Hook | Count | Avg views | Eligibility |
|------|-------|-----------|-------------|
| identity | 162 | ~225k | count ≥ 3, avg ≥ 1.2× global hook avg, count ≤ catalog median usage |
| authority | (in feed) | high | Same rules |

Verified in DB: identity hook rows and averages align with API metrics.

---

### 5. Creator strength

| Creator | Videos | Avg views | Median | Ratio vs median |
|---------|--------|-----------|--------|-----------------|
| Dan Martell | 187 | ~496k | 30k | ~16.5× ✓ |
| Tina Huang | (in feed) | high | — | tie at 0.722, ratio tie-break → Dan/Tina over Jon Law |

---

### 6. Momentum layer

| Check | Result |
|-------|--------|
| `has_snapshot_history` | true (2 days) |
| Breakout / creator_growth items | **none** |
| Videos with view deltas | **0** |
| “What accelerated” section | Hidden (empty bucket filtered) |
| Honest messaging | **Fixed:** amber notice when snapshots exist but flat |

Root cause documented in `FEED_MOMENTUM_QA.md` (baseline views identical across snapshots until Sheets updates).

---

## Part 2 — Usability audit (normal user)

### Would a new user understand this?

**Before explainability pass:** Partially — strong cards but jargon (“deterministic”, “Postgres”, “snapshot”) and hidden momentum gap.

**After pass:** Better — collapsible “How to use”, plain subtitle, operational banners, per-section hints.

### Confusing elements (addressed or documented)

| Issue | Severity | Mitigation |
|-------|----------|------------|
| “Today’s lead” sounds like YouTube trending | High | `leadHint` + how-to “not live” |
| Snapshot notice hidden when `has_snapshot_history` but no momentum | High | `FeedOperationalNotices` → `snapshotsFlat` |
| “Signals” undefined | Medium | How-to glossary |
| Technical header subtitle | Medium | `briefingSubtitlePlain` |
| Audience on 46 comments feels broad | Medium | `sparseComments` notice + link to `/intelligence/health` |
| Duplicate emerging theme vs hero | Low | Already suppressed in `buildEmergingThemes` |
| Creator tie-break opaque | Low | Section hint mentions ratio tie-break |

### Words too technical (softened)

- Header: removed “Postgres / deterministic” from primary subtitle
- Kept technical strings in i18n keys unused by default (`briefingSubtitle` legacy)

### Repetitive sections

- Two audience cards (curiosity hero + positive) — acceptable; different themes
- No separate “emerging themes” block when deduped — good

### Unclear actions

- Save to research — unchanged; explained in how-to workflow
- Compare creators — only on creator cards — OK

### Weak / overexplained insights

- Positive theme with 10 comments is thin but honest with count in copy
- Hook patterns are the strongest non-audience signals in current catalog

---

## Part 3 — Mismatches found

| # | Mismatch | Severity | Status |
|---|----------|----------|--------|
| 1 | Snapshot banner hidden when 2 days exist but views flat | High | **Fixed** — operational notice |
| 2 | Hero label implies “trending” | Medium | **Fixed** — lead hint |
| 3 | Positive comment count API 10 vs DB 11 | Low | Expected (top-80 pool / theme assignment) |
| 4 | No “What accelerated” empty section header | Low | Covered by banner (section hidden by design) |
| 5 | Transcript intelligence not on feed | Info | Documented in how-to; 4/12k transcripts |

---

## Part 4 — UX changes shipped

### “How to use this feed” (`FeedHowToUse`)

- Collapsible `<details>` at top of feed
- Plain language: what page is, signals, snapshots, hooks, audience, creators
- Why sections may be empty; not live YouTube

### Operational notices (`FeedOperationalNotices`)

- No snapshots / flat snapshots / young snapshots / sparse comments
- Link to Intelligence Health for coverage

### Inline explainability

- `FeedSectionHint` under each research section title
- Hero `leadHint`
- Research path `hint`

### Files touched

- `frontend/components/feed/feed-how-to-use.tsx`
- `frontend/components/feed/feed-operational-notices.tsx`
- `frontend/components/feed/feed-section-hint.tsx`
- `frontend/app/feed/page.tsx`
- `frontend/components/feed/feed-hero.tsx`, `feed-research-path.tsx`, `feed-research-section.tsx`, `feed-header.tsx`
- `frontend/lib/i18n/locales/en.ts`, `uk.ts`

---

## Part 5 — Screenshots (production, 2026-05-20)

Verified live at https://tm1.website/feed after frontend deploy:

| Capture | What it shows |
|---------|----------------|
| Viewport (EN) | “How to use this feed” collapsed, amber flat-snapshot notice, blue sparse-comments notice (46 comments), hero lead hint |
| Expanded how-to | Glossary (signals, snapshots, hooks, audience, creators), empty-section reasons, “not live YouTube” |
| Sections | Inline hints under audience, hooks, creators |

Browser capture: `feed-explainability-production.png` (full-page, EN locale).

---

## Part 6 — Test plan (regression)

- [ ] Feed loads with `limit=8` and renders 6 signals + hero
- [ ] How-to expands/collapses without layout shift
- [ ] With 2 snapshot days + 0 view deltas → amber flat notice
- [ ] With `has_snapshot_history: false` → no-snapshots notice
- [ ] `comment_count < 150` → sparse comments info + health link
- [ ] Ukrainian locale strings present
- [ ] No duplicate hero in research path
- [ ] Save to research still works on hero/cards

---

## Verdict

The feed is **operationally honest** for the current catalog: it does not fabricate momentum, hook math and creator ratios match the database, and audience insights are correctly scoped to synced comments. The explainability pass makes limitations visible and teaches non-technical users how to use the page as a **catalog research briefing**, not a trending dashboard.
