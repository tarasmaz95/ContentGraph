import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export const config = {
  apiUrl: (process.env.CONTENTGRAPH_API_URL || "https://tm1.website/api/v1").replace(
    /\/$/,
    "",
  ),
  workerToken: (process.env.WORKER_TOKEN || "").trim(),
  browserChannel: (process.env.BROWSER_CHANNEL || "chromium").trim() || undefined,
  extensionPath: resolvePath(
    process.env.EXTENSION_PATH || path.join(__dirname, "../../extension"),
  ),
  chromeUserDataDir: resolvePath(
    process.env.CHROME_USER_DATA_DIR || "~/.contentgraph-worker/chromium-profile",
  ),
  stateDir: resolvePath(
    process.env.WORKER_STATE_DIR || "~/.contentgraph-worker/state",
  ),
  jobDelayMinMs: num("JOB_DELAY_MIN_MS", 3000),
  jobDelayMaxMs: num("JOB_DELAY_MAX_MS", 8000),
  heartbeatIntervalMs: num("HEARTBEAT_INTERVAL_MS", 12000),
  phaseTimeoutMs: num("PHASE_TIMEOUT_MS", 120000),
  navigationTimeoutMs: num("NAVIGATION_TIMEOUT_MS", 90000),
  stuckPageMs: num("STUCK_PAGE_MS", 180000),
  screenshotDir: resolvePath(process.env.SCREENSHOT_DIR || "./screenshots"),
  maxJobsPerDay: num("BROWSER_INGESTION_MAX_JOBS_PER_DAY", 200),
  maxConsecutiveFailures: num("BROWSER_INGESTION_MAX_CONSECUTIVE_FAILURES", 5),
  cooldownMinutes: num("BROWSER_INGESTION_COOLDOWN_MINUTES", 30),
  restartBrowserEveryJobs: num("RESTART_BROWSER_EVERY_JOBS", 20),
  requiredExtensionVersion: (
    process.env.REQUIRED_EXTENSION_VERSION || "0.2.5"
  ).trim(),
  phaseRetries: num("PHASE_RETRIES", 2),
};

function resolvePath(p: string): string {
  const expanded = p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
  return path.resolve(expanded);
}

export function validateConfig(): void {
  if (!config.workerToken) {
    throw new Error(
      "WORKER_TOKEN is required. Register at POST /browser-ingestion/workers/register",
    );
  }
  if (!fs.existsSync(path.join(config.extensionPath, "manifest.json"))) {
    throw new Error(`Extension not found at ${config.extensionPath}`);
  }
  fs.mkdirSync(config.screenshotDir, { recursive: true });
  fs.mkdirSync(config.chromeUserDataDir, { recursive: true });
  fs.mkdirSync(config.stateDir, { recursive: true });
}
