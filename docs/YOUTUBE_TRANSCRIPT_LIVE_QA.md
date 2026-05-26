# YouTube Transcript Live QA — Lex Fridman #456

**Date:** 2026-05-22  
**Extension version:** `0.1.3`  
**Test video:** https://www.youtube.com/watch?v=u321m25rKXc&t=1288s  
**Method:** Browser automation (CDP) + DOM probes; extension logic verified against live page.

---

## Executive summary

| Item | Result |
|------|--------|
| Transcript visible in UI | **PASS** — "In this video" panel, Transcript tab active |
| Old selectors (`ytd-transcript-segment-renderer`, `#segments-container`) | **FAIL** — count **0** |
| New selectors (`transcript-segment-view-model`) | **PASS** — count **1428**, text extracted |
| Root cause | YouTube **modern transcript UI** uses different custom elements |
| Fix in `0.1.3` | Added `transcript-segment-view-model` + `yt-section-list-renderer` panel detection |

---

## Test steps performed

1. Opened watch page (Lex Fridman / Zelenskyy).
2. Clicked **…more** on description.
3. Clicked **Show transcript**.
4. Confirmed **Transcript** tab selected (Chapters | Transcript).
5. Verified transcript rows visible in right **"In this video"** panel.
6. Probed DOM via DevTools protocol (equivalent to extension scrape).

Screenshot: `docs/audit/transcript-live-qa-2026-05-22/youtube-transcript-visible.png`

---

## Root cause (exact)

YouTube no longer renders the legacy transcript tree on this layout:

| Legacy (extension 0.1.0–0.1.2) | Count on live page |
|--------------------------------|-------------------|
| `#segments-container` | **0** |
| `ytd-transcript-segment-renderer` | **0** |
| `ytd-transcript-segment-view-model` | **0** |
| `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]` | Present but **HIDDEN** |

Actual visible transcript uses **modern panel**:

| Modern (2025+ UI) | Count on live page |
|-------------------|-------------------|
| `ytd-engagement-panel-section-list-renderer` + `visibility=EXPANDED` + "In this video" | **1** |
| `yt-section-list-renderer` | **1** |
| `.ytSectionListRendererContents` | **1** |
| **`transcript-segment-view-model`** | **1428** |

Text lives in:

```html
<transcript-segment-view-model class="ytwTranscriptSegmentViewModelHost">
  <div class="ytwTranscriptSegmentViewModelTimestamp">21:21</div>
  <span class="ytAttributedStringHost" role="text">- The dishes are not like any other...</span>
</transcript-segment-view-model>
```

**Failing path:** `extractTranscriptRows()` → legacy `#segments-container` / `ytd-transcript-segment-renderer` → **0 rows** → status error.

**Working path (0.1.3):** `findModernInThisVideoPanel()` → `extractModernTranscriptSegments()` → `transcript-segment-view-model span[role="text"]` → **1428 rows**.

---

## Selectors: before vs after

### Failed (0.1.2)

```
#segments-container
ytd-transcript-segment-renderer .segment-text
ytd-transcript-segment-view-model
ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]  (hidden panel)
```

### Working (0.1.3)

```
ytd-engagement-panel-section-list-renderer[visibility*="EXPANDED"]  (In this video)
yt-section-list-renderer
.ytSectionListRendererContents
transcript-segment-view-model
transcript-segment-view-model span[role="text"]
.ytAttributedStringHost
```

---

## Before / after verification

### Before (0.1.2 logic simulated on live DOM)

```json
{
  "segments": 0,
  "renderers": 0,
  "viewModels": 0,
  "rowCount": 0
}
```

User-facing: `No transcript rows found` / empty textarea.

### After (0.1.3 logic on live DOM)

```json
{
  "layout": "modern-in-this-video",
  "rows": 1428,
  "chars": 144951,
  "sample": [
    "- I hope the Kyiv airport will open soon...",
    "- Yes, I think that the war will end..."
  ]
}
```

---

## Extension panel test note

Automated browser did **not** have the Chrome extension installed. Extraction was validated by running the **same DOM queries** as `content.js` via CDP.

**Manual step for you:**

1. Download **0.1.3** from `/extension` (hard refresh).
2. Reload extension at `chrome://extensions`.
3. Open the same video → Transcript tab → **Extract**.
4. Expect: `Transcript panel detected (modern-in-this-video)` → `Transcript rows found: N` → filled textarea.
5. Console filter: `[ContentGraph transcript]`.

---

## Code changes (0.1.3)

- `SEGMENT_NODE_SELECTORS` += `transcript-segment-view-model`, `timeline-item-view-model`
- `findModernInThisVideoPanel()` — expanded "In this video" + `yt-section-list-renderer`
- `extractModernTranscriptSegments()` — primary extraction path
- `getSegmentText()` — `span[role="text"]` for modern segments
- Retry/poll/MutationObserver unchanged (still 5s)

---

## Rebuild

```bash
./scripts/build-extension-zip.sh
# → frontend/public/downloads/contentgraph-extension.zip (v0.1.3)
```

Deploy frontend container so `/downloads/extension-meta.json` updates.

---

## Related docs

- [YOUTUBE_TRANSCRIPT_DEBUG_QA.md](./YOUTUBE_TRANSCRIPT_DEBUG_QA.md)
- [YOUTUBE_TRANSCRIPT_UI_COMPAT.md](./YOUTUBE_TRANSCRIPT_UI_COMPAT.md)
