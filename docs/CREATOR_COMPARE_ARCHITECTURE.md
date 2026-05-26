# Creator Compare — Architecture (Phase 5 MVP)

## Goal

Competitive intelligence workspace at `/compare`: **Creator A vs Creator B** using existing creator intelligence — no new AI infrastructure, no LangGraph changes.

## Route

| Layer | Path |
|-------|------|
| Frontend | `/compare?a={name}&b={name}` |
| API | `GET /api/v1/compare?creator_a=X&creator_b=Y` |

## Compare strategy

1. Resolve both names via `CreatorPageService.resolve_creator_name` (slug or display name).
2. Fetch full intelligence in parallel: `CreatorIntelligenceService.get_intelligence` × 2.
3. Derive compare-only fields (overview winners, semantic overlap A↔B, title battle) in `CreatorCompareService`.
4. Return one `CreatorCompareResult` — frontend renders side-by-side sections.

No duplicate hook/growth logic: compare service only orchestrates and computes pairwise deltas.

## Reused services

| Data | Service / table |
|------|-----------------|
| Overview, sections | `CreatorPageService` via intelligence payload |
| Growth series & metrics | `creator_stats_history` + `GrowthAnalyticsService` fallback |
| Hook mix & patterns | `HookAnalyticsService` + title `extract_title_features` |
| Audience | `AudienceIntelligenceService._aggregate` on `comments` |
| Semantic keywords | `keyword_stats_from_titles` |
| Breakouts / velocity | `GrowthAnalyticsService.get_video_breakouts` |
| Title battle | Top 5 videos by `views_count` + `extract_title_features` |

## Metric definitions

| Metric | Definition |
|--------|------------|
| **growth_7d_pct** | Subscriber % change over 7d from history (same as creator page) |
| **velocity** | Views delta 7d ÷ 7 |
| **breakout_rate** | `len(breakout_videos) / total_videos × 100` |
| **overlap_score** | Jaccard-like: \|tokens_A ∩ tokens_B\| / \|union\| (title tokens + dominant keywords) |
| **curiosity_score** (title battle) | Count of curiosity tags + 1 if title contains `?` |
| **Winners** | Higher numeric value per overview row; composite picks for growth / momentum / hooks |

## Sections (UI)

1. **Overview** — table with winner highlight per row + badge winners  
2. **Growth** — dual-line recharts (subscribers, views)  
3. **Hooks** — mix % cards per creator  
4. **Audience** — emotions, pain points, phrases (empty-safe)  
5. **Semantic overlap** — shared / unique themes  
6. **Breakouts** — top breakout videos per creator  
7. **Title battle** — top 5 titles with views, hook type, length, curiosity  

## Overlap logic (MVP)

- Tokenize titles: words ≥4 chars, stoplist filtered (`_title_token_set` from intelligence service).
- Union with `dominant_keywords` from each creator’s semantic block.
- **shared** = intersection; **unique_a/b** = set difference.

No embeddings or graph DB.

## Limitations

- Requires synced catalog rows for both creators.
- Growth/breakout deltas need ≥2 daily snapshots for non-zero 7d metrics.
- Audience only from extension-ingested comments.
- Existing `POST /creators/compare` (LLM style/topics) remains — this MVP is deterministic only.
- Compare loads two full intelligence payloads (~2× single page cost); acceptable for MVP (&lt;2s target on warm DB).

## Future evolution

- Pre-aggregated compare cache keyed by (A, B, snapshot_date)
- Third creator slot or “vs catalog average”
- Export compare report to Research
- Deep-link from feed growth cards with `?a=&b=` pre-filled
- Shared chart axis normalization (subs scale differs widely)

## Verification

```bash
curl -sS "http://127.0.0.1:8001/api/v1/compare?creator_a=Alex%20Hormozi&creator_b=Dan%20Martell" | jq '.creator_a, .overview_rows | length, .growth_winner'
```

1. `/compare` loads creator list  
2. Select A + B → compare returns 200  
3. Overview numbers match individual `/creators/{name}/intelligence`  
4. Empty audience / no history → no crash  
5. Nav **Compare** → `/compare`  

## Files

| Area | Path |
|------|------|
| API | `backend/app/api/v1/compare.py` |
| Service | `backend/app/services/creator_intelligence/creator_compare_service.py` |
| Schema | `backend/app/schemas/creator_compare.py` |
| Page | `frontend/app/compare/page.tsx` |
| UI | `frontend/components/compare/*` |
