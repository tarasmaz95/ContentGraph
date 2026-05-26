#!/usr/bin/env bash
# ContentGraph Lite — lightweight smoke verification
# 1) Docker services healthy
# 2) Alembic at head + DB schema
# 3) Backend HTTP smoke tests
# 4) Frontend production build
#
# Usage: ./scripts/test_smoke.sh
# Env:   SMOKE_BASE_URL, DATABASE_URL (optional overrides)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://localhost:8001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3002}"
DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://contentgraph:contentgraph@localhost:5433/contentgraph}"
export SMOKE_BASE_URL DATABASE_URL

# Load .env for spreadsheet id / keys when running tests from host
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PASS=0
FAIL=0
SKIP=0

log() { printf '\n▶ %s\n' "$*"; }
ok()  { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$*"; }
bad() { FAIL=$((FAIL + 1)); printf '  ✗ %s\n' "$*"; }
skip_msg() { SKIP=$((SKIP + 1)); printf '  ○ %s\n' "$*"; }

wait_http() {
  local url="$1" label="$2" max="${3:-60}"
  local i=0
  while [[ $i -lt $max ]]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok "$label"
      return 0
    fi
    sleep 2
    i=$((i + 2))
  done
  bad "$label (timeout ${max}s)"
  return 1
}

# --- 1. Containers ---
log "Docker Compose services"
if ! docker compose ps --status running 2>/dev/null | grep -q postgres; then
  log "Starting stack (docker compose up -d --build)…"
  docker compose up -d --build
fi

# Postgres — healthcheck / pg_isready (no HTTP)
if docker compose ps postgres 2>/dev/null | grep -q healthy; then
  ok "postgres healthy"
else
  # fallback: pg_isready
  if docker compose exec -T postgres pg_isready -U contentgraph -d contentgraph >/dev/null 2>&1; then
    ok "postgres ready (pg_isready)"
  else
    bad "postgres not ready"
  fi
fi

wait_http "${SMOKE_BASE_URL}/health" "backend /health" 90
wait_http "${FRONTEND_URL}" "frontend" 120

# --- 2. Migrations + DB schema ---
log "Alembic migrations"
if docker compose exec -T backend alembic upgrade head >/dev/null 2>&1; then
  ok "alembic upgrade head"
else
  bad "alembic upgrade head"
fi

log "Database checks (pgvector, tables, head revision)"
if docker compose exec -T postgres psql -U contentgraph -d contentgraph -tAc \
  "SELECT 1 FROM pg_extension WHERE extname='vector'" 2>/dev/null | grep -q 1; then
  ok "pgvector extension"
else
  bad "pgvector extension"
fi

TABLES="videos creator_profiles saved_insights research_notes hook_patterns comments"
for t in $TABLES; do
  if docker compose exec -T postgres psql -U contentgraph -d contentgraph -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$t'" 2>/dev/null | grep -q 1; then
    ok "table $t"
  else
    bad "table $t"
  fi
done

REV=$(docker compose exec -T postgres psql -U contentgraph -d contentgraph -tAc \
  "SELECT version_num FROM alembic_version" 2>/dev/null | tr -d '[:space:]')
if [[ "$REV" == "007" ]]; then
  ok "alembic revision 007"
else
  bad "alembic revision (got ${REV:-empty}, want 007)"
fi

# --- 3. Backend pytest smoke ---
log "Backend smoke tests (pytest)"
if [[ -d "$ROOT/backend/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
fi

pip install -q -r "$ROOT/backend/requirements.txt" 2>/dev/null || true

if (
  cd "$ROOT/backend"
  export PYTHONPATH="$ROOT/backend"
  pytest tests/ -v --tb=short -q
); then
  ok "pytest smoke suite"
else
  bad "pytest smoke suite"
fi

# --- 4. Frontend build ---
log "Frontend production build"
if (cd "$ROOT/frontend" && npm run build >/dev/null 2>&1); then
  ok "next build"
else
  bad "next build"
fi

# --- 5. Frontend routes (HTTP smoke) ---
log "Frontend routes (HTTP 200)"
ROUTES="/ /dashboard /welcome /chat /creators /hooks /scripts /research /feed /analytics"
for route in $ROUTES; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}${route}" || echo "000")
  if [[ "$code" == "200" ]]; then
    ok "GET ${route}"
  else
    bad "GET ${route} (HTTP ${code})"
  fi
done

# --- Summary ---
printf '\n══════════════════════════════════════\n'
printf 'Smoke summary: %d passed checks, %d failed, %d skipped notes\n' "$PASS" "$FAIL" "$SKIP"
printf 'Backend:  %s\n' "$SMOKE_BASE_URL"
printf 'Frontend: %s\n' "$FRONTEND_URL"
printf '══════════════════════════════════════\n'

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi

exit 0
