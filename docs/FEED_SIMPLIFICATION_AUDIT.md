# Feed UX & copy simplification audit

**Target:** https://tm1.website/feed  
**Date:** 2026-05-20  
**Scope:** Product language, onboarding, hierarchy — **no** scoring, ranking, or API changes.

---

## Goal

The feed should feel like a **research assistant** (“what should I study today?”), not an analytics dashboard.

---

## Before vs after (examples)

| Area | Before | After |
|------|--------|-------|
| Page title | Daily research briefing | **Research picks for today** |
| Page subtitle | …Postgres snapshots… deterministic… | **Ideas from videos and comments in your workspace** |
| Hero label | Today’s lead / highest-ranked signal | **Start here** |
| Hero title | Audience theme: curiosity… (8 synced comments in theme) | **Viewers keep asking curious follow-up questions** |
| Hook card | Identity hooks outperform catalog hook average (2.1×, 162 indexed) | **Titles built around personal identity perform well in your library** |
| Creator card | Dan Martell exceeds catalog median (16.5×…) | **Dan Martell repeatedly outperforms most creators you track** |
| Section: hooks | Underused winning patterns + hook taxonomy hint | **Title formats worth testing** — “Find title formats that work” |
| Section: audience | High-engagement comments… synced audience data | **What viewers reacted to** — “Study what viewers emotionally react to” |
| Onboarding | Collapsible glossary (signals, snapshots, 15+ lines) | **3 bullets** + one sync line |
| Operational | Amber + blue banners, snapshot/Sheets jargon | **One or two short sentences** (growth pending, comment count) |
| Actions | Compare hooks / Inspect audience reactions | **See winning title examples** / **See what viewers said** |
| Hero footer | why_appeared + evidence points + 3 bullets | **One optional metric line** (likes · example videos) |
| Header meta | 13 candidates scored · snapshot days | **Removed** — only “6 ideas · 12,522 videos in workspace” |

---

## Technical approach (display-only)

- API payloads unchanged (`title`, `summary`, `why_appeared`, scores, etc.).
- New `frontend/lib/feed-display-copy.ts` maps `FeedItem` → human card copy via i18n `feed.copy.*`.
- `toInsightFromItem(..., t)` applies copy in `feed-briefing.ts` / `feed-curate.ts`.
- `why_appeared` hidden in UI; save-to-research still stores raw API payload.

**Data parity:** Rank order, links (`/videos/7094`, `/hooks`, `/creators/…`), and counts (8 comments, 46 total, Dan 187 videos) unchanged — only labels changed.

---

## Confusing copy removed

- deterministic, Postgres, snapshot window, indexed, catalog median, baseline, outlier, evidence points, signals (as a noun in UI), breakouts enabled, candidates scored
- Long glossary in onboarding
- Per-section “sectionHints” duplicate lines
- Hero `leadHint` and technical `why_appeared` block
- “Why it matters” label on secondary cards (description + metric only)

---

## Onboarding improvements

**How to use this page** (collapsed by default):

1. Find ideas worth studying today  
2. Discover title formats that work in your library  
3. Save useful patterns to Research  

Footer: *Based on videos and comments already synced into your workspace.*

---

## Information hierarchy

1. Page title + one-line purpose  
2. Optional how-to (3 bullets)  
3. “What to explore today” + idea count  
4. Honesty line (if growth/comments thin) — single paragraph  
5. **Start here** hero  
6. **Then explore** numbered path  
7. Section groups with action-oriented subtitles  

Removed: InfoTip on briefing header, briefingSnapshots debug line, stacked amber/blue notice boxes.

---

## Remaining mildly technical areas

| Item | Why it remains | Suggestion later |
|------|----------------|------------------|
| Research path step titles | Still use humanized titles from copy layer | OK |
| “Save signal” button | Research product term | Rename to “Save to Research” if not already |
| Compare with… | Compare feature name | OK |
| English card body on UA locale | Some API `description` fields still English when copy layer misses category | Extend `humanizeFeedItem` for all categories |

---

## First-time user verdict

**Before:** Felt like reading a QA report — numbers, taxonomy, and system internals in the first screen.

**After:** In ~5 seconds a user can read: *research picks from my library → start here → explore titles / reactions / creators → save to Research.* Limitations (few comments, no growth yet) are one plain sentence, not a dashboard alert.

**Still honest:** No live-trending implication; workspace/sync framing instead of “not live YouTube” negation.

---

## Files changed

- `frontend/lib/feed-display-copy.ts` (new)
- `frontend/lib/feed-curate.ts`, `frontend/lib/feed-briefing.ts`
- `frontend/components/feed/feed-how-to-use.tsx`
- `frontend/components/feed/feed-operational-notices.tsx`
- `frontend/components/feed/feed-header.tsx`
- `frontend/components/feed/feed-hero.tsx`
- `frontend/components/feed/feed-insight-block.tsx`
- `frontend/components/feed/feed-research-path.tsx`
- `frontend/lib/i18n/locales/en.ts`, `uk.ts`
- `frontend/lib/glossary.ts`

---

## Screenshots reviewed

Production `/feed` (EN): shortened header, 3-bullet how-to, plain hero title, combined notice line, section titles “What viewers reacted to” / “Title formats worth testing” / “Creators to learn from”.

---

## Regression checklist

- [ ] Feed loads; 6 ideas + hero  
- [ ] Hero links to `/videos/7094` (curiosity)  
- [ ] Hook cards link to `/hooks`  
- [ ] Creator cards link to `/creators/Dan Martell`  
- [ ] Save to research payload still includes raw `FeedItem`  
- [ ] UK locale strings present for `feed.copy.*`
