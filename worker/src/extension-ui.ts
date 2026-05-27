import type { Page } from "playwright";
import { config } from "./config.js";
import type { JobResult } from "./api-client.js";
import { log } from "./logger.js";
import type { JobWatchdog } from "./watchdog.js";

const PANEL = "#cg-transcript-panel";

export async function dismissConsent(page: Page): Promise<void> {
  const selectors = [
    'button[aria-label*="Accept"]',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Reject all")',
    'tp-yt-paper-button:has-text("Accept")',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(400);
        return;
      }
    } catch {
      /* try next */
    }
  }
}

export async function dismissSignIn(page: Page): Promise<void> {
  const selectors = [
    'button[aria-label="No thanks"]',
    'button:has-text("No thanks")',
    'tp-yt-paper-button:has-text("No thanks")',
    'button[aria-label="Dismiss"]',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(400);
      }
    } catch {
      /* ignore */
    }
  }
}

async function detectPageBlockers(page: Page): Promise<void> {
  const text = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (text.includes("sign in to confirm") || text.includes("not a bot")) {
    throw new Error("YouTube blocked: sign in to confirm you're not a bot");
  }
  if (text.includes("video unavailable") && text.includes("country")) {
    throw new Error("YouTube blocked: not available in your country");
  }
  if (text.includes("age-restricted") || text.includes("sign in to confirm your age")) {
    throw new Error("YouTube age-restricted: sign in required");
  }
  if (text.includes("comments are turned off")) {
    throw new Error("Comments disabled on this video");
  }
}

export async function ensurePanel(page: Page, watchdog?: JobWatchdog): Promise<void> {
  watchdog?.touch("wait_panel");
  await page.waitForSelector(PANEL, { timeout: 45000 });
  const hidden = await page.locator(`${PANEL}.cg-hidden`).count();
  if (hidden > 0) {
    await page.evaluate(() => {
      const p = document.getElementById("cg-transcript-panel");
      if (p) p.classList.remove("cg-hidden");
    });
  }
}

async function waitStatusOk(
  page: Page,
  kind: "transcript" | "comments",
  contains: string,
  timeoutMs: number,
  watchdog?: JobWatchdog,
): Promise<string> {
  const sel = `[data-status="${kind}"]`;
  watchdog?.touch(`wait_status_${kind}`);
  await page.waitForFunction(
    ({ selector, needle }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const text = (el.textContent || "").toLowerCase();
      const err = el.classList.contains("cg-error");
      if (err && text.includes("no transcript")) return true;
      if (err && text.includes("no comments")) return true;
      if (err && text.includes("unavailable")) return true;
      const ok = el.classList.contains("cg-ok") || el.classList.contains("cg-warn");
      return ok && text.includes(needle.toLowerCase());
    },
    { selector: sel, needle: contains },
    { timeout: timeoutMs },
  );
  const statusText = await page.locator(sel).innerText();
  const lower = statusText.toLowerCase();
  if (lower.includes("no transcript") || lower.includes("transcript unavailable")) {
    throw new Error("Transcript unavailable for this video");
  }
  if (lower.includes("no comments found") || lower.includes("comments unavailable")) {
    throw new Error("Comments unavailable for this video");
  }
  return statusText;
}

async function waitButtonEnabled(
  page: Page,
  action: string,
  timeoutMs: number,
  watchdog?: JobWatchdog,
): Promise<void> {
  watchdog?.touch(`wait_button_${action}`);
  const btn = page.locator(`${PANEL} [data-action="${action}"]`);
  await btn.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    (actionName) => {
      const b = document.querySelector(
        `#cg-transcript-panel [data-action="${actionName}"]`,
      ) as HTMLButtonElement | null;
      return b && !b.disabled;
    },
    action,
    { timeout: timeoutMs },
  );
}

function parseSheetsFromStatus(text: string): string {
  if (text.includes("Google Sheets updated")) return "ok";
  if (text.includes("Google Sheets: no matching")) return "no_rows";
  if (text.includes("Google Sheets update failed")) return "failed";
  if (text.includes("Google Sheets not updated")) return "skipped";
  return "unknown";
}

async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  retries = config.phaseRetries,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      log.warn(`${label} retry`, { attempt: i + 1, error: String(err) });
      if (i >= retries) break;
      await new Promise((r) => setTimeout(r, 1500 + i * 1000));
    }
  }
  throw last;
}

async function navigateToVideo(page: Page, videoUrl: string, watchdog?: JobWatchdog): Promise<void> {
  await withRetries("navigation", async () => {
    watchdog?.touch("navigate");
    await page.goto(videoUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await page.waitForTimeout(2000);
    await dismissConsent(page);
    await dismissSignIn(page);
    await detectPageBlockers(page);
  });
}

export async function processVideoOnPage(
  page: Page,
  videoUrl: string,
  mode: string,
  onAction: (action: string) => void,
  watchdog?: JobWatchdog,
): Promise<JobResult> {
  const logs: string[] = [];
  const result: JobResult = { logs };
  const started = Date.now();

  await navigateToVideo(page, videoUrl, watchdog);
  await ensurePanel(page, watchdog);

  if (mode === "transcript" || mode === "both") {
    onAction("extracting_transcript");
    logs.push("extract transcript");
    await withRetries("extract_transcript", async () => {
      watchdog?.touch("click_extract_transcript");
      await page.locator(`${PANEL} [data-action="extract-transcript"]`).click();
      await waitStatusOk(
        page,
        "transcript",
        "characters extracted",
        config.phaseTimeoutMs,
        watchdog,
      );
    });

    onAction("saving_transcript");
    logs.push("save transcript");
    await withRetries("save_transcript", async () => {
      await waitButtonEnabled(page, "save-transcript", 30000, watchdog);
      watchdog?.touch("click_save_transcript");
      await page.locator(`${PANEL} [data-action="save-transcript"]`).click();
      const tStatus = await waitStatusOk(
        page,
        "transcript",
        "saved to contentgraph",
        config.phaseTimeoutMs,
        watchdog,
      );
      result.transcript_status = tStatus.slice(0, 500);
      result.sheets_transcript = parseSheetsFromStatus(tStatus);
    });
  }

  if (mode === "comments" || mode === "both") {
    onAction("extracting_comments");
    logs.push("extract comments");
    await withRetries("extract_comments", async () => {
      watchdog?.touch("click_extract_comments");
      await page.locator(`${PANEL} [data-action="extract-comments"]`).click();
      await waitStatusOk(
        page,
        "comments",
        "top comments",
        config.phaseTimeoutMs,
        watchdog,
      );
    });

    onAction("saving_comments");
    logs.push("save comments");
    await withRetries("save_comments", async () => {
      await waitButtonEnabled(page, "save-comments", 30000, watchdog);
      watchdog?.touch("click_save_comments");
      await page.locator(`${PANEL} [data-action="save-comments"]`).click();
      const cStatus = await waitStatusOk(
        page,
        "comments",
        "saved",
        config.phaseTimeoutMs,
        watchdog,
      );
      result.comments_status = cStatus.slice(0, 500);
      result.sheets_comments = parseSheetsFromStatus(cStatus);
    });
  }

  result.duration_ms = Date.now() - started;
  return result;
}

export async function captureFailureScreenshot(
  page: Page,
  jobId: number,
): Promise<string | undefined> {
  try {
    if (page.isClosed()) return undefined;
    const fs = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const file = pathMod.join(config.screenshotDir, `job-${jobId}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return undefined;
  }
}
