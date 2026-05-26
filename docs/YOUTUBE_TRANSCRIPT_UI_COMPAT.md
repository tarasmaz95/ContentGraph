# YouTube Transcript UI Compatibility (Extension)

**Extension version:** `0.1.1` — transcript DOM compatibility for new "In this video" UI.

**Scope:** DOM selectors and manual QA for `extension/content.js` transcript extraction only.  
**Backend:** Unchanged — still `POST /api/v1/transcripts/ingest` via `SAVE_TRANSCRIPT`.

---

## Supported layouts

| Layout ID | Where it appears | Detection |
|-----------|------------------|-----------|
| `search-panel` | Side engagement panel (searchable transcript) | `ytd-transcript-search-panel-renderer` |
| `engagement-panel` | Engagement panel target | `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]` |
| `segments-container` | Any visible `#segments-container` | `#segments-container` |
| `legacy-renderer` | Older transcript renderer | `ytd-transcript-renderer` |
| `legacy-body` | Transcript body fallback | `ytd-transcript-body-renderer` |
| `description-transcript` | Description-area transcript block | `ytd-video-description-transcript-section-renderer` |
| `in-this-video-description` | **New:** inline under description | Same section renderer + segments |
| `in-this-video` | **New:** "In this video" structured description | Text match + `#segments-container` in panel |
| `segments-container-hidden` | Segments in DOM but panel not visible | `#segments-container` with children |

The extension tries **old panel selectors first**, then **"In this video"** inline UI, then global `#segments-container` fallback.

---

## Selectors used

### Open / navigate

| Action | Selectors / logic |
|--------|-------------------|
| Expand description | `tp-yt-paper-button#expand`, buttons with text `more` / `...more` |
| Show transcript | `button[aria-label="Show transcript"]`, any `button[aria-label*="transcript"]` (case-insensitive filter in JS) |
| Description block | `ytd-video-description-transcript-section-renderer button` |
| Transcript tab (vs Chapters) | Tabs with label/text matching `Transcript` inside engagement/description/watch-metadata scopes |

### Root containers

```
ytd-transcript-search-panel-renderer
ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]
#segments-container
ytd-transcript-renderer
ytd-transcript-body-renderer
ytd-video-description-transcript-section-renderer
ytd-structured-description-content-panel (when text contains "In this video")
```

### Row extraction (scoped to root, then document)

```
#segments-container ytd-transcript-segment-renderer .segment-text
#segments-container ytd-transcript-segment-renderer yt-formatted-string
ytd-transcript-segment-renderer yt-formatted-string.segment-text
ytd-transcript-segment-renderer .segment-text
ytd-transcript-segment-renderer #content yt-formatted-string
ytd-transcript-segment-list-renderer yt-formatted-string
.ytd-transcript-segment-renderer .segment-text
```

### Segment container walk (gist-style)

For each child of `#segments-container`:

- Skip `YTD-TRANSCRIPT-SECTION-HEADER-RENDERER`
- Read `.segment-text` or `yt-formatted-string`
- Strip leading timestamps (`0:12`, `1:02:03`)
- Skip timestamp-only lines

### Fallback

`ytd-transcript-body-renderer` → full `innerText` (legacy)

---

## Status messages (ContentGraph panel)

| Message | Meaning |
|---------|---------|
| `Transcript panel detected (layout-id)` | Root container found before scrape |
| `Transcript panel not detected — extracting anyway…` | No root; still attempts global selectors |
| `Transcript rows found: N` | N segment lines extracted |
| `No transcript rows found` | Panel seen but zero rows |
| `No transcript panel detected — …` | No container; user must open transcript UI |
| `N rows · X characters extracted` | Success |

---

## Known YouTube UI variations

| Variation | Notes |
|-----------|--------|
| **Side panel vs inline "In this video"** | New UI keeps transcript under description with **Chapters \| Transcript** tabs; extension clicks **Transcript** when needed. |
| **Lazy load** | Segments render only after transcript is opened; user may need to wait 1–2s before **Extract**. |
| **Chapters tab default** | Rows empty until Transcript tab is active — `ensureTranscriptTabActive()` handles this. |
| **Section headers** | Chapter headers in segment list are skipped (not concatenated as speech). |
| **Auto-generated vs manual captions** | Both use same DOM; language picker not automated in MVP. |
| **Shorts / live** | Not targeted (`manifest` matches `watch*` only). |
| **Regional / A/B layouts** | YouTube may rename custom elements; `#segments-container` + `.segment-text` are the most stable anchors. |

---

## Manual verification steps

### 1. Rebuild and install

```bash
./scripts/build-extension-zip.sh
```

- **Load unpacked:** `chrome://extensions` → reload extension pointing at `extension/`
- **Or** download from `https://tm1.website/extension` after frontend deploy

### 2. Old layout (side transcript panel)

1. Open a long-form YouTube video with captions.
2. Click **Show transcript** (description) so the side/bottom transcript panel opens.
3. Open ContentGraph panel → **Extract**.
4. Expect: `Transcript panel detected (search-panel|engagement-panel|legacy-*)` → `Transcript rows found: N` → character count.

### 3. New layout ("In this video")

1. Open a video with the **In this video** block under the player.
2. Expand description (**...more**) if collapsed.
3. Click **Transcript** tab (not Chapters).
4. Wait until caption lines are visible.
5. **Extract** without re-opening side panel.
6. Expect: `Transcript panel detected (in-this-video*|description-transcript)` and rows > 0.

### 4. Save to catalog

1. Use a video that exists in ContentGraph (Sheets sync).
2. **Save** after successful extract.
3. Confirm status: `Saved to video #…`
4. Verify in app: `/videos/{id}` transcript section populated.

### 5. Regression — comments

1. Scroll to **Top comments**.
2. **Extract comments** → **Save comments**.
3. Confirm comments flow unchanged (separate code path).

### 6. Debug in DevTools (optional)

On watch page with transcript visible:

```javascript
document.querySelectorAll('#segments-container ytd-transcript-segment-renderer').length
document.querySelector('ytd-transcript-search-panel-renderer, ytd-video-description-transcript-section-renderer')
```

---

## Rebuild command

```bash
./scripts/build-extension-zip.sh
```

Output: `frontend/public/downloads/contentgraph-extension.zip` + `extension-meta.json`.

---

## References

- [insin transcript gist](https://gist.github.com/insin/cb938324866c511066bcabe230b6a625) — `#segments-container` walk
- `docs/TRANSCRIPT_EXTENSION_ARCHITECTURE.md` — ingest flow
- `docs/COMMENTS_FEATURE_VERIFICATION.md` — comments path (unchanged)
