#!/usr/bin/env bash
# Package worker + extension + README → frontend/public/downloads/contentgraph-browser-worker.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_DIR="$ROOT/worker"
EXT_DIR="$ROOT/extension"
OUT_DIR="$ROOT/frontend/public/downloads"
ZIP="$OUT_DIR/contentgraph-browser-worker.zip"

for path in "$WORKER_DIR/package.json" "$EXT_DIR/manifest.json"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing $path" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -R "$WORKER_DIR" "$TMP/worker"
rm -rf "$TMP/worker/node_modules" "$TMP/worker/dist" "$TMP/worker/screenshots" 2>/dev/null || true
cp -R "$EXT_DIR" "$TMP/extension"

python3 - "$TMP" "$ZIP" <<'PY'
import sys
import zipfile
from pathlib import Path

root = Path(sys.argv[1])
zip_path = Path(sys.argv[2])
skip = {".DS_Store", "node_modules", "__pycache__", ".git"}

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(root.rglob("*")):
        if path.is_dir():
            continue
        if any(p in skip for p in path.parts):
            continue
        if path.name in skip:
            continue
        arc = path.relative_to(root).as_posix()
        zf.write(path, arc)

print(f"Built {zip_path} ({zip_path.stat().st_size} bytes)")
PY
