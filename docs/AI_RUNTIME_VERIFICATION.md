# AI Runtime Verification Report

**Date:** 2026-05-20  
**Environment:** Docker Compose (`backend` :8001, `frontend` :3002, `postgres` :5433)  
**Scope:** Embeddings, pgvector, semantic retrieval, LangGraph pipeline — verification only, no new features.

---

## Executive summary

| Layer | Status | Quality |
|-------|--------|---------|
| Docker / Postgres | Healthy | Stable |
| pgvector + embeddings | 6621/6621 titles @ 1536 dims | Strong |
| Semantic search (title-only) | Working | Good–very good for topical queries |
| LangGraph chat | Working | Mixed — routing/retrieval noise on ambiguous queries |
| Transcripts / comments | 0 rows | Major limitation for depth |
| Performance | Acceptable | DB vector ~10ms; API path ~150–400ms (embed dominates) |

The AI layer is **production-stable for title-based semantic search** and **usable for hook/title analytics chat**, but **not yet deep** for audience/transcript/communication analysis until YouTube transcript + comment ingestion runs.

---

## 1. Docker runtime verification

### Container status

```
NAME            STATUS                    PORTS
yt-backend-1    Up                        0.0.0.0:8001->8000/tcp
yt-frontend-1   Up                        0.0.0.0:3002->3000/tcp
yt-postgres-1   Up (healthy)              0.0.0.0:5433->5432/tcp
```

### Backend logs (last ~100 lines, sampled)

- No `asyncpg` vector type errors after `vector_utils` + raw SQL retrieval fixes.
- No LangGraph runtime crashes during 5 chat invocations.
- One **API defect** logged: `CreatorPageService.semantic_search() got an unexpected keyword argument 'q'` on `GET /creators/{name}/semantic-search` — route passes `q=`, service expects `query=`.
- Deprecation only: `LangChainPendingDeprecationWarning` for `langgraph.checkpoint` `allowed_objects` (non-blocking).

### Postgres logs

- Clean startup, checkpoints normal after bulk sync/embeddings.
- No pgvector extension errors.

