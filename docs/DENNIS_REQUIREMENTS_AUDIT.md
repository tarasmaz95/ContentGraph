# Dennis Requirements Audit — ContentGraph Lite

**Date:** 2026-05-22  
**Scope:** Product/system audit only — no code changes, no roadmap inflation.  
**Baseline:** Dennis’s stated requirements (user-provided message list) plus what the repository and production deployment (`https://tm1.website`) actually implement today.

---

## Section 1 — Original vision

### What Dennis actually described

Dennis wanted a **small internal research tool** for a **2–3 person team**, not a SaaS product. The core idea:

1. **Collect YouTube research data** into one place: creators, video titles, transcripts, and comments.
2. **Unify** that data so the team can **talk to it** (natural language / AI), not hunt across spreadsheets and browser tabs.
3. **LangGraph** as the orchestration layer around the collected data — structured routing and analysis, not a generic chatbot only.
4. **Manual-first ingestion** where possible — especially transcripts — similar in spirit to **Glasp IO** (see transcript on the page, copy/export/save), **avoiding YouTube API** when possible for that path.
5. **Chrome extension** for transcript extraction and **top-liked comments** extraction from the YouTube UI.
6. **Cron jobs** to track **subscribers / views growth** over time.
7. **Lightweight** implementation: no enterprise auth, no heavy platform.

### Intended workflow (realistic reconstruction)

| Step | Dennis-style workflow |
|------|------------------------|
| 1 | Maintain a **Google Sheets catalog** of creators/videos (team’s research list). |
| 2 | **Sync** sheet → central database (automated baseline). |
| 3 | On interesting videos, open YouTube → use **extension** to save transcript + top comments into the system. |
| 4 | Let **cron** accumulate daily snapshots so growth/breakouts can be seen over time. |
| 5 | **Search and ask questions** (semantic + chat) across catalog, transcripts, and comments. |
| 6 | Share findings internally (copy/export) — no multi-tenant product requirements stated. |

### Intended scale and users

- **Users:** 2–3 researchers/operators on one deployment.
- **Data volume:** Hundreds to low thousands of videos (sheet-driven), not full-YouTube scale.
- **Freshness:** Batch/sync + manual enrichment, not real-time YouTube trend radar.

### Intended technical constraints

- Prefer **service account Sheets** + **browser extraction** over broad YouTube API usage for enrichment.
- **Postgres** as unified store; **embeddings** for semantic layer.
- **No** requirement for queues, microservices, multi-tenant auth, or Chrome Web Store distribution.
- **LangGraph** for chat analytics — not necessarily for every page in the app.

### What Dennis did *not* ask for (avoid inventing)

- Side-by-side **creator compare** workspace as a first-class product surface.
- **Research workspace** with collections and frozen JSON snapshots.
- **Intelligence feed** as a daily “trends” product.
- **Hook lab** and **script studio** as dedicated apps.
- **Bilingual UI** (EN/UK).
- **Keyboard shortcuts**, pinned creators, saved searches.
- **Extension onboarding page** with ZIP download.
- **Paste-URL Google Sheets** connection wizard (recent UX; still aligned with “easy sheet connect”).

---

## Section 2 — Implemented features

