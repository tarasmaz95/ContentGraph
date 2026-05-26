# Feed product polish audit

**Target:** https://tm1.website/feed  
**Date:** 2026-05-20  
**Scope:** Visual hierarchy, spacing, CTA clarity — **no** backend, scoring, or copy-system changes.

---

## Verdict

**Does it feel like a polished research product instead of an internal analytics tool?**

**Yes — substantially.** The page now reads as a **curated briefing**: one clear lead, a lightweight step list, then supporting ideas separated by calm dividers — not a grid of equal-weight dashboard cards.

**Remaining dashboard energy (minor):** bottom prompt chips and Save-to-Research buttons still use utility styling; acceptable for MVP.

---

## Before vs after (visual)

| Element | Before | After |
|---------|--------|-------|
| **Layout width** | `max-w-5xl` (wide report) | `max-w-3xl` / `42rem` (editorial column) |
| **Hero** | Bordered gradient card, uppercase label, link row + border-top actions | **Accent line + large title**, primary filled CTA, secondary ghost buttons, metadata demoted to `text-xs` |
| **Research path** | Dashed border box, “another card” | **Timeline nav** — numbered steps, vertical connector, no container |
| **Section cards** | `rounded-lg border` on every insight | **Dividers only** — list rhythm, no per-card chrome |
| **Section headers** | Same weight as cards | **Separated band** with `pt-12` + top border before “More to explore” |
| **Onboarding** | Bordered collapsible panel | **Text-only disclosure** (chevron + muted label) |
| **Intro header** | `border-b` under briefing title | Borderless, smaller meta |
| **Vertical rhythm** | Uniform `space-y-10` | **14 / 16 / 12** spacing tiers (lead → path → sections) |

---

## Hierarchy improvements

1. **Hero** — Dominant type (`text-2xl`→`1.75rem`), left accent bar, single primary action with arrow.
2. **Suggested next steps** — Uppercase small label, timeline (not a card).
3. **Supporting sections** — Introduced by full-width rule; items scan as a list.
4. **Page chrome** — How-to + meta de-emphasized above the fold; hero is first “content” block after brief intro.

---

## Visual simplifications

- Removed: hero gradient box border, dashed path container, insight card borders/backgrounds, section hint duplicates, hero `whyMatters` duplicate line, research path hint paragraph, how-to sync note in panel (kept in page description).
- Softened: operational notice size (`13px`, muted).
- Aligned: section content indented with `sm:pl-6` to match hero/path column.

---

## CTA improvements

| Key | Before | After |
|-----|--------|-------|
| `openVideo` | Watch the example | **Watch example** (hero: primary button) |
| `openCreator` | Open creator | **Study this creator** |
| `inspectAudience` | See what viewers said | **Read viewer reactions** |
| `exploreHooks` | See winning title examples | **See title examples** |
| Secondary cards | All equal text links | **One soft filled chip** + muted text links |

Hero: first action = primary button; rest = secondary. Cards: compact `h-8` primary chip.

---

## Screenshots reviewed

Production `/feed` (EN) after deploy:

- Narrower column, hero without card chrome.
- “Suggested next steps” timeline between hero and sections.
- “What viewers reacted to” / “Title formats worth testing” as divider lists.
- Primary “Watch example” on hero.

---

## QA checklist

| Check | Result |
|-------|--------|
| Feed loads | ✓ |
| Hero link `/videos/7094` | ✓ |
| Research path links | ✓ |
| Hook → `/hooks` | ✓ |
| Creator → `/creators/…` | ✓ |
| Save to Research | ✓ (unchanged payload) |
| Mobile layout | ✓ stacks CTAs; timeline readable |
| Data/copy layer | ✓ unchanged (`feed-display-copy`) |

---

## Remaining weak spots

1. **PageHeader** still uses newspaper icon + `text-3xl` — competes slightly with hero; acceptable.
2. **Prompt chips** at bottom feel “tooling” — could move to sidebar later.
3. **Save to Research** on every row — necessary but adds button noise; hero save is correctly de-emphasized via `ml-auto`.
4. **QuickCompare** under creator rows — small utility widget; fine for power users.

---

## Files changed

- `frontend/app/feed/page.tsx` — layout rhythm, width
- `frontend/components/feed/feed-hero.tsx`
- `frontend/components/feed/feed-research-path.tsx`
- `frontend/components/feed/feed-insight-block.tsx`
- `frontend/components/feed/feed-research-section.tsx`
- `frontend/components/feed/feed-header.tsx`
- `frontend/components/feed/feed-how-to-use.tsx`
- `frontend/components/feed/feed-operational-notices.tsx`
- `frontend/lib/i18n/locales/en.ts`, `uk.ts` — action labels, path title

---

## First-time user read (5 seconds)

1. **Research picks for today** — what this page is.  
2. **Start here** — one big idea.  
3. **Watch example** — obvious first click.  
4. **Suggested next steps** — where to go next.  
5. Scroll — themed sections, not a wall of identical widgets.

**Honest:** Still workspace/sync-based; polish does not fake live trends.
