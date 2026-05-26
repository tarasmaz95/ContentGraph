import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { config } from "./config.js";
import { log } from "./logger.js";

const PANEL = "#cg-transcript-panel";
const REQUIRED_ACTIONS = [
  "extract-transcript",
  "save-transcript",
  "extract-comments",
  "save-comments",
] as const;
const COMPAT_CHECK_TIMEOUT_MS = 20000;
const COMPAT_CHECK_POLL_MS = 1000;

export interface ExtensionCompatResult {
  ok: boolean;
  extensionVersion: string;
  requiredVersion: string;
  missingSelectors: string[];
  reason?: string;
}

export function readExtensionVersion(): string {
  const manifestPath = path.join(config.extensionPath, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    version?: string;
  };
  return manifest.version || "0.0.0";
}

function semverGte(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return true;
}

async function dismissYouTubeOverlays(page: Page): Promise<void> {
  const selectors = [
    'button[aria-label*="Accept"]',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Reject all")',
    'tp-yt-paper-button:has-text("Accept")',
    'button[aria-label="No thanks"]',
    'button:has-text("No thanks")',
    'tp-yt-paper-button:has-text("No thanks")',
  ];

  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ timeout: 1500 });
        await page.waitForTimeout(300);
      }
    } catch {
      /* try next */
    }
  }
}

async function waitForRequiredSelectors(page: Page): Promise<string[]> {
  const deadline = Date.now() + COMPAT_CHECK_TIMEOUT_MS;
  let missingSelectors: string[] = [];

  while (Date.now() < deadline) {
    await dismissYouTubeOverlays(page);
    missingSelectors = [];

    if ((await page.locator(PANEL).count()) === 0) {
      missingSelectors.push(PANEL);
    }
    for (const action of REQUIRED_ACTIONS) {
      const sel = `${PANEL} [data-action="${action}"]`;
      if ((await page.locator(sel).count()) === 0) {
        missingSelectors.push(sel);
      }
    }

    if (missingSelectors.length === 0) return [];
    await page.waitForTimeout(COMPAT_CHECK_POLL_MS);
  }

  return missingSelectors;
}

export async function verifyExtensionOnPage(page: Page): Promise<ExtensionCompatResult> {
  const extensionVersion = readExtensionVersion();
  const requiredVersion = config.requiredExtensionVersion;

  if (!semverGte(extensionVersion, requiredVersion)) {
    return {
      ok: false,
      extensionVersion,
      requiredVersion,
      missingSelectors: [],
      reason: `Extension ${extensionVersion} < required ${requiredVersion}`,
    };
  }

  await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const missingSelectors = await waitForRequiredSelectors(page);

  if (missingSelectors.length > 0) {
    log.warn("extension compatibility check failed", {
      missing: missingSelectors,
      extension_version: extensionVersion,
      browser_channel: config.browserChannel,
    });
    return {
      ok: false,
      extensionVersion,
      requiredVersion,
      missingSelectors,
      reason:
        "Missing extension DOM hooks on YouTube. If this is macOS/system Chrome, set BROWSER_CHANNEL=chromium and run npx playwright install chromium.",
    };
  }

  return { ok: true, extensionVersion, requiredVersion, missingSelectors: [] };
}

export async function checkExtensionCompatibility(
  page: Page,
): Promise<ExtensionCompatResult> {
  try {
    return await verifyExtensionOnPage(page);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      extensionVersion: readExtensionVersion(),
      requiredVersion: config.requiredExtensionVersion,
      missingSelectors: [],
      reason: message,
    };
  }
}
