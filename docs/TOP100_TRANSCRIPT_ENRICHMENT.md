# Top-viewed transcript enrichment batch

Internal batch runner to enrich high-value catalog videos with `videos.transcript` and `videos.transcript_embedding` using the **existing** ContentGraph pipeline (no Chrome extension automation, no new queues).

## Architecture

```mermaid
flowchart LR
  subgraph select [Selection]
    DB[(videos)]
    TopN[ORDER BY views_count DESC LIMIT N]
  end
  subgraph resolve [Resolve watch ID]
    URL[TranscriptService.extract_video_id]
    YTAPI[YouTube Data API search by handle + title]
  end
  subgraph fetch [Fetch]
    YTA[youtube-transcript-api fetch]
  end
  subgraph store [Store]
    TS[TranscriptService]
    ES[EmbeddingService text-embedding-3-small]
    PG[(transcript + transcript_embedding)]
  end
  DB --> TopN --> URL
  URL -->|no v= in channel_url| YTAPI
  URL --> YTA
  YTAPI --> YTA
  YTA --> TS --> ES --> PG
```

| Component | Path | Role |
|-----------|------|------|
| Batch orchestration | `backend/app/services/transcripts/transcript_enrichment_batch.py` | Top-N selection, throttle, per-video report |
| CLI entry | `backend/scripts/run_transcript_enrichment_batch.py` | Docker-friendly runner |
| Video ID resolver | `backend/app/services/transcripts/youtube_video_resolver.py` | YouTube Data API when `channel_url` is a channel hub (`@creator/videos`) |
| Transcript fetch + save | `backend/app/services/transcripts/transcript_service.py` | `youtube-transcript-api` → `videos.transcript` |
| Embeddings | `backend/app/services/embeddings/embedding_service.py` | `text-embedding-3-small` (1536-d) → `videos.transcript_embedding` |
| Extension ingest (unchanged) | `POST /api/v1/transcripts/ingest` | Manual/browser path; same DB columns |

**Not used:** Playwright, Celery, Kafka, parallel workers, new vector stores.

## Catalog constraint

Synced sheet rows store **channel hub URLs**, not watch URLs (`watch?v=`). Native `TranscriptService.extract_video_id()` alone matches **0** of 12,522 rows. The batch runner adds a lightweight **YouTube Data API** resolver (`channels.list` by `@handle`, then `search.list` scoped to channel + title).

## Fetch source

- **Primary:** [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) v1.x (`YouTubeTranscriptApi().fetch(video_id)`).
- **Embeddings:** OpenAI `text-embedding-3-small` via `EmbeddingService.embed_transcript()` (truncates to `TRANSCRIPT_EMBED_MAX_CHARS`, default 8000).
- **Optional:** `TRANSCRIPT_HTTP_PROXY` — residential/rotating proxy when the server IP is blocked by YouTube (common on cloud VPS).

## How to run

```bash
# Catalog counts only
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python scripts/run_transcript_enrichment_batch.py --stats-only

# QA batch — top 10 by views, ~0.5s between videos (~2 req/s)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python scripts/run_transcript_enrichment_batch.py --limit 10 --delay 0.5

# Production batch (only after fetch succeeds — set proxy if on cloud)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \
  python scripts/run_transcript_enrichment_batch.py --limit 100 --delay 0.4
```

Environment (optional):

```env
TRANSCRIPT_HTTP_PROXY=http://user:pass@host:port
YOUTUBE_API_KEY=...   # required for ID resolution
OPENAI_API_KEY=...    # required for embeddings
```

## QA run — top 10 (2026-05-22)

| Metric | Value |
|--------|------|
| Videos attempted | 10 |
| YouTube IDs resolved | **10 / 10** |
| Transcripts fetched | **0** |
| Status | **10 × `ip_blocked`** |
| Runtime | ~25 s |
| DB rows updated | 0 |
| Est. embedding cost | $0 |

**Root cause:** YouTube blocks `youtube-transcript-api` from this server’s cloud/datacenter IP (`RequestBlocked`). This is environmental, not a logic bug. The library API was also updated from `get_transcript()` to `fetch()` in v1.x (fixed in `transcript_service.py`).

**Resolved IDs (sample):**

| video_id | views | youtube_id |
|----------|-------|------------|
| 7107 | 7.8M | qCbfTN-caFI |
| 7094 | 7.4M | u321m25rKXc |
| 7106 | 6.9M | DyoVVSggPjY |

## Top 100 run

**Not executed.** QA did not achieve any successful fetches. Running 100 blocked requests would add ~40s of runtime with no DB benefit.

**Before scaling:** configure `TRANSCRIPT_HTTP_PROXY` (or run the batch from a non-cloud network), re-run `--limit 10`, confirm `success_count > 0`, then `--limit 100 --delay 0.4`.

## Verification (existing transcripts)

Pre-batch catalog (unchanged after QA):

| Metric | Count |
|--------|------:|
| videos_total | 12,522 |
| with_transcript | 3 |
| with_transcript_embedding | 3 |
| title_embedding | 12,522 |

**Semantic search** (`GET /api/v1/videos/semantic-search?q=three AIs compete build app`):

- Rank #1: video **4384** (has transcript) — `transcript_similarity` 0.41, `match_source` **both** (title + transcript).
- Confirms transcript vectors improve ranking vs title-only rows.

**Intelligence API:** existing transcript-backed videos remain served via intelligence/retrieval paths; no duplication (batch skips rows that already have `transcript`).

## Cost model (when fetch works)

| Item | Estimate |
|------|----------|
| youtube-transcript-api | Free |
| YouTube Data API search | ~100 units / 100 videos (within free tier) |
| OpenAI embedding | ~$0.02 / 1M tokens; ~2k tokens per 8k-char transcript → **~$0.004 per 100 videos** |

## Limitations

1. **Cloud IP blocking** — native fetch fails without proxy or off-cloud execution.
2. **YouTube captions.download** — requires OAuth; not used (API key only lists captions).
3. **ID resolution** — search fallback may mismatch on ambiguous titles; exact title match is preferred when API returns multiple hits.
4. **No `transcript_status` columns** — per-video outcome is in batch JSON only (avoided schema migration).
5. **Extension path remains best for blocked environments** — extension ingest → same `videos.transcript` / embedding pipeline.

## Related docs

- `docs/YOUTUBE_TRANSCRIPT_UI_COMPAT.md` — extension DOM selectors
- `docs/YOUTUBE_TRANSCRIPT_LIVE_QA.md` — live extension QA

## Files added/changed

- `backend/app/services/transcripts/youtube_video_resolver.py`
- `backend/app/services/transcripts/transcript_enrichment_batch.py`
- `backend/scripts/run_transcript_enrichment_batch.py`
- `backend/app/services/transcripts/transcript_service.py` — v1 API + proxy + `RequestBlocked` propagation
- `backend/app/core/config.py` — `transcript_http_proxy`
- `backend/.env.example` — `TRANSCRIPT_HTTP_PROXY`
