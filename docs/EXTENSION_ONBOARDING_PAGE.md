# Extension Onboarding Page (Phase 10)

Internal page at **`/extension`** for downloading and installing the ContentGraph Chrome extension.

## User flow

1. Teammate opens **Extension** in the nav (or `/extension`).
2. Downloads `contentgraph-extension.zip`.
3. Follows install steps (unzip → `chrome://extensions` → Load unpacked).
4. Reads transcript / comments workflows and troubleshooting.
5. Verifies on `/videos/{id}` and dashboard semantic search.

## Static hosting

Files live in **`frontend/public/downloads/`**:

| File | URL |
|------|-----|
| `contentgraph-extension.zip` | `/downloads/contentgraph-extension.zip` |
| `extension-meta.json` | `/downloads/extension-meta.json` |

Next.js serves `public/` at the site root. Production nginx proxies `/` to the frontend container, so downloads work on `https://tm1.website/downloads/...` with no extra nginx block.

### Metadata JSON

```json
{
  "version": "0.1.0",
  "name": "ContentGraph Transcript",
  "updatedAt": "2026-05-22T07:21:00Z",
  "sizeBytes": 7469,
  "filename": "contentgraph-extension.zip"
}
```

The onboarding page fetches this file client-side for version, date, and size.

## Updating the ZIP

When `extension/` sources change:

```bash
./scripts/build-extension-zip.sh
```

This:

1. Zips all files under `extension/` (excluding `.DS_Store`).
2. Writes `frontend/public/downloads/contentgraph-extension.zip`.
3. Regenerates `extension-meta.json` from `extension/manifest.json`.

Then rebuild/redeploy the frontend image so production serves the new files.

**Version bump:** edit `version` in `extension/manifest.json` before running the script.

## UI structure

| Section | Purpose |
|---------|---------|
| Hero | What the extension does (3 bullets) |
| Download | Sticky block — ZIP link, version, updated, size, copy helpers |
| Install | 6 step cards + placeholder frames for screenshots |
| Transcript workflow | 5 steps + embedding / semantic notes |
| Comments workflow | 3 steps + audience / feed notes |
| Troubleshooting | 6 concise items |
| Verification | Links to dashboard, feed, `/videos/{id}` checks |

i18n: `extension.*` in `en.ts` / `uk.ts`.

## Navigation

- Header **More** menu: Extension → `/extension`
- Command palette: “Extension” (keywords: chrome, transcript)

## Limitations (by design)

- No Chrome Web Store, auth, download analytics, or auto-update
- Unpacked install only (Developer mode)
- Screenshots are text placeholders — replace with images in `public/downloads/` if needed later
- ZIP must be rebuilt manually after extension changes

## Troubleshooting (ops)

| Issue | Check |
|-------|--------|
| 404 on ZIP | Frontend rebuilt after adding `public/downloads/` |
| Old version shown | Re-run `build-extension-zip.sh` and redeploy frontend |
| Extension API fails | User options → API base `https://tm1.website/api/v1` |
| Video not found | Catalog sync — video must exist in Postgres first |

## Files

| Path | Role |
|------|------|
| `frontend/app/extension/page.tsx` | Route |
| `frontend/components/extension/extension-onboarding-page.tsx` | Page UI |
| `frontend/lib/extension-download.ts` | Paths + format helpers |
| `scripts/build-extension-zip.sh` | ZIP + meta generator |
| `extension/` | Extension source (packaged into ZIP) |