### pgvector extension

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- vector | 0.8.2
```

**Verdict:** Runtime stable. One creator-scoped semantic-search API mismatch (documented in §7).

---

## 2. Embeddings verification

### Coverage

| Metric | Value |
|--------|-------|
| Total videos | 6621 |
| `title_embedding` populated | 6621 (100%) |
| `transcript_embedding` | 0 |
| Transcripts in DB | 0 |
| Comments in DB | 0 |
| `hook_patterns` indexed | 9836 |

### Vector dimensions

All embedded rows: **`vector_dims(title_embedding) = 1536`** (single group, count 6621).

No null corruption on titles with content; missing embeddings = 0.

### Indexes

- `ix_videos_title_embedding_hnsw` — HNSW, `vector_cosine_ops`
- `ix_videos_transcript_embedding_hnsw` — partial (unused until transcripts exist)

### Sample similarity (anchor: Dan Koe discipline title)

| Creator | Title (truncated) | Cosine sim |
|---------|-------------------|------------|
| Dan Koe | How To Become So Self-Disciplined… | 1.000 |
| Sabrina Ramonov / Dan Martell / Alek | How to Be So Productive it Feels ILLEGAL | 0.693 |
| Ross Harkness | How To Effortlessly Build Insane Discipline | 0.666 |
| Dan Koe | How To Change Your Life So Fast… | 0.657 |

Self-match = 1.0; cross-title neighbors are semantically plausible (discipline/productivity cluster).

**Verdict:** Embeddings + pgvector storage are correct and complete for titles.

---

## 3. Semantic search quality tests

Queries tested via `VideoService.semantic_search` vs `VideoService.search` (keyword ILIKE).

### Results summary

| Query | Semantic top relevance | Keyword behavior | Semantic ms | Keyword ms |
|-------|------------------------|------------------|-------------|------------|
| identity transformation | Strong (Dan Koe reinvent, Ross identity shift) | 1 hit — exact phrase in title | ~279 | ~14 |
| discipline and focus | Strong (Hormozi, Ali Abdaal, Ross discipline) | **0 hits** (no exact phrase) | ~170 | ~12 |
| AI productivity | Strong (Ali Abdaal AI hours, Julia McCoy paradox) | 1 exact-title match | ~187 | ~10 |
| self improvement | **Weak/noisy** — tech “Self-Improving AI” titles rank high | 0 hits | ~146 | ~11 |
| personal brand | **Excellent** — Caleb Ralston cluster, Dan Koe also in keyword | 5 phrase matches | ~158 | ~4 |

Typical similarity scores (title-only): **0.39–0.61**.

### Semantic vs keyword — difference

| Aspect | Semantic (`/videos/semantic-search`) | Keyword (`/videos/search`) |
|--------|--------------------------------------|----------------------------|
| Mechanism | OpenAI embed query → pgvector cosine on `title_embedding` | SQL `ILIKE` on title (and related fields) |
| Synonyms | Finds “reinvent yourself” for “identity transformation” | Misses unless words appear in title |
| Multi-word queries | “discipline and focus” works without exact string | Often **empty** for natural phrases |
| False positives | “self improvement” → AI self-improving tech videos | None when no match |
| Speed | ~145–280ms (embed API + DB) | ~4–14ms |
| Scores | `similarity_score` on response | `null` |

**When they agree:** Queries with literal title phrases (“personal brand”, “AI Productivity Paradox”) — keyword is faster and precise; semantic still ranks related creators.

**When semantic wins:** Paraphrases and concepts without exact tokens (“discipline and focus”, “identity transformation”).

**Ordering note:** Top-5 lists are not always strictly descending by raw cosine — `HybridRetrievalService` / blended scoring can reorder vs pure `ORDER BY <=>`.

---

## 4. LangGraph retrieval verification

Pipeline: `query_router` → `retrieval` → `analysis` → `response` (`build_analytics_graph`).

### Chat test matrix

| Query | Routed `analysis_type` | Latency | Retrieval quality | Insights |
|-------|----------------------|---------|-------------------|----------|
| What hooks work best for Dan Koe? | `hook_analysis` | ~11.2s | Mixed — Dan Koe present but also Nick Saraev / Dan Martell “dangerously” clones | Useful title/hook stats |
| Why do identity hooks perform well? | `hook_analysis` | ~19.3s | **Poor** — “performance” keyword pollution (Postgres, DeepSeek, PrimeTime) | Stats valid but context wrong |
| What audience pain points appear most? | `audience_analysis` | ~3.1s | Audience-growth titles, not comments | Title-based, not comment-grounded |
| Generate hooks about discipline | `hook_generation` | ~4.2s | **Good** — Ali Abdaal, Dan Koe, Dan Martell discipline titles | Actionable hook patterns |
| Analyze creator communication patterns | `general_chat` | ~12.5s | **Routing miss** — “creator” → PrimeTime interview titles | Generic title stats |

**Average chat latency:** ~10.0s (range ~3–19s).

### Context flow checks

- **Retrieval:** `HybridRetrievalService` — weights semantic 0.50, title 0.20, transcript 0.30 (inactive), views 0.25, keyword 0.15.
- **Transcripts:** `has_transcript: false` on all snapshots; `transcript_snippet` unused.
- **Hooks:** `hook_patterns` (9836) feed analysis node for hook types — works for aggregate stats.
- **Structured outputs:** `ChatResult` returns `analysis_type`, `insights`, `structured`, `relevant_videos` — schema stable.

### Creator filter

Router extracts `creator_filter` for “Dan Koe” queries but retrieval still surfaces non-Dan videos in top-5 — creator boost/threshold not strict enough.

---

## 5. Vector similarity tests

### Similar videos (intra-topic)

Dan Koe discipline anchor → nearest neighbors include same-niche “feels illegal” productivity titles across creators (expected title-template clustering).

### Related creators (avg cosine to one Dan Koe embedding)

| Creator | Avg sim | Videos |
|---------|---------|--------|
| Caleb Ralston | 0.352 | 19 |
| Grow with Alex | 0.351 | 52 |
| Nate Curtiss | 0.343 | 9 |
| Patrick Dang | 0.321 | 74 |
| Dan Koe | 0.320 | 68 |
| Ali Abdaal | 0.300 | 112 |

Clustering reflects **business/creator-education title space**, not personality-level “communication style.”

### Hybrid retrieval sample (“Generate hooks about discipline”)

Top: Ali Abdaal Ultimate Guide to Discipline (0.53), Dan Martell hacks, Dan Koe self-disciplined, Ross Harkness — **aligned with query**.

**Verdict:** Cosine behavior is sane; template-heavy YouTube titles create cross-creator near-duplicates (~0.69).

---

## 6. Performance verification

| Operation | Typical timing | Notes |
|-----------|----------------|-------|
| Pure pgvector top-10 (HNSW) | **~10ms** execution | `EXPLAIN ANALYZE` uses `ix_videos_title_embedding_hnsw` |
| Embed query + top-10 (E2E in app) | **~115–380ms** avg ~209ms | OpenAI embedding dominates |
| Semantic search API path | **~145–280ms** | Per query |
| Keyword search | **~4–14ms** | Postgres ILIKE |
| Hybrid retrieval (in-process) | **~204ms** | One discipline query |
| LangGraph chat E2E | **~3–19s**, avg **~10s** | LLM analysis + response nodes |

**Slow path:** Chat with `hook_analysis` + large context (~40 videos) + two LLM calls → 12–19s.

No slow SQL observed for vector ORDER BY at current scale (6621 rows).

---

## 7. Retrieval debugging

### Why retrieval can be noisy

1. **Title-only vectors** — No `transcript_embedding`; semantic path cannot use spoken content.
2. **Keyword collision** — “identity hooks **perform** well” matches “**performance**” in unrelated tech titles.
3. **Hybrid re-ranking** — Views/keyword boosts can push high-view irrelevant videos above tighter semantic matches.
4. **Creator API bug** — `/creators/{name}/semantic-search?q=...` passes wrong kwarg → 500; global semantic search works.
5. **No comments** — `comments_analysis` / audience pain queries cannot ground in real comment text; risk of **LLM extrapolation** from titles only.
6. **Router ambiguity** — “communication patterns” → `general_chat` instead of `creator_analysis`.
7. **Template duplication** — Identical title patterns across creators inflate similarity (~0.69).

### Thresholds / ranking

- Raw cosine similarities often **0.38–0.61** for good matches; no hard minimum filter exposed — low-sim tails can enter top-40 for chat.
- Transcript weight (0.30) is dead weight until sync ingests transcripts.

---

## 8. AI quality analysis

### Strongest parts

- Title embedding coverage and pgvector correctness.
- Topical semantic search: discipline, personal brand, AI productivity, identity (when not confused by “perform”).
- Hook generation / discipline chat with relevant catalog context.
- Hook pattern analytics (numbers, curiosity) backed by indexed titles.
- Low hallucination risk when insights cite **aggregate title metrics**.

### Weakest parts

- **Self improvement** query → tech-AI false positives.
- **Identity hooks perform** → keyword “perform” pollution.
- **Creator communication patterns** → wrong retrieval set.
- **Audience pain points** — no comment data; insights are indirect from growth/audience titles.
- **Dan Koe hooks** — creator filter not enforced in top results.
- Creator-scoped semantic endpoint broken (`q` vs `query`).

### Realistic limitations

- System is a **title + hook analytics copilot**, not a transcript/audience research platform yet.
- Chat latency 10s+ is acceptable for internal tool, not real-time.
- Insights repeat patterns (curiosity, numbers) across queries — useful but not deeply differentiated.

---

## 9. Final verification summary

| Area | Status |
|------|--------|
| **Embeddings** | PASS — 100% title coverage, 1536 dims |
| **pgvector** | PASS — extension 0.8.2, HNSW indexes, ~10ms queries |
| **Semantic search** | PASS with caveats — excellent for brand/discipline/AI; weak for ambiguous “self improvement” |
| **LangGraph** | PASS — pipeline completes; quality varies by query |
| **Retrieval** | PARTIAL — good for clear topics; noisy for polysemous words + missing transcripts |
| **Performance** | PASS at current scale |
| **Runtime stability** | PASS — no vector/asyncpg crashes in test window |

### Known weaknesses (priority order)

1. Zero transcripts and transcript embeddings.
2. Zero comments — audience/comment analysis not data-backed.
3. Keyword-substring collisions in hybrid retrieval (“perform”, “creator”).
4. Creator-scoped semantic search API 500 (`q` parameter mismatch).
5. Loose creator filtering in chat retrieval.
6. LangGraph router misses on vague analytical queries.

### Recommended next steps (ops, not code features)

- Run transcript + comment ingestion via sync (YouTube API quota/config).
- Re-run this verification after transcripts exist — expect transcript weight 0.30 to materially improve retrieval.
- Fix creator semantic-search parameter binding before relying on per-creator UI search.

---

## Appendix: commands used

```bash
docker compose ps
docker compose logs backend --tail 100
docker compose logs postgres --tail 50

# In-container verification script (embeddings, semantic vs keyword, LangGraph)
docker compose exec backend python3 < verification_script.py

# Health / smoke
./scripts/test_smoke.sh
curl -X POST http://localhost:8001/api/v1/chat -H "Content-Type: application/json" \
  -d '{"message":"Generate hooks about discipline"}'
```

---

*Verification only — no architecture or AI feature changes in this pass.*
