# ContentGraph Browser Worker

Local Playwright worker that automates the **existing Chrome extension** on YouTube watch pages.

## Prerequisites

- Node.js 20+
- Playwright Chromium installed
- ContentGraph extension unpacked (included in release zip or `../extension`)
- Worker token from tm1.website

## Setup

```bash
cd worker
npm install
npx playwright install chromium
cp .env.example .env
```

Register worker (once):

```bash
curl -X POST https://tm1.website/api/v1/browser-ingestion/workers/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"home-laptop"}'
```

Copy `token` into `.env` as `WORKER_TOKEN`.

Configure extension in the worker's Chromium window (loaded automatically):

1. Open `chrome://extensions` → ContentGraph → Options
2. API base: `https://tm1.website/api/v1`
3. Extension API key: same as production (`EXTENSION_API_KEY` if set)

The worker defaults to `BROWSER_CHANNEL=chromium`. On macOS, system Google Chrome can fail to inject MV3 content scripts when launched with `--load-extension`, which makes the worker report `extension incompatible` even when `extension/` is correct.

## Run

1. On tm1: open `/browser-ingestion` → **Enqueue videos**
2. On laptop:

```bash
npm start
```

## Safety limits (.env)

- `BROWSER_INGESTION_MAX_JOBS_PER_DAY` — stop claiming after N jobs (default 200)
- `BROWSER_INGESTION_MAX_CONSECUTIVE_FAILURES` — cooldown after N failures (default 5)
- `BROWSER_INGESTION_COOLDOWN_MINUTES` — pause duration (default 30)
- `BROWSER_CHANNEL` — browser channel for Playwright (default `chromium`)
- `STUCK_PAGE_MS` — watchdog stuck detection (default 180000)
- `RESTART_BROWSER_EVERY_JOBS` — periodic browser restart (default 20)

State persists in `WORKER_STATE_DIR/safety-state.json`.

## Throughput

~15–25 videos/hour (transcript + comments), depends on video length and home network.
