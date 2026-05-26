# Development Setup

Guide to running **ContentGraph Lite** locally for development and troubleshooting.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Docker + Docker Compose | Latest recommended |
| **OR** Python | 3.11 or 3.12 |
| **OR** Node.js | 18+ (for frontend) |
| PostgreSQL | 16 with pgvector (if not using Docker) |

---

## Quick Start (Docker — Recommended)

### 1. Clone and configure env

From project root `/Users/macbook/Desktop/YT`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_RANGE=Sheet1!A:F
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
YOUTUBE_API_KEY=your_youtube_data_api_key
```

### 2. Google Sheets credentials

```bash
mkdir -p backend/credentials
cp /path/to/service-account.json backend/credentials/service_account.json
```

Share your spreadsheet with the service account email (Viewer).

### 3. Start stack

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3002 |
| Backend API | http://localhost:8001 |
| Swagger | http://localhost:8001/docs |
| Postgres | localhost:5433 (host) → 5432 (container) |

> **Port note:** Compose maps **8001 / 3002 / 5433** on the host to avoid clashes with other local stacks on 8000 / 3000 / 5432. Override with `SMOKE_BASE_URL`, `FRONTEND_URL`, and `DATABASE_URL` when running `./scripts/test_smoke.sh`.

### 4. Run migrations (first time)

Migrations run automatically if your Docker backend entrypoint includes them. If not:

```bash
docker compose exec backend alembic upgrade head
```

### 5. Sync data

Open dashboard → **Sync Google Sheets**, or:

```bash
curl -X POST http://localhost:8000/api/v1/sheets/sync
```

---

## Local Development (Without Docker)

### PostgreSQL

Start Postgres 16 with pgvector:

```bash
# Example with Docker only for DB
docker run -d --name cg-postgres \
  -e POSTGRES_USER=contentgraph \
  -e POSTGRES_PASSWORD=contentgraph \
  -e POSTGRES_DB=contentgraph \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# .env in backend/ or project root (Settings reads .env)
export DATABASE_URL=postgresql+asyncpg://contentgraph:contentgraph@localhost:5432/contentgraph
export OPENAI_API_KEY=sk-...
export GOOGLE_SHEETS_SPREADSHEET_ID=...

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Place `credentials/service_account.json` relative to backend working directory (see `GOOGLE_SERVICE_ACCOUNT_FILE` in settings — default `credentials/service_account.json`).

### Frontend

```bash
cd frontend
npm install
export NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev
```

Open http://localhost:3002

### Smoke verification (one command)

```bash
./scripts/test_smoke.sh
```

Runs container health checks, Alembic/schema verification, `pytest` in `backend/tests/`, frontend build, and route HTTP checks.

---

## Environment Variables

### Root / Docker `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | For sync | Spreadsheet ID from URL |
| `GOOGLE_SHEETS_RANGE` | No | Default `Sheet1!A:F` |
| `OPENAI_API_KEY` | For AI | Chat, embeddings, profiles |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `YOUTUBE_API_KEY` | For comments | YouTube Data API v3 key |

### Backend-only (Settings)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | local async URL | SQLAlchemy connection |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | `credentials/service_account.json` | Path to SA JSON |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embeddings |
| `EMBEDDING_DIMENSIONS` | 1536 | Vector size |
| `TRANSCRIPT_ENRICH_LIMIT` | 30 | Videos per sync |
| `TRANSCRIPT_EMBED_MAX_CHARS` | 8000 | Truncate before embed |
| `COMMENTS_MAX_PER_VIDEO` | 25 | Top comments stored |
| `COMMENTS_ENRICH_LIMIT` | 15 | Videos enriched per sync |

