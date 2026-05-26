#!/bin/bash
set -euo pipefail
cd /opt/contentgraph

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://188.40.152.222:8001/api/v1}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://188.40.152.222,http://188.40.152.222:80,http://vps88185.majorcore.host,http://vps88185.majorcore.host:80}"

docker compose -f docker-compose.yml -f docker-compose.prod.yml build

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "--- Status ---"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo "--- Backend health (wait up to 90s) ---"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8001/health >/dev/null 2>&1; then
    curl -s http://127.0.0.1:8001/health
    echo ""
    break
  fi
  sleep 3
done

curl -sf -o /dev/null -w "Frontend HTTP %{http_code}\n" http://127.0.0.1:80/ || true