| Feature | Status | Requested by Dennis? | Notes |
|---------|--------|----------------------|-------|
| Google Sheets → Postgres catalog sync | **Fully implemented** | Yes | Service account; post-sync embeddings, hooks, optional batch transcript/comment enrich. |
| Paste URL + tab picker + column mapping (Sheets UX) | **Fully implemented** | Partially | UX upgrade; same sync pipeline underneath. |
| Creator + title + views + URL in catalog | **Fully implemented** | Yes | Flexible header mapping. |
| Title embeddings + semantic search | **Fully implemented** | Implied | Core “talk to data” enabler; hybrid title/transcript/comment retrieval. |
| Transcript storage + transcript embeddings | **Partially implemented** | Yes | Extension path (no YT API) + batch `youtube-transcript-api` with limits; coverage depends on team effort + limits. |
| Chrome extension — transcript extract/copy/export/save | **Fully implemented** | Yes | MV3, floating panel, Glasp-like flow documented. |
| Chrome extension — top comments extract/save | **Fully implemented** | Yes | DOM scrape, max ~20, replace-on-save. |
| Extension onboarding (`/extension` + ZIP) | **Fully implemented** | No | Internal install/docs; valuable for 2–3 users. |
| Comments in DB + sentiment/emotional tags | **Partially implemented** | Yes | Rule-based tags; coverage = videos enriched (extension or optional YT API batch). |
| LangGraph chat pipeline (route → retrieve → analyze → respond) | **Fully implemented** | Yes | 16 analysis types; main “unified talk” surface is `/chat`. |
| Copilot sidebar (deterministic insights per page) | **Fully implemented** | No | SQL/templates; not LangGraph per page load — reduces cost. |
| Command palette (⌘K) | **Fully implemented** | No | Navigation + example prompts. |
| Dashboard: keyword + semantic search, search mode UX | **Fully implemented** | Implied | Progressive disclosure; catalog-wide “at a glance” metrics. |
| Creator list + creator intelligence page | **Fully implemented** | Partially | Dennis asked “creators”; page exceeds with growth/hooks/audience/semantic/momentum. |
| Video intelligence page (`/videos/{id}`) | **Fully implemented** | Implied | Breakdown, transcript, structure, viral, comments, charts. |
| Creator compare (`/compare`) | **Fully implemented** | No | Side-by-side A vs B; uses existing intelligence services. |
| Research workspace (items + collections + snapshots) | **Fully implemented** | No | Frozen payloads; legacy `saved_insights` / notes still exist. |
| Intelligence feed (`/feed`) | **Fully implemented** | No | Deterministic catalog signals; copy repositioned as non-realtime. |
| Hooks analytics + hook generation (`/hooks`) | **Fully implemented** | No | Indexed from titles/transcripts; LLM generation. |
| Scripts generation + analysis (`/scripts`) | **Fully implemented** | No | LLM + creator context. |
| Historical analytics — daily snapshots | **Fully implemented** | Yes | APScheduler cron (~03:15 UTC) + manual `POST /analytics/snapshots/run`. |
| Growth / velocity / breakout metrics | **Partially implemented** | Yes | Needs **≥2 snapshot days**; subscriber/views in snapshots come from **current sheet rows**, not live YT API in cron. |
| Analytics charts page (`/analytics`) | **Fully implemented** | No | Catalog patterns; charts may use sample limits. |
| Settings: Sheets + OpenAI model + service account hint | **Fully implemented** | Partially | Operational necessity, not in Dennis’s feature list. |
| Avoid YouTube API (transcript path) | **Fully implemented** | Yes | Extension + ingest APIs are DOM/API-key-free for extension path. |
| Optional YouTube API (comments batch on sync) | **Partially implemented** | Contradicts “avoid” but optional | `YOUTUBE_API_KEY` on server sync only. |
| No auth / single global deployment | **Fully implemented** | Yes | Open APIs; research global to deployment — OK for internal team. |
| Docker deploy + production domain | **Fully implemented** | Implied | `tm1.website`; nginx + compose. |
| Semantic performance hardening (hybrid scores, cache) | **Fully implemented** | No | Improves daily use; not in original ask. |
| Tiny convenience: shortcuts, pins, saved searches, copy markdown | **Fully implemented** | No | Phase 9 polish; localStorage only. |
| i18n EN + Ukrainian | **Fully implemented** | No | Locale switcher; useful if team is bilingual. |
| Welcome onboarding tour | **Fully implemented** | No | First-run UX. |
| Compare depth loading (`core` → `extended`) | **Fully implemented** | No | Performance polish. |
| Creator intelligence in-memory cache | **Fully implemented** | No | TTL cache; invalidated on sync/snapshot. |

---

## Section 3 — What directly fulfills Dennis’s requests

Explicit mapping from Dennis ask → system capability:

| Dennis request | How ContentGraph fulfills it |
|----------------|------------------------------|
| **LangGraph system around collected YouTube data** | `backend/app/ai/` — 4-node graph: query_router → retrieval → analysis → response. Used from `/chat` and typed analysis paths. |
| **Collect creators** | Sheets sync → `videos.creator_name`; creator pages aggregate by name; creator profiles (LLM) optional. |
| **Collect video titles** | Sheets sync → `videos.title`; hook index + semantic search index titles. |
| **Collect transcripts** | Extension `POST /transcripts/ingest` (manual, Glasp-like); batch `TranscriptService` after sync (limited). Stored in `videos.transcript` + `transcript_embedding`. |
| **Collect comments** | Extension `POST /comments/ingest` (top liked, DOM); optional batch via YouTube Data API on sync. `comments` table + video intelligence. |
| **Unify into one system we can talk to** | Postgres catalog + pgvector + LangGraph chat + semantic search on dashboard; copilot ties pages together. |
| **Chrome extension for transcript extraction** | `extension/` — extract, copy, export, save; documented in `TRANSCRIPT_EXTENSION_ARCHITECTURE.md`. |
| **Top liked comments extraction** | Same extension panel — comments section; ingest sorts by likes, caps at 20. |
| **Cron for subscribers/views growth** | `snapshot_scheduler.py` + `creator_stats_history` / `video_stats_history`; growth on creator/compare pages when history exists. |
| **Avoid YouTube API if possible** | Transcript enrichment path designed without YT API; extension ingest without API keys. |
| **Manual-first / Glasp-like workflow** | Extension requires human on watch page + transcript panel; comments need scroll/load — intentional. |
| **Lightweight internal tool for 2–3 people** | No Clerk/auth, no multi-tenant, single research DB, Docker compose, minimal ops surfaces. |

**Caveats (honest):**

- **“Talk to”** is strongest in **Chat** and search; not every button runs LangGraph.
- **Growth cron** tracks changes in **synced sheet metrics**, not independent YouTube channel polling.
- **Unified** does not mean 100% of videos have transcripts/comments — only enriched ones.

---

## Section 4 — What was added beyond Dennis’s request

| Addition | Classification | Rationale |
|----------|----------------|-----------|
| Creator intelligence dashboard (growth charts, hooks mix, audience, momentum, semantic) | **Useful extension** | Turns “collect creators” into daily research hub. |
| Creator compare (`/compare`) | **Useful extension** | High leverage for competitive research; small team likely uses it. |
| Research workspace (collections + frozen snapshots) | **Useful extension** | Replaces ad-hoc notes; slight overlap with old `saved_insights`. |
| Semantic search hardening + transcript match labels | **Useful extension** | Fixes trust issues; directly supports research quality. |
| Sheets URL connection UX | **Useful extension** | Reduces onboarding friction; not a new system. |
| Extension onboarding page | **Useful extension** | Practical for unpacked Chrome install. |
| Copilot sidebar + feed cards | **Optional polish** | Helpful context; feed is **not** realtime trends — scope creep risk if misread. |
| Hooks + Scripts dedicated pages | **Future nice-to-have** / **optional polish** | Useful for content team; Dennis did not ask for separate “labs.” |
| Command palette + keyboard shortcuts | **Optional polish** | Fast for power users; 2–3 people may use lightly. |
| Pinned creators + saved searches (localStorage) | **Optional polish** | Convenience only; no server persistence. |
| Copy markdown summaries (compare, creator, etc.) | **Useful extension** | Internal sharing (Telegram/Notion) — aligns with research workflow. |
| i18n (EN/UK) | **Optional polish** | Only valuable if team needs Ukrainian UI. |
| Welcome tour | **Optional polish** | Good for first teammate onboarding. |
| Analytics page (charts) | **Optional polish** | Overlaps dashboard + creator pages. |
| In-memory intelligence cache | **Optional polish** | Ops/perf; invisible to product story. |
| OpenAI model picker in settings | **Operational** | Needed for experiments; not a Dennis feature. |
| Nav “More” dropdown / UX polish passes | **Optional polish** | Maturity, not new capability. |

### Probably unnecessary (for 2–3 internal users)

| Addition | Why |
|----------|-----|
| Dual research systems (`research_items` + legacy `saved_insights` / `research_notes`) | Cognitive overhead; could consolidate later. |
| Feed positioned as “intelligence” before copy fix | Risk of false expectations; now mitigated in UI. |
| Many primary nav destinations (6+) | Still manageable; borderline “mini-SaaS” navigation. |
| Full compare `extended` payload + UI sections | Power users only; `core` might suffice for daily use. |

---

## Section 5 — Overengineering audit

### Appropriate for 2–3 person internal tool