### Frontend

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` |

---

## Google Sheets Setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create project
2. Enable **Google Sheets API**
3. Create **Service Account** → download JSON key
4. Copy key to `backend/credentials/service_account.json`
5. Share spreadsheet with `xxxx@xxxx.iam.gserviceaccount.com` (Viewer)
6. Copy spreadsheet ID from URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### Sheet columns

| Name | URL | Subscribers | Titles | Views | Date |
|------|-----|-------------|--------|-------|------|

Header names are matched case-insensitively with aliases.

---

## YouTube API Setup (Comments)

1. Google Cloud Console → enable **YouTube Data API v3**
2. Create API key (restrict by IP in production)
3. Set `YOUTUBE_API_KEY` in `.env`

Without this key:
- Sync still works
- Comments sections stay empty
- `POST /videos/{id}/comments/fetch` returns 503

---

## OpenAI Setup

1. Create API key at https://platform.openai.com/
2. Set `OPENAI_API_KEY`
3. Optional: set `OPENAI_MODEL` (default `gpt-4o-mini`)

Used for:
- Chat / LangGraph
- Embeddings (`text-embedding-3-small`)
- Creator profiles, hook/script generation

Without OpenAI:
- `POST /chat` → 503
- Embeddings on sync may fail
- Semantic search degraded

---

## Database Migrations

```bash
cd backend
alembic upgrade head    # apply all
alembic current         # check revision
alembic history         # list migrations
```

Migrations: `001` videos → `007` comments (see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)).

---

## Docker Compose Services

```yaml
postgres  → pgvector/pgvector:pg16 :5432
backend   → FastAPI :8000
frontend  → Next.js :3000
```

Backend mounts `./backend/credentials` read-only.

---

## Troubleshooting

### Sync fails / "Spreadsheet not found"

- Verify `GOOGLE_SHEETS_SPREADSHEET_ID`
- Confirm service account has access to sheet
- Check `GOOGLE_SHEETS_RANGE` matches tab name

### `OPENAI_API_KEY is not configured`

- Set key in `.env` and restart backend
- Docker: pass via `docker compose` env interpolation

### Semantic search returns nothing

- Run sync first
- Check `embeddings_created` in sync result > 0
- Ensure OpenAI key valid for embedding calls

### No transcripts

- youtube-transcript-api may fail for some videos (no captions)
- Increase `TRANSCRIPT_ENRICH_LIMIT` in settings
- Re-sync after fixing caption availability

### No comments

- Set `YOUTUBE_API_KEY`
- YouTube quota limits — reduce `COMMENTS_ENRICH_LIMIT`
- Manually: `POST /videos/{id}/comments/fetch`

### CORS errors in browser

- Add frontend origin to `CORS_ORIGINS`
- Match `NEXT_PUBLIC_API_URL` to backend port

### pgvector extension error

- Use `pgvector/pgvector:pg16` image
- App calls `ensure_pgvector_extension()` on startup

### Frontend: "useCommandPalette requires CommandPaletteProvider"

- Ensure `Nav` is inside `AppProviders` in `layout.tsx` (already fixed in codebase)

### Alembic / DB connection

- `DATABASE_URL` must use `postgresql+asyncpg://` driver
- Wait for Postgres healthcheck before backend starts (Compose)

### Python version issues

- Use 3.11 or 3.12; 3.14 may break some dependencies locally

---

## Useful Commands

```bash
# Health
curl http://localhost:8000/health

# Sync
curl -X POST http://localhost:8000/api/v1/sheets/sync

# Chat
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What topics trend in my catalog?"}'

# Frontend production build
cd frontend && npm run build
```

---

## Documentation Index

| Doc | Topic |
|-----|-------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | System overview |
| [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) | Backend modules |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | UI structure |
| [AI_SYSTEMS.md](./AI_SYSTEMS.md) | LangGraph & intelligence |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Tables & migrations |
| [API_REFERENCE.md](./API_REFERENCE.md) | HTTP API |
| [USER_GUIDE.md](./USER_GUIDE.md) | Product usage |

---

## Project Root README

See also `/README.md` for a shorter quick-start summary.
