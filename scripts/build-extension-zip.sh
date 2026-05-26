#!/usr/bin/env bash
# Package extension/ → frontend/public/downloads/contentgraph-extension.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT/extension"
OUT_DIR="$ROOT/frontend/public/downloads"
ZIP="$OUT_DIR/contentgraph-extension.zip"
META="$OUT_DIR/extension-meta.json"

if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "Missing $EXT_DIR/manifest.json" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
python3 - "$EXT_DIR" "$ZIP" "$META" <<'PY'
import json
import os
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ext_dir = Path(sys.argv[1])
zip_path = Path(sys.argv[2])
meta_path = Path(sys.argv[3])

manifest = json.loads((ext_dir / "manifest.json").read_text())
skip = {".DS_Store"}

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(ext_dir.rglob("*")):
        if path.is_dir():
            continue
        if path.name in skip or "__MACOSX" in path.parts:
            continue
        arc = path.relative_to(ext_dir).as_posix()
        zf.write(path, arc)

size = zip_path.stat().st_size
meta = {
    "version": manifest.get("version", "0.0.0"),
    "name": manifest.get("name", "ContentGraph Extension"),
    "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "sizeBytes": size,
    "filename": zip_path.name,
}
meta_path.write_text(json.dumps(meta, indent=2) + "\n")
print(f"Built {zip_path} ({size} bytes, v{meta['version']})")
PY
