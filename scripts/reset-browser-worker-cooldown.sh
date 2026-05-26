#!/usr/bin/env bash
# Reset browser ingestion worker cooldown (dashboard + optional local worker state).
# Does not change application code or disable safety limits.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STATE_FILE="${WORKER_STATE_DIR:-$HOME/.contentgraph-worker/state}/safety-state.json"

reset_local_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "Local safety state not found (skip): $STATE_FILE"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "node not found — cannot patch $STATE_FILE (install node or edit file manually)"
    return 1
  fi
  node -e "
const fs = require('fs');
const p = process.argv[1];
let s = {};
try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
s.consecutiveFailures = 0;
s.cooldownUntil = null;
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log('Reset local safety state:', p);
" "$STATE_FILE"
}

reset_api() {
  local base="${CONTENTGRAPH_API_URL:-https://tm1.website/api/v1}"
  if curl -fsS -X POST "${base}/browser-ingestion/workers/reset-cooldown" -o /dev/null; then
    echo "API reset-cooldown OK (${base})"
    return 0
  fi
  echo "API reset-cooldown failed (deploy backend or check URL)"
  return 1
}

reset_db() {
  if ! docker compose ps postgres -q 2>/dev/null | grep -q .; then
    echo "Postgres container not running — skip DB reset"
    return 1
  fi
  docker compose exec -T postgres psql -U contentgraph -d contentgraph -v ON_ERROR_STOP=1 <<'SQL'
UPDATE browser_ingestion_workers
SET
  status = CASE WHEN status = 'cooldown' THEN 'online' ELSE status END,
  stats_json = COALESCE(stats_json, '{}'::jsonb)
    || jsonb_build_object(
      'consecutive_failures', 0,
      'cooldown_until', NULL,
      'current_phase', 'idle'
    )
WHERE status = 'cooldown'
   OR stats_json->>'cooldown_until' IS NOT NULL
   OR COALESCE((stats_json->>'consecutive_failures')::int, 0) > 0;

SELECT id, name, status,
       stats_json->>'consecutive_failures' AS consecutive_failures,
       stats_json->>'cooldown_until' AS cooldown_until
FROM browser_ingestion_workers
ORDER BY id;
SQL
}

echo "=== Reset browser worker cooldown (API + DB) ==="
reset_api || true
reset_db || true

echo ""
echo "=== Reset local worker safety state (optional) ==="
reset_local_state || true

echo ""
echo "Done. If worker is running on your laptop, restart it (Ctrl+C, npm start) so the next heartbeat stays online."