- **Single Postgres + FastAPI + Next.js** — right-sized.
- **Inline enrichment on sync** (no Kafka) — matches Dennis constraints.
- **Extension + ingest APIs** — correct pattern for manual-first data.
- **LangGraph only for chat** — sensible cost/latency split vs copilot SQL.
- **Deterministic feed** — OK if labeled as catalog signals (now is).
- **Daily snapshots in-process** — OK for one server; not distributed cron platform.

### Drifting toward “startup SaaS behavior” (but not fatal)

| Signal | Assessment |
|--------|------------|
| 10+ top-level product areas (dashboard, feed, creators, compare, research, chat, hooks, scripts, analytics, extension) | Broad surface for 3 users; still one codebase — **moderate drift**. |
| Multiple LLM entry points (chat, hooks, scripts, video refresh, creator profile) | Operational cost (API $) — **watch spend**, not wrong architecturally. |
| Research workspace with 7 item types + collections | Slight product-management complexity — **acceptable** if team saves research often. |
| Performance/cache layers for compare + intelligence | Engineering maturity — **not user-visible complexity**. |

### Still lightweight enough?

**Yes**, with caveats:

- No auth/multi-tenant is the biggest proof of discipline.
- No job queue or microservices.
- Data model is still ~10 tables, not an ETL platform.

**Risk:** New teammates may think ContentGraph is a “full creator analytics SaaS” because of UI breadth — **documentation and nav grouping matter more than more code**.

---

## Section 6 — Current system maturity

### What ContentGraph is today (product framing)

ContentGraph Lite is an **internal YouTube creator intelligence workspace**:

1. **Catalog layer** — Google Sheets as source of truth, enriched in Postgres.
2. **Manual enrichment layer** — Chrome extension for transcripts and comments (Glasp-style).
3. **Semantic research layer** — Hybrid search over titles, transcripts, and comment text.
4. **Structured AI layer** — LangGraph chat for routed analytics (hooks, audience, compare-in-chat, etc.).
5. **Time-series layer** — Daily snapshots for growth/breakout views (when history accumulates).
6. **Persistence layer** — Research workspace for saved snapshots and notes.

It is **not**:

- A realtime YouTube trend monitor.
- A replacement for YouTube Studio or Social Blade.
- A collaborative multi-user SaaS (no accounts, shared global research).

### Maturity level (honest)

| Dimension | Maturity |
|-----------|----------|
| Core ingestion (Sheets) | **Production-ready** |
| Extension ingest | **Production-ready**, DOM-fragile (YouTube UI changes) |
| Semantic search | **Production-ready**, tuning ongoing (transcript coverage) |
| LangGraph chat | **Production-ready**, model-dependent |
| Growth analytics | **Early** until weeks of snapshots exist |
| UX cohesion | **Good** after dashboard/feed/settings passes |
| Security | **Internal-trust model** — not internet-hardened |

---

## Section 7 — Remaining gaps

Only **realistic** gaps relative to Dennis’s vision — not a fantasy backlog.

### Data coverage gaps

- **Transcript coverage** — Many videos likely title-only embeddings; team must run extension (or batch) per video.
- **Comment coverage** — Audience cards/feed audience signals empty when comments not ingested.
- **Snapshot history depth** — Growth/breakout needs **days/weeks** of cron runs; new deploys start cold.
- **Sheet freshness** — Growth tracking reflects **last sync**, not live YouTube unless sheet is updated and re-synced.

### Product / UX gaps

- **Single “talk to everything” entry** — Chat is primary; newer users may not discover compare/research/extension flow without onboarding.
- **Extension reliability** — YouTube DOM changes can break selectors; no auto-update from Web Store.
- **Legacy + new research APIs** — Two save patterns coexist (`saved_insights` vs `research_items`).
- **No per-user workspaces** — Fine for Dennis scale; awkward if team grows without auth.

### Quality gaps

- **Semantic tuning** when transcript share is low — hybrid scoring helps but cannot invent transcripts.
- **Export polish** — Copy markdown exists; no unified “research report” export across workspace.
- **Permission errors** — Sheets share with service account must be taught (settings hint helps).

### Not gaps (do not treat as missing)

- Multi-tenant auth, billing, Chrome Web Store, realtime global trends, video upload pipelines, social scheduling, etc.

