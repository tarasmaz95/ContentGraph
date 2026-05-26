# Google Sheets Connection UX

Friendly settings flow at **Settings → Connect Google Sheet**. Replaces manual Spreadsheet ID + `Titles!A:F` inputs for daily use. Sync pipeline is unchanged.

## User flow

1. **Paste URL** — full `https://docs.google.com/spreadsheets/d/{id}/edit` link (or raw ID).
2. **Load sheet** — backend extracts ID, lists tabs via Sheets metadata API.
3. **Select tab** — dropdown (defaults to first tab).
4. **Preview** — first 5 data rows in a small table.
5. **Column mapping** — auto-detected headers with editable dropdowns per field.
6. **Connect & Sync** or **Save configuration** — persists `spreadsheet_id`, `range`, optional `column_mapping`, then runs existing `POST /sheets/sync`.

## URL parsing

`google_sheets/sheet_range.py`:

- Regex on `/spreadsheets/d/{id}/`
- Bare ID strings (20+ alphanumeric chars) accepted
- Builds edit URL for display: `spreadsheet_edit_url(id)`

## Metadata & preview API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/sheets/parse-url` | `{ url }` → id, edit URL, tab titles |
| `GET /api/v1/sheets/{id}/tabs` | Tab list only |
| `GET /api/v1/sheets/{id}/preview?sheet_name=` | Headers, preview rows, mapping, suggested range |

`SheetsDiscoveryService` uses the same service account as sync. Errors are user-facing (permissions, not found, empty tab).

## Internal storage (unchanged shape for sync)

| Field | Example | Visible to user |
|-------|---------|-----------------|
| `google_sheets_spreadsheet_id` | `1ryJcKb6…` | Advanced only |
| `google_sheets_range` | `Titles!A:Z` or `'My Tab'!A:Z` | Auto-built; override in Advanced |
| `google_sheets_column_map` | JSONB `{ "title": "Video Title", … }` | Mapping dropdowns |

Default range is `{tab}!A:Z` so all columns are fetched; header mapping picks fields.

## Auto-detection logic

`google_sheets/column_detect.py` — alias lists per field:

| Field | Example headers |
|-------|-----------------|
| `creator_name` | Name, Creator, Channel |
| `title` | Titles, Title, Video Title |
| `channel_url` | URL, Channel URL |
| `video_url` | Video URL, Watch URL |
| `subscribers_count` | Subscribers, Subs |
| `views_count` | Views |
| `published_at_raw` | Date, Published |
| `transcript` | Transcript, Transcription |

Required: **creator_name**, **title**. Preview returns `missing_required` if aliases fail.

User overrides are stored in `google_sheets_column_map` and passed to `GoogleSheetsClient(column_mapping=…)` on sync.

## Fallback behavior

- Detection fails → user picks headers manually in mapping UI.
- Old configs without `column_map` → sync uses expanded aliases only (same as before, plus new alias words).
- Advanced section → manual range override, spreadsheet ID visible for support/debug.

## Advanced settings

Collapsed by default:

- Spreadsheet ID (read-only display)
- Sync range (A1 notation) — edit to narrow columns if needed

## Migration

`012_add_sheets_column_map` — `app_settings.google_sheets_column_map` JSONB nullable.

## Files

| Layer | Path |
|-------|------|
| URL/range | `backend/google_sheets/sheet_range.py` |
| Detection | `backend/google_sheets/column_detect.py` |
| Discovery | `backend/google_sheets/discovery.py` |
| Client | `backend/google_sheets/client.py` (mapping override) |
| API | `backend/app/api/v1/sheets.py` |
| UI | `frontend/components/settings/sheets-connection-panel.tsx` |

## Verification

1. Paste production sheet URL → tabs load.
2. Select tab → preview table renders.
3. Mapping shows Creator + Title filled.
4. Connect & Sync → same `SyncResult` as before.
5. Reload settings → URL/tab/mapping restored.
6. Invalid URL → friendly error, not stack trace.
7. 403 without share → email + Share instructions.
