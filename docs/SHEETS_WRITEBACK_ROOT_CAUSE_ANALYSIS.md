# Sheets transcript write-back — root cause analysis (code trace)

**Date:** 2026-05-25  
**Symptom:** DB + `/transcripts/{id}` OK; Google Sheet `Transcript` / `Full Transcript` not updated.

---

## Executive summary

| Finding | Detail |
|---------|--------|
| **Root cause (historical)** | `sheet_video_row_index` was **empty** → write-back stopped at lookup with `sheets_writeback=no_rows` |
| **Why index empty** | Index built only on **Quick/Full sync** via `rebuild_sheet_row_index()`; if sync ran before deploy, failed silently, or sheet had no **Video URL** column in range, index stays at 0 |
| **Code path works** | After index populated (12,246 rows), manual `write_after_ingest(video 1833)` → `status=ok`, row **1841** updated in sheet |
| **Not the blocker** | Feature flag (enabled), Google write scope, Transcript column mapping (present at col H) |
| **UX gap** | Extension shows only “Saved to video #id” — **does not show** `sheets_writeback` / `sheets_message` |

---

## 1. Full flow (functions actually called)

```
extension/content.js handleSaveTranscript()
  → chrome.runtime.sendMessage SAVE_TRANSCRIPT
extension/background.js postIngest("/transcripts/ingest")
  → POST /api/v1/transcripts/ingest
backend/app/api/v1/transcripts.py ingest_transcript()
  → TranscriptIngestService.ingest()
       → find_catalog_video()                    [match DB video]
       → video.transcript = text; flush
       → TranscriptService.embed_transcript()
       → db.commit()                             [DB saved — user sees success]
       → SheetsTranscriptWritebackService.write_after_ingest(video)
            → get_settings().sheets_writeback_enabled
            → AppSettingsService.resolve_sheets()  [DB spreadsheet + Titles!A:Z]
            → extract_video_id(video.video_url)    [NOT title matching]
            → get_sheet_rows_for_video(spreadsheet_id, yt_id)
            → [STOP if row_numbers empty → no_rows]
            → GoogleSheetsClient + resolve_column_mapping()
            → get_column_index_map() → transcript col
            → ensure_full_transcript_column()
            → build_transcript_preview()
            → batch_update_values(ranges)
       → TranscriptIngestResponse(sheets_writeback, sheets_rows_updated, ...)
```

**Not called for sheet row matching:** `title`, `creator` (only used in `find_catalog_video` for DB).

---

## 2. Is write-back invoked after commit?

**Yes.** `ingest_service.py`:

```python
await self._db.commit()
await self._db.refresh(video)
wb = await SheetsTranscriptWritebackService(self._db).write_after_ingest(video)
```

- Wrapped in `write_after_ingest` try/except — **never raises** to API; failures become `status=failed` or `no_rows`.
- `sheets_writeback_enabled` default **True** (`config.py`).

---

## 3. Matching logic (where it breaks)

### DB video lookup (ingest)

`find_catalog_video()` — video_id in URL, then title+creator. **Works** (user has transcript in DB).

### Sheet row lookup (write-back)

`writeback_service.py`:

```python
yt_id = extract_video_id(video.video_url) or extract_video_id(video.channel_url)
row_numbers = get_sheet_rows_for_video(db, spreadsheet_id, yt_id)
```

`row_index.py` rebuild (on sync only):

```python
yt_id = extract_video_id(row.get("video_url") or "")  # Sheet column "Video URL" only
```

| Source | Used for sheet rows? |
|--------|----------------------|
| `video.video_url` (watch?v=) | ✅ lookup key |
| `video.channel_url` (@channel) | ✅ fallback for yt_id only |
| Sheet `video_url` cell | ✅ index build |
| Title / creator | ❌ never |

**If index has 0 rows for `cJBwBR_WHcE`:** flow stops here — **no Google API write attempted.**

### Production check (2026-05-25)

```sql
SELECT count(*) FROM sheet_video_row_index;  -- 12246
SELECT sheet_row_number FROM sheet_video_row_index
  WHERE youtube_video_id='cJBwBR_WHcE';    -- 1841
```

After manual rebuild / sync with `Titles!A:Z` + column map `video_url → Video URL`, matching works.

**Earlier failure:** index was **0 rows** when range was `Titles!A:F` (no Video URL column) — rebuild indexed nothing.

---

## 4. Quick Sync dependency

**Required** for write-back row lookup.

`sync_service.py` after saving videos:

```python
indexed = await rebuild_sheet_row_index(self._db, config.spreadsheet_id, sheet_rows)
```

- Failure only logged (`logger.warning` → now `logger.error`).
- Sync still **completes**; ingest later gets `no_rows`.

**User must run Quick Sync after:**

1. Deploying migration `017` + write-back code  
2. Configuring `Titles!A:Z` and **Video URL** column in settings  

---

## 5. Google API write path

| Check | Status |
|-------|--------|
| Scope | `https://www.googleapis.com/auth/spreadsheets` (not readonly) |
| `batch_update_values` | Called when `row_numbers` non-empty |
| Permissions | Live test **succeeded** (row 1841 H/I updated) |
| Errors | Caught → `status=failed`, `logger.warning` + stack |

---

## 6. Columns

| Column | Index (0-based) | Write content |
|--------|-----------------|---------------|
| Transcript | 7 (H) | `build_transcript_preview()` max ~10k chars |
| Full Transcript | 8 (I) | `https://tm1.website/transcripts/{video.id}` |

`ensure_full_transcript_column()` inserts column if header missing — sheet already has both headers.

---

## 7. Exact stop points by `sheets_writeback` status

| status | Stop location | Google write? |
|--------|---------------|---------------|
| `skipped` | flag off / no config / no text | No |
| `no_rows` | `get_sheet_rows_for_video` → `[]` | **No** ← main historical failure |
| `failed` | no Transcript column / API exception | Maybe attempted |
| `ok` | `batch_update_values` completed | Yes |

---

## 8. What to do so Sheets always update

1. **Settings:** `Titles!A:Z`, map **Video URL** → column with `watch?v=` links.  
2. **Quick Sync** once (rebuild index — check logs for `Sheet video row index rebuilt: N entries`).  
3. **Save transcript** again from extension.  
4. **Verify API response** (not shown in extension UI today):

   ```json
   "sheets_writeback": "ok",
   "sheets_rows_updated": 1,
   "full_transcript_url": "https://tm1.website/transcripts/1833"
   ```

5. **Logs** (after debug deploy): `grep sheets_writeback` in backend logs.

---

## 9. Debug logging added

| File | Log prefix |
|------|------------|
| `writeback_service.py` | `sheets_writeback_start`, `_lookup`, `_index`, `_columns`, `_batch`, `_ok`, `_failed`, `_stop` |
| `ingest_service.py` | `transcript_ingest_done` with `sheets_writeback` + `sheets_rows_updated` |
| `sync_service.py` | index rebuild failure → **error** level |

---

## Code references

- `backend/app/services/transcripts/ingest_service.py`
- `backend/google_sheets/writeback_service.py`
- `backend/google_sheets/row_index.py`
- `backend/google_sheets/sync_service.py` (~line 161)
- `backend/google_sheets/client.py` (`batch_update_values`, `ensure_full_transcript_column`)
