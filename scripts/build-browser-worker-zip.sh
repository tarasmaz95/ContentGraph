#!/usr/bin/env bash
# Package worker + extension → frontend/public/downloads/contentgraph-browser-worker.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_DIR="$ROOT/worker"
EXT_DIR="$ROOT/extension"
OUT_DIR="$ROOT/frontend/public/downloads"
ZIP="$OUT_DIR/contentgraph-browser-worker.zip"
META="$OUT_DIR/worker-meta.json"
ROOT_ZIP="$ROOT/contentgraph-extension-worker.zip"

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
# Ready-to-run .env (user only adds WORKER_TOKEN from dashboard)
cp "$WORKER_DIR/.env.example" "$TMP/worker/.env"
cp -R "$EXT_DIR" "$TMP/extension"

python3 - "$TMP" "$ZIP" "$META" "$WORKER_DIR/package.json" "$EXT_DIR/manifest.json" <<'PY'
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

root = Path(sys.argv[1])
zip_path = Path(sys.argv[2])
meta_path = Path(sys.argv[3])
worker_pkg = json.loads(Path(sys.argv[4]).read_text())
manifest = json.loads(Path(sys.argv[5]).read_text())
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

ext_ver = manifest.get("version", "0.0.0")
worker_ver = worker_pkg.get("version", "0.0.0")
# Ship worker + extension as one bundle — version follows extension release.
bundle_ver = ext_ver

size = zip_path.stat().st_size
meta = {
    "version": bundle_ver,
    "extensionVersion": ext_ver,
    "workerVersion": worker_ver,
    "name": "ContentGraph Browser Worker",
    "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "sizeBytes": size,
    "filename": zip_path.name,
}
meta_path.write_text(json.dumps(meta, indent=2) + "\n")
print(f"Built {zip_path} ({size} bytes, bundle v{bundle_ver}, ext v{ext_ver}, worker v{worker_ver})")
PY

cp "$ZIP" "$ROOT_ZIP"
echo "Copied to $ROOT_ZIP"
