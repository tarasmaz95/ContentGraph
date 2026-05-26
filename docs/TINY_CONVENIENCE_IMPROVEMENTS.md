# Tiny Convenience Improvements (Phase 9)

Internal workflow polish for a 2–3 person team. No new backend systems, auth, or product scope.

## Keyboard shortcuts

Global listener in `frontend/components/convenience/keyboard-shortcuts.tsx` (mounted via `AppProviders`).

| Shortcut | Action |
|----------|--------|
| `/` | Focus semantic search (`#cg-semantic-search-input`); navigates to `/dashboard` if needed |
| `g` then `c` | Go to `/creators` |
| `g` then `f` | Go to `/feed` |
| `g` then `d` | Go to `/dashboard` |
| `g` then `r` | Go to `/research` |
| `g` then `h` | Go to `/hooks` |
| `c` | Open `/compare` |
| `s` | Open command palette |
| `Esc` | Close palette / blur focused field |
| `⌘K` / `Ctrl+K` | Command palette (existing) |

Shortcuts are ignored while typing in inputs, textareas, or contenteditable fields.

## localStorage keys

| Key | Purpose |
|-----|---------|
| `cg:pinned-creators` | Up to 12 creator names (nav bar + quick compare) |
| `cg:saved-searches` | Up to 24 saved semantic queries or compare presets |
| `cg:last-compare-partner` | Last Creator B for 1-click “vs {name}” |

Helpers: `frontend/lib/convenience-storage.ts`.

## Copy / export

Markdown summaries for Telegram / Notion via `frontend/lib/copy-summaries.ts` and `CopyButton` + toast (“Copied ✓”).

| Surface | Copy target |
|---------|-------------|
| Compare page | Full compare summary (overview, winners, semantic overlap, title battles) |
| Creator page | Intel summary, hooks, audience, breakouts |

No PDF or report pipeline.

## Quick compare

`QuickCompare` on creator pages, feed cards (when `creator_name` present), and compare results header.

- Remembers last partner in `cg:last-compare-partner`
- Pinned creators appear in the picker dropdown
- Navigates to `/compare?a=…&b=…`

## Pinned creators

`PinCreatorButton` on creator dashboards; chips in `PinnedCreatorsBar` (desktop nav). Persists across refresh via `cg:pinned-creators`.

## Saved searches

`SavedSearchesChips` on dashboard semantic search and compare results:

- **Semantic:** label + query string; click chip re-runs search
- **Compare:** label + `creatorA|creatorB`; click chip reloads comparison

## Transcript UX

`TranscriptIntelligence` (client component):

- Copy full preview text
- Collapse / expand transcript body
- Keyword highlight when opened with `?highlight=<query>` from semantic results
- Auto-scroll to first highlighted match

Semantic results table highlights transcript matches (badge + snippet styling).

## Comments sorting & filters

On video intelligence pages — deterministic only:

**Sort:** top liked, newest, emotional (tag count), longest

**Filter:** all, positive, negative, fear (text + skepticism tags), ambition (motivation/inspiration/excitement + keywords)

Uses stored `sentiment` and `emotional_tags` from ingestion — no AI moderation.

## UX polish (light)

- Sticky compare results header (`top-14` under nav)
- Compare table horizontal scroll (existing)
- Consistent empty states on comments section
- Feed / compare quick actions without layout redesign

## Navigation structure (desktop)

Top bar uses **primary links** plus a **More ▾** dropdown so the nav never scrolls horizontally on laptop widths.

### Primary (always visible)

Daily research workflows:

| Item | Route |
|------|--------|
| Dashboard | `/dashboard` |
| Feed | `/feed` |
| Creators | `/creators` |
| Compare | `/compare` |
| Research | `/research` |
| Chat | `/chat` |

### Secondary (More ▾)

Utilities and less frequent tools:

| Item | Route | Rationale |
|------|--------|-----------|
| Analytics | `/analytics` | Periodic review, not every session |
| Hooks | `/hooks` | Deep hook lab |
| Scripts | `/scripts` | Content generation |
| Extension | `/extension` | Onboarding / install (not daily) |
| Settings | `/settings` | Configuration |

Implementation: `frontend/components/layout/nav.tsx`, `nav-more-menu.tsx`. Dropdown closes on outside click or `Esc`. Active route highlights both primary links and the matching More item (More button shows active when any secondary route is open).

Command palette and keyboard shortcuts (`g` chords, `/`, `s`, `⌘K`) are unchanged — all routes remain reachable.

Pinned creators, locale switcher, and search (⌘K) stay on the right; Settings is no longer a separate top-level button.

## Limitations

- All pins and saved searches are **per-browser** (localStorage only)
- No sync across devices or teammates
- Fear / ambition filters are heuristics on tags + keywords, not a separate taxonomy
- Transcript highlight uses preview text, not full transcript file in UI
- `g` chord times out after 1.2s if second key not pressed

## Verification checklist

1. `/` focuses semantic input on dashboard
2. `g`+`d`/`c`/`f` navigate correctly
3. Copy buttons produce clean markdown and show toast
4. Pin creator → refresh → still in nav
5. Save semantic search → chip re-runs query
6. Save compare → chip reloads A vs B
7. Video `?highlight=` expands transcript and scrolls to match
8. Comments sort/filter changes list without errors
9. Compare + research flows unchanged

## Files

| Area | Path |
|------|------|
| Storage | `frontend/lib/convenience-storage.ts` |
| Copy formats | `frontend/lib/copy-summaries.ts` |
| Shortcuts | `frontend/components/convenience/keyboard-shortcuts.tsx` |
| Toast | `frontend/components/convenience/toast-provider.tsx` |
| Pins / saved / quick compare | `frontend/components/convenience/*` |