---

## Section 8 — Suggested finish line

### MVP-complete per Dennis’s original vision

Stop when all of the following are **true in daily practice** (not merely deployed):

1. **Sheet connected** — Team uses paste-URL settings; sync runs reliably; catalog has the creators/videos they care about.
2. **Extension in use** — Each researcher has unpacked extension; workflow documented on `/extension`; transcripts + comments saved for priority videos.
3. **Chat trustworthy** — LangGraph answers catalog questions with acceptable accuracy; semantic search finds relevant videos when transcripts exist.
4. **Cron running** — Daily snapshots enabled in production; at least **7–14 days** of history for growth views to mean something.
5. **Operational basics** — Service account shared on sheets; OpenAI key + model stable; occasional re-sync after sheet edits.
6. **Team onboarding** — 30-minute walkthrough: sync → extension → dashboard search → chat → (optional) compare/research save.

### Realistic stop point (do not keep building)

- **No new major surfaces** (no new labs, marketplaces, auth, queues).
- **Only fix**: extension breakage, ingest bugs, search trust, and onboarding copy.
- **Optional maintenance**: expand alias lists, snapshot backfill, more transcript passes via extension — **data work**, not feature work.

### Explicit non-goals for “done”

- 100% transcript/comment coverage of catalog.
- Real-time YouTube analytics without sheet updates.
- Enterprise security review.
- Public product launch.

---

## Section 9 — Final verdict

### Verdict: **Mostly yes — original concept implemented; scope exceeded in UI and research surfaces**

| Question | Answer |
|----------|--------|
| Did we build what Dennis asked for? | **Yes, on all major pillars:** unified DB, Sheets ingest, extension transcripts/comments, LangGraph chat, cron snapshots, manual-first enrichment, small-team deployment. |
| Is anything critical missing? | **No single missing “system.”** Gaps are **coverage and time** (transcripts, comments, snapshot history), not absent architecture. |
| Did we go beyond the ask? | **Clearly yes** — compare mode, research workspace, feed, hooks/scripts labs, copilot, performance hardening, convenience polish, bilingual UI. |
| Was the extra scope valuable? | **Mostly yes** for a research team; **some** surfaces (feed hype, dual research saves, nav breadth) add cognitive load without blocking Dennis MVP. |
| Overengineered? | **Slightly broad UI**, but **backend discipline stayed lightweight** (no queues, no auth platform). Appropriate for enthusiastic internal tool; would be heavy for a throwaway script. |

### One-sentence summary

**ContentGraph successfully became Dennis’s LangGraph-backed, sheet-driven, extension-enriched YouTube research workspace — and then grew extra research UI (compare, workspace, intelligence pages) that is genuinely useful for a small team but is not required to declare the original vision “done.”**

### Recommended focus from here

1. **Data habit** — extension usage + sheet sync cadence.  
2. **Time** — let snapshots accumulate.  
3. **Stop feature phases** unless a clear Dennis-request gap appears (e.g. extension broken on YouTube).  
4. **Document the daily loop** — sync → enrich priority videos → search/chat → save to research — in one internal README for new teammates.

---

## Appendix — Source references in repo

| Topic | Document / path |
|-------|------------------|
| Project intent | `docs/PROJECT_OVERVIEW.md` |
| LangGraph | `docs/AI_SYSTEMS.md` |
| Extension | `docs/TRANSCRIPT_EXTENSION_ARCHITECTURE.md`, `extension/` |
| Comments | `docs/COMMENTS_INGEST_ARCHITECTURE.md` |
| Snapshots / cron | `docs/HISTORICAL_ANALYTICS_ARCHITECTURE.md` |
| Compare | `docs/CREATOR_COMPARE_ARCHITECTURE.md` |
| Research | `docs/RESEARCH_WORKSPACE_ARCHITECTURE.md` |
| Semantic perf | `docs/SEMANTIC_PERFORMANCE_HARDENING.md` |
| Sheets UX | `docs/SHEETS_CONNECTION_UX.md` |
| Convenience | `docs/TINY_CONVENIENCE_IMPROVEMENTS.md` |
| User-facing | `docs/USER_GUIDE.md` |

---

*Audit reflects codebase and docs as of 2026-05-22. No application code was modified to produce this document.*
