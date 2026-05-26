#!/bin/bash
# One-time VPS bootstrap for ContentGraph (run as root on the server)
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git rsync

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable docker
systemctl start docker

# Allow HTTP + API (optional external API port)
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 80/tcp || true
  ufw allow 8001/tcp || true
  ufw --force enable || true
fi

mkdir -p /opt/contentgraph
echo "Docker ready: $(docker --version)"
