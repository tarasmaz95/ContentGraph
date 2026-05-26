# API Reference

Base URL (local): `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

Health check (no prefix): `GET http://localhost:8000/health`

---

## Authentication

No auth in v1 — internal/trusted network assumed. CORS allows configured origins (default `http://localhost:3000`).

---

## Common Headers

```http
Content-Type: application/json
```

---

## Sheets

### `POST /sheets/sync`

Sync Google Sheets → Postgres + enrichments.

**Response** `SyncResult`:

```json
{
  "created": 5,
  "updated": 12,
  "total_rows": 17,
  "embeddings_created": 5,
  "transcripts_fetched": 10,
  "transcript_embeddings_created": 10,
  "hooks_indexed": 42,
  "comments_fetched": 8
}
```

---

## Videos

### `GET /videos`

| Query | Type | Default |
|-------|------|---------|
| `limit` | int 1–500 | 100 |
| `offset` | int ≥0 | 0 |

**Response:**

```json
{
  "videos": [{ "id": 1, "creator_name": "Dan Koe", "title": "...", "views_count": 100000, "has_transcript": true, "transcript_preview": "..." }],
  "total": 150
}
```

### `GET /videos/top`

| Query | Default |
|-------|---------|
| `limit` | 10 (max 50) |

Returns `VideoRead[]` sorted by views.

### `GET /videos/search`

| Query | Required |
|-------|----------|
| `q` | yes |
| `limit` | 50 |

Keyword search (ILIKE on title/creator).

### `GET /videos/semantic-search`

| Query | Required |
|-------|----------|
| `q` | yes (natural language) |
| `limit` | 30 |

**Example:** `/videos/semantic-search?q=identity+transformation&limit=20`

Returns videos with `similarity_score`, `match_source` (`title` | `transcript` | `both`).

### `GET /videos/{video_id}`

Full video including `transcript` when available.

### `GET /videos/{video_id}/intelligence`

| Query | Description |
|-------|-------------|
| `refresh` | bool — regenerate LLM sections |

Returns `VideoIntelligence` (breakdown, transcript analysis, viral factors, similar videos, audience, charts).

### `POST /videos/{video_id}/comments/fetch`

Requires `YOUTUBE_API_KEY`.

**Response:**

```json
{ "video_id": 123, "comments_saved": 25 }
```

---

## Creators

### `GET /creators`

List all creators with video counts and `has_profile` flag.

### `GET /creators/{creator_name}`

| Query | Description |
|-------|-------------|
| `refresh` | Regenerate AI profile |

Accepts display name or slug (`dan-koe`).

### `GET /creators/{creator_name}/analytics`

Creator page payload: overview, charts, hook/topic sections.

### `GET /creators/{creator_name}/semantic-search`

| Query | Required |
|-------|----------|
| `q` | yes |
| `limit` | 20 |

Scoped semantic search for one creator.

### `POST /creators/compare`

**Body:**

```json
{
  "creators": ["Dan Koe", "Ali Abdaal"]
}
```

**Response:** `CreatorComparisonResult` with per-creator stats, hook differences, positioning summary.

---

## Hooks

### `GET /hooks/workspace`

Workspace stats: hook type distribution, top performers, indexed count.

### `GET /hooks/search`

| Query | Required |
|-------|----------|
| `q` | search string |
| `limit` | optional |

Returns `HookSearchResult[]`.

### `POST /hooks/generate`

**Body:**

```json
{
  "creator_name": "Dan Koe",
  "topic": "discipline",
  "hook_type": "curiosity",
  "tone": "bold",
  "count": 10
}
```

### `POST /hooks/compare`

**Body:**

```json
{
  "hook_types": ["curiosity", "identity"],
  "creator_name": "Dan Koe"
}
```

### `POST /hooks/reindex`

Rebuild `hook_patterns` from all videos. Returns count indexed.

---

## Scripts

### `GET /scripts/workspace`

Script workspace overview (creators, sample topics).

### `POST /scripts/generate`

**Body:**

```json
{
  "creator_name": "Dan Koe",
  "topic": "focus and discipline",
  "hook_type": "identity",
  "tone": "philosophical",
  "duration": "10 minutes"
}
```

### `POST /scripts/analyze`

**Body:**

```json
{
  "creator_name": "Dan Koe",
  "script_text": "Optional pasted script..."
}
```

### `POST /scripts/compare`

**Body:**

```json
{
  "creators": ["Dan Koe", "Ali Abdaal"],
  "topic": "productivity"
}
```

---

## Analytics

### `GET /analytics/dashboard`

Full dashboard analytics: patterns, keywords, hook stats, charts (`DashboardCharts`).

---

## Research

### `GET /research/workspace`

Combined insights + notes + summary counts.

### `GET /research/summary`

Lightweight summary for widgets.

### `GET /research/search?q=...`

Search insights, notes, tags.

### `GET /research/export/markdown`

**Response:**

```json
{ "markdown": "# Research Export\n\n..." }
```

