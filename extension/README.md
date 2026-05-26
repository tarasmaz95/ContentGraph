# ContentGraph Transcript Extension (MVP)

Chrome MV3 extension for YouTube watch pages.

## Team download page

Open **https://tm1.website/extension** (or `/extension` locally) to download the latest ZIP and read install steps.

To refresh the hosted ZIP after editing this folder:

```bash
./scripts/build-extension-zip.sh
```

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Open **Extension options** (Details → Extension options, or popup → Settings) and set API base if needed (default: `https://tm1.website/api/v1`)

## Usage

1. Open a YouTube video that exists in your ContentGraph catalog
2. **Transcript:** open YouTube’s Transcript panel → Extract / Copy / Export / Save
3. **Comments:** scroll to Top comments → Extract comments / Copy / Save comments
4. Floating **ContentGraph** panel (bottom-right):
   - Transcript → `POST /api/v1/transcripts/ingest`
   - After **Save transcript**, status shows **ContentGraph (DB)** and **Google Sheets** separately (v0.2.1+).
   - After **Save comments**, same two-line status for the **Comments** column (v0.2.2+).
   - If Sheets says “no matching row”, run **Quick Sync** on tm1.website, then save again.
   - Map **Comments** in tm1.website → Settings → column mapping.
   - Comments → `POST /api/v1/comments/ingest`

## Local backend

Set API base to `http://localhost:8001/api/v1` in extension options.

See `docs/TRANSCRIPT_EXTENSION_ARCHITECTURE.md` for full design.
