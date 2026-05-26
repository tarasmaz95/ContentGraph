#!/bin/bash
# Install nginx reverse proxy + Let's Encrypt SSL for tm1.website
set -euo pipefail

DOMAIN="${DOMAIN:-tm1.website}"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

mkdir -p /var/www/certbot

cp /opt/contentgraph/deploy/nginx/tm1.website.conf \
  "/etc/nginx/sites-available/${DOMAIN}"

ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

if ! certbot certificates 2>/dev/null | grep -q "${DOMAIN}"; then
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL}" --redirect
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' || ufw allow 443/tcp || true
fi

systemctl reload nginx
echo "nginx + SSL ready for https://${DOMAIN}/"
