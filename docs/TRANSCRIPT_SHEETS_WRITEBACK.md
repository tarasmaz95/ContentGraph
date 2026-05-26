# Transcript Google Sheets write-back

Extension → backend ingest unchanged for Sheets credentials. After a successful Postgres commit, the backend updates matching Google Sheet rows with a transcript preview and a link to the full transcript page.

## Architecture

```
Chrome extension (YouTube DOM)
  → POST /api/v1/transcripts/ingest
  → TranscriptIngestService.ingest()
       → find_catalog_video()
       → videos.transcript (full text, source of truth)
       → commit
       → SheetsTranscriptWritebackService.write_after_ingest()  [best-effort]
            → sheet_video_row_index lookup
            → Google Sheets API batchUpdate
```

- **Postgres**: full transcript text (unchanged).
- **Google Sheets**: preview in `Transcript`, URL in `Full Transcript`.
- **No** Transcript2/3, no multi-cell splitting, no full text in Sheets.

## Matching strategy

1. Normalize YouTube `video_id` (11 chars) from catalog `video_url` / `channel_url`.
2. Lookup `sheet_video_row_index` for `(spreadsheet_id, youtube_video_id)`.
3. Update **all** indexed row numbers (duplicate URLs in the sheet get the same write-back).

The index is rebuilt on every successful **Sheets sync** (`SheetsSyncService` → `rebuild_sheet_row_index()`). Ingest does **not** scan the whole sheet.

**Prerequisite**: run at least one sheet sync after deploying migration `017` so row indices exist.

## Sheets behavior

| Column | Content |
|--------|---------|
| **Transcript** | Preview only via `build_transcript_preview()` — whitespace collapsed, max ~10,000 chars, suffix `... [Open full transcript in tm1]` when truncated |
| **Full Transcript** | `https://tm1.website/transcripts/{video.id}` (configurable `TM1_PUBLIC_URL`) |

If **Full Transcript** header is missing, the backend inserts a column immediately after **Transcript** and sets the header.

## API response (ingest)

```json
{
  "matched": true,
  "transcript_saved": true,
  "sheets_rows_updated": 2,
  "sheets_writeback": "ok",
  "full_transcript_url": "https://tm1.website/transcripts/123"
}
```

`sheets_writeback`: `ok` | `failed` | `skipped` | `no_rows`

DB success is never rolled back when Sheets fails.

## Security

| Env | Behavior |
|-----|----------|
| `EXTENSION_API_KEY` unset | Ingest open (backward compatible) |
| `EXTENSION_API_KEY` set | `POST /transcripts/ingest` and `POST /comments/ingest` require header `X-Extension-Key` |

Extension options: **Extension API key** (stored in `chrome.storage.sync`).

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `SHEETS_WRITEBACK_ENABLED` | `true` | Toggle write-back |
| `TM1_PUBLIC_URL` | `https://tm1.website` | Full transcript link base |
| `EXTENSION_API_KEY` | empty | Optional ingest auth |

Google service account needs scope `https://www.googleapis.com/auth/spreadsheets` and **Editor** access on the spreadsheet.

## Full transcript page

`GET /transcripts/{id}` (frontend) — title, creator, full transcript, copy button. Linked from Sheets **Full Transcript** column.

## Limits

- Preview cap: `PREVIEW_MAX_CHARS = 10_000` (safe under Sheets ~50k cell limit).
- Ingest payload max transcript: 500,000 chars (unchanged).
- Write-back is best-effort; log warnings on failure.

## QA checklist

### Backend / Sheets

- [ ] Migration `017` applied (`sheet_video_row_index` exists).
- [ ] Service account has **spreadsheets** (not readonly) scope and sheet Editor role.
- [ ] Run **Quick sync** once to rebuild row index.
- [ ] Sheet has **Transcript** column mapped (settings / auto-detect).

### Extension ingest

- [ ] Install extension v0.2.1+ from `/extension` download (fresh ZIP).
- [ ] After Save, panel shows two lines: ContentGraph (DB) + Google Sheets status.
- [ ] Optional: set `EXTENSION_API_KEY` on server + matching key in extension options.
- [ ] Open catalog YouTube video → Extract → Save transcript.
- [ ] API response: `transcript_saved: true`, `sheets_writeback: ok`, `sheets_rows_updated >= 1`.
- [ ] Postgres: full transcript on `videos` row.
- [ ] Sheet **Transcript** cell: preview (truncated suffix if long).
- [ ] Sheet **Full Transcript** cell: `https://tm1.website/transcripts/{id}` opens full page.
- [ ] Duplicate video URLs: all matching rows updated.

### Extension release page

- [ ] `/extension` shows version **0.2.0**, current timestamp, ZIP size.
- [ ] Download serves `contentgraph-extension.zip` built after manifest bump.
- [ ] Release notes section visible.

### Regression

- [ ] Comments ingest unchanged (same auth rules).
- [ ] DB commit succeeds even if Sheets API fails (simulate wrong spreadsheet id).

## Comments write-back (extension ingest)

Same row index and `video_id` matching as transcripts. Separate service: `SheetsCommentsWritebackService`.

| Column | Content |
|--------|---------|
| **Comments** | Plain text, `Author: comment` one per line (~10k cap) |

Map **Comments** in Settings → column mapping. Requires Quick Sync for row index.

---

## Related code

- `backend/google_sheets/writeback_service.py`
- `backend/google_sheets/comments_writeback_service.py`
- `backend/google_sheets/transcript_preview.py`
- `backend/google_sheets/row_index.py`
- `backend/google_sheets/client.py` — `update_values`, `batch_update_values`, `ensure_full_transcript_column`
- `backend/app/services/transcripts/ingest_service.py`
- `frontend/app/transcripts/[id]/page.tsx`
