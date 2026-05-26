# YouTube Transcript Extraction — Debug QA

**Extension version:** `0.1.2`  
**Scope:** Transcript DOM only (`extension/content.js`). Comments unchanged.

---

## What changed (0.1.2)

| Area | Change |
|------|--------|
| Shadow DOM | `queryAllDeep()` walks open shadow roots for segment text |
| Visibility | Panel detection no longer requires visible box if segment nodes exist |
| Layouts | `Subtitles (hidden)`, `In this video`, expanded engagement panel |
| Segment nodes | `ytd-transcript-segment-renderer`, `ytd-transcript-segment-view-model` |
| Timing | 5s poll retry + 1.2s `MutationObserver` after Transcript tab click |
| Debug | `console.log("[ContentGraph transcript]", …)` on every extract |
| Status | Waiting / retrying / detailed fail reason in panel |

---

## Supported layouts

1. **Legacy side panel** — `ytd-transcript-search-panel-renderer`, `#segments-container`
2. **Engagement panel (expanded)** — `ytd-engagement-panel-section-list-renderer[visibility*="EXPANDED"]`
3. **Description transcript** — `ytd-video-description-transcript-section-renderer`
4. **In this video** — structured description + **Transcript** tab
5. **Subtitles (hidden)** — label match + segments in same host (visibility not required)

---

## Selectors (priority order)

### Root detection

- `ytd-engagement-panel-section-list-renderer[visibility*="EXPANDED"]`
- `ytd-transcript-search-panel-renderer`
- `ytd-video-description-transcript-section-renderer`
- `#segments-container` (any, if children / segments exist)
- Labels: text matching `Subtitles`, `In this video`, `Transcript`

### Row extraction

1. Global segment nodes → `getSegmentText()` per node (light + shadow DOM)
2. `#segments-container` child walk (skips section headers)
3. CSS row selectors (`.segment-text`, `yt-formatted-string`, etc.)
4. `#segments-container` `innerText` line split (fallback)
5. `ytd-transcript-body-renderer` full text (legacy)

---

## Runtime debug logs

Open DevTools → **Console** on the YouTube watch tab. Filter: `ContentGraph transcript`.

| Log | Meaning |
|-----|---------|
| `extract started` | User clicked Extract |
| `findTranscriptRoot:` | Panel root + layout id |
| `ensureTranscriptTabActive: clicked tab` | Transcript tab was clicked |
| `scrape:` | `{ rootFound, layout, domSegmentNodes, rowCount, method }` |
| `attempt N:` | Poll retry debug object |
| `final:` | Outcome: attempts, lazyLoaded, chars |

### Panel status messages

| Status | Meaning |
|--------|---------|
| `Transcript panel detected (layout)` | Root container found |
| `Transcript rows in DOM (N)` | Segment nodes exist, panel root unclear |
| `Waiting for transcript rows…` | Polling up to 5s |
| `Retrying transcript extraction…` | Poll attempt > 1 |
| `Transcript rows found: N (lazy-loaded)` | Success after delay |
| `No transcript rows found — layout=…; dom_nodes=…; rows=0; …` | Fail with reason |

---

## Known YouTube UI variations

| Variation | Behavior |
|-----------|----------|
| **Chapters default tab** | Extension clicks **Transcript** tab before wait |
| **Subtitles (hidden)** | Title may say "hidden"; rows still in DOM — we do not require panel visible |
| **Shadow DOM segment text** | Text inside closed component tree — deep query required |
| **Lazy render** | Rows appear after tab switch — 5s poll + MutationObserver |
| **Section headers** | Skipped in container walk |
| **No captions** | `dom_nodes=0` — expected fail |

---

## Manual verification steps

### 1. Install build

```bash
./scripts/build-extension-zip.sh
```

Reload unpacked extension or download from `/extension` (after frontend deploy).

### 2. New UI path (Subtitles + In this video)

1. Open a YouTube video **with captions**.
2. Expand description if needed.
3. Open **In this video** → **Transcript** tab (rows visible).
4. Open ContentGraph panel → **Extract**.
5. **Expect:** `Transcript panel detected` → `Transcript rows found: N` → preview filled.
6. **Console:** `method=global-segment-nodes` or `#segments-container > children`.

### 3. Lazy-load check

1. Switch to **Chapters**, then click **Transcript** manually.
2. Immediately click **Extract** (within 1s).
3. **Expect:** `Waiting for transcript rows…` then success within 5s.

### 4. Fail diagnosis

If extract fails, copy from console:

```
scrape: { rootFound, layout, domSegmentNodes, rowCount, method }
```

| dom_nodes | rowCount | Likely issue |
|-----------|----------|----------------|
| 0 | 0 | Transcript not open / no captions |
| >0 | 0 | Selector/shadow issue — report layout + screenshot |
| >0 | >0 | Should succeed — check catalog save separately |

### 5. Comments regression

Extract + save comments on same page — must still work.

---

## Rebuild & deploy

```bash
./scripts/build-extension-zip.sh
# Production UI serves zip from frontend image:
docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend
```

---

## Related docs

- [YOUTUBE_TRANSCRIPT_UI_COMPAT.md](./YOUTUBE_TRANSCRIPT_UI_COMPAT.md) — layout overview (0.1.1)
- [TRANSCRIPT_EXTENSION_ARCHITECTURE.md](./TRANSCRIPT_EXTENSION_ARCHITECTURE.md) — ingest API
