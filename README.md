# VPS deploy (ContentGraph)

## URLs

| Service   | URL |
|-----------|-----|
| Site      | http://188.40.152.222/ or http://vps88185.majorcore.host/ |
| API       | http://188.40.152.222:8001/api/v1 |
| API docs  | http://188.40.152.222:8001/docs |

## Server path

`/opt/contentgraph`

## Update after local changes

```bash
export SSHPASS='your-root-password'   # prefer SSH keys instead
export RSYNC_RSH="sshpass -e ssh -o StrictHostKeyChecking=accept-new"
rsync -avz --exclude node_modules --exclude .next --exclude .venv --exclude __pycache__ --exclude .git --exclude postgres_data --exclude .env --exclude service_account.json \
  ./ root@188.40.152.222:/opt/contentgraph/
sshpass -e scp .env root@188.40.152.222:/opt/contentgraph/
sshpass -e ssh root@188.40.152.222 'bash /opt/contentgraph/deploy/remote-up.sh'
```

## Re-sync Google Sheets data

```bash
curl -X POST http://188.40.152.222:8001/api/v1/sheets/sync
```

## Security (recommended)

1. Change root password and use SSH keys; disable password login.
2. Do not commit `.env` or `service_account.json`.
3. Add HTTPS (Caddy/Nginx) for production.
4. Keep Postgres off the public internet (prod compose uses `ports: !reset`).
