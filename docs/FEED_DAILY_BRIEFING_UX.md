# Daily Research Briefing UX

Product redesign for `/feed` — answers **“What should we study today?”** without new AI, LangGraph, or backend pipeline changes.

## Information hierarchy

1. **Page framing** — title + “What should we study today?” + snapshot honesty banner
2. **Hero insight** — single strongest lead (full width, editorial)
3. **Suggested research path** — 3–4 deterministic steps from hero + section leads + Research workspace
4. **Research sections** — 1–2 blocks each, empty sections omitted

### Research sections (frontend mapping)

| API `category` | Section ID | Label |
|----------------|------------|--------|
| `breakout`, `creator_growth` | `accelerated` | What accelerated |
| `audience` | `audience` | What audiences reacted to |
| `hook_pattern` | `patterns` | Underused winning patterns |
| `creator_strength` | `creators` | Creators worth studying |
| (derived) | `themes` | Emerging themes |

**Emerging themes** — deterministic: first `audience` item with `audience_theme` and `supporting_creators.length >= 2`, rewritten as a cross-channel pattern block (max 1).

## Hero selection (frontend)

```text
if briefing.has_snapshot_history:
  pick highest final_score among breakout + creator_growth
else:
  pick highest final_score among all items
exclude hero id from section buckets
```

No LLM. Uses existing `final_score`, `category`, and `FeedBriefingMeta.has_snapshot_history`.

## Section order

- **With snapshots:** accelerated → audience → patterns → themes → creators
- **Catalog only:** audience → patterns → creators → themes (accelerated usually empty)

Max **2** insights per section (hero is separate).

## Research path

1. Hero title (link if `href`)
2. First insight per section in order (until 4 steps)
3. If fewer than 4 steps, append “Save patterns into Research workspace” → `/research`

## What changed

### Frontend

- `lib/feed-briefing.ts` — layout, hero, sections, path
- `lib/feed-curate.ts` — shared `CuratedInsight`, actions (incl. `inspectAudience`)
- `components/feed/feed-hero.tsx`, `feed-insight-block.tsx`, `feed-research-section.tsx`, `feed-research-path.tsx`, `feed-snapshot-notice.tsx`
- `app/feed/page.tsx` — briefing layout
- i18n `feed.researchSections.*`, briefing copy (en + uk)

### Backend

**Unchanged** — `GET /api/v1/copilot/feed`, scoring, ranker, save-to-research payloads.

### Unchanged integrations

- Save to Research
- Compare (QuickCompare)
- Hooks / audience / video links from `FeedItem.href`
- Snapshot gating in `FeedBriefingMeta`

## Example copy (live catalog, no snapshots)

**Hero (creator_strength):**  
Headline from API `title` · Subtext from `description` · Evidence from `summary` + `evidence_count`

**Snapshot notice:**  
“Momentum insights need several days of daily snapshots…”

**Research path:**  
1. [Hero title] → creator/video  
2. [Audience lead]  
3. [Hook pattern lead]  
4. Save patterns into Research workspace

## Operational note

Run **daily snapshots** for ≥2–7 days so `breakout` / `creator_growth` populate hero and “What accelerated”. Until then, briefing honestly leans on creators, audience, and hooks.