### Insights CRUD

| Method | Path | Body |
|--------|------|------|
| GET | `/research/insights` | — |
| POST | `/research/insights` | `SavedInsightCreate` |
| DELETE | `/research/insights/{id}` | — |

**POST body example:**

```json
{
  "insight_text": "Curiosity hooks outperform by 40% for AI topics",
  "source_type": "chat",
  "source_reference": "hook analysis query",
  "tags": ["hooks", "ai"]
}
```

### Notes CRUD

| Method | Path |
|--------|------|
| GET | `/research/notes` |
| POST | `/research/notes` |
| PATCH | `/research/notes/{id}` |
| DELETE | `/research/notes/{id}` |

**POST body example:**

```json
{
  "title": "Dan Koe comparison notes",
  "content": "Identity hooks dominate top 10 videos...",
  "type": "creator_finding",
  "creator_name": "Dan Koe",
  "tags": ["comparison"]
}
```

---

## Copilot

### `POST /copilot/panel`

| Query | Values |
|-------|--------|
| `context` | dashboard, creator, video, research, chat, hooks, analytics |
| `creator_name` | optional |
| `video_id` | optional |

**Body (optional)** `PersonalizationInput`:

```json
{
  "recent_searches": ["discipline", "dan koe"],
  "viewed_creators": ["Dan Koe"]
}
```

**Response:** insights, recommendations, optional brief preview.

### `GET /copilot/panel`

Same query params, no personalization body.

### `GET /copilot/feed`

| Query | Default |
|-------|---------|
| `limit` | 20 (max 50) |

Intelligence feed cards.

### Briefs

| Endpoint | Description |
|----------|-------------|
| `GET /copilot/brief/creator/{creator_name}` | Creator brief |
| `GET /copilot/brief/video/{video_id}` | Video brief |
| `GET /copilot/brief/audience/{video_id}` | Audience brief |
| `GET /copilot/brief/trend` | Catalog trend brief |

### `GET /copilot/research-assistant`

| Query | Description |
|-------|-------------|
| `tags` | Comma-separated |
| `creator` | Creator name filter |

Returns related insights, suggested tags, creators.

---

## Chat (AI)

### `POST /chat`

**Body:**

```json
{
  "message": "What makes Dan Koe successful?"
}
```

**Response:**

```json
{
  "reply": "## Dan Koe\n\n...",
  "analysis_type": "creator_profile",
  "relevant_videos": [
    {
      "id": 1,
      "creator_name": "Dan Koe",
      "title": "...",
      "views_count": 500000,
      "subscribers_count": 1000000,
      "has_transcript": true,
      "transcript_snippet": "...",
      "match_source": "title",
      "similarity_score": 0.82
    }
  ],
  "insights": [
    "Identity hooks appear in 60% of top-performing titles",
    "Average views 2.3× catalog median"
  ],
  "structured": {
    "analysis_type": "creator_profile",
    "metrics": { "total_videos": 45, "avg_views": 120000 },
    "creator_profile": { }
  },
  "context_videos_used": 45,
  "suggestions": [
    "Compare Dan Koe vs another creator in your catalog",
    "Generate 10 curiosity hooks for Dan Koe"
  ]
}
```

**Errors:**
- `503` — `OPENAI_API_KEY` not configured

---

## Error Format

FastAPI default:

```json
{ "detail": "Video not found" }
```

---

## Endpoint Index

| Method | Path |
|--------|------|
| GET | `/health` (root) |
| POST | `/sheets/sync` |
| GET | `/videos` |
| GET | `/videos/top` |
| GET | `/videos/search` |
| GET | `/videos/semantic-search` |
| GET | `/videos/{id}` |
| GET | `/videos/{id}/intelligence` |
| POST | `/videos/{id}/comments/fetch` |
| GET | `/creators` |
| GET | `/creators/{name}` |
| GET | `/creators/{name}/analytics` |
| GET | `/creators/{name}/semantic-search` |
| POST | `/creators/compare` |
| GET | `/hooks/workspace` |
| GET | `/hooks/search` |
| POST | `/hooks/generate` |
| POST | `/hooks/compare` |
| POST | `/hooks/reindex` |
| GET | `/scripts/workspace` |
| POST | `/scripts/generate` |
| POST | `/scripts/analyze` |
| POST | `/scripts/compare` |
| GET | `/analytics/dashboard` |
| GET | `/research/workspace` |
| GET | `/research/summary` |
| GET | `/research/search` |
| GET | `/research/export/markdown` |
| GET/POST | `/research/insights` |
| DELETE | `/research/insights/{id}` |
| GET/POST | `/research/notes` |
| PATCH/DELETE | `/research/notes/{id}` |
| POST/GET | `/copilot/panel` |
| GET | `/copilot/feed` |
| GET | `/copilot/brief/*` |
| GET | `/copilot/research-assistant` |
| POST | `/chat` |

---

## Related Docs

- [USER_GUIDE.md](./USER_GUIDE.md)
- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)
