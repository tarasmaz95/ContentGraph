import type { Page } from "playwright";
import { config } from "./config.js";
import type { JobResult } from "./api-client.js";
import { log } from "./logger.js";
import type { JobWatchdog } from "./watchdog.js";

const PANEL = "#cg-transcript-panel";

export type TranscriptOutcome = "ok" | "unavailable" | "failed" | "skipped";
export type CommentsOutcome = "ok" | "disabled" | "empty" | "failed" | "skipped";

export interface TranscriptPhaseResult {
  outcome: Exclude<TranscriptOutcome, "failed" | "skipped">;
  status_text?: string;
  sheets_status?: string;
}

export interface CommentsPhaseResult {
  outcome: Exclude<CommentsOutcome, "failed" | "skipped">;
  status_text?: string;
  sheets_status?: string;
}

/**
 * Page-level signals that do not warrant a hard throw — comments-fade only.
 * Stored on the page object during navigation and consumed by the comments phase.
 */
interface SoftPageSignals {
  commentsDisabled: boolean;
}

const SOFT_SIGNALS = new WeakMap<Page, SoftPageSignals>();

function getSoftSignals(page: Page): SoftPageSignals {
  let s = SOFT_SIGNALS.get(page);
  if (!s) {
    s = { commentsDisabled: false };
    SOFT_SIGNALS.set(page, s);
  }
  return s;
}

function resetSoftSignals(page: Page): SoftPageSignals {
  const s = getSoftSignals(page);
  s.commentsDisabled = false;
  return s;
}

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
  // Comments turned off is a soft signal — picked up by the comments phase, never a hard fail.
  if (text.includes("comments are turned off")) {
    getSoftSignals(page).commentsDisabled = true;
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

/** Status outcome from the extension panel; never throws for soft empty/disabled signals. */
export type PhaseStatusOutcome =
  | { kind: "ok"; text: string }
  | { kind: "transcript_unavailable"; text: string }
  | { kind: "comments_disabled"; text: string }
  | { kind: "comments_empty"; text: string };

async function waitStatusOk(
  page: Page,
  kind: "transcript" | "comments",
  contains: string,
  timeoutMs: number,
  watchdog?: JobWatchdog,
): Promise<PhaseStatusOutcome> {
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
      if (err && text.includes("disabled")) return true;
      if (err && text.includes("turned off")) return true;
      const ok = el.classList.contains("cg-ok") || el.classList.contains("cg-warn");
      return ok && text.includes(needle.toLowerCase());
    },
    { selector: sel, needle: contains },
    { timeout: timeoutMs },
  );
  const statusText = await page.locator(sel).innerText();
  const lower = statusText.toLowerCase();
  if (kind === "transcript") {
    if (lower.includes("no transcript") || lower.includes("transcript unavailable")) {
      return { kind: "transcript_unavailable", text: statusText };
    }
    return { kind: "ok", text: statusText };
  }
  if (
    lower.includes("comments are turned off") ||
    lower.includes("comments disabled") ||
    lower.includes("comments unavailable")
  ) {
    return { kind: "comments_disabled", text: statusText };
  }
  if (lower.includes("no comments")) {
    return { kind: "comments_empty", text: statusText };
  }
  return { kind: "ok", text: statusText };
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
  resetSoftSignals(page);
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

async function runTranscriptPhase(
  page: Page,
  onAction: (action: string) => void,
  watchdog?: JobWatchdog,
): Promise<TranscriptPhaseResult> {
  onAction("extracting_transcript");
  let extractStatus: PhaseStatusOutcome | null = null;
  await withRetries("extract_transcript", async () => {
    watchdog?.touch("click_extract_transcript");
    await page.locator(`${PANEL} [data-action="extract-transcript"]`).click();
    extractStatus = await waitStatusOk(
      page,
      "transcript",
      "characters extracted",
      config.phaseTimeoutMs,
      watchdog,
    );
  });
  if (extractStatus && extractStatus.kind === "transcript_unavailable") {
    return { outcome: "unavailable", status_text: extractStatus.text };
  }

  onAction("saving_transcript");
  let saveText = "";
  let sheets: string | undefined;
  await withRetries("save_transcript", async () => {
    await waitButtonEnabled(page, "save-transcript", 30000, watchdog);
    watchdog?.touch("click_save_transcript");
    await page.locator(`${PANEL} [data-action="save-transcript"]`).click();
    const status = await waitStatusOk(
      page,
      "transcript",
      "saved to contentgraph",
      config.phaseTimeoutMs,
      watchdog,
    );
    if (status.kind === "transcript_unavailable") {
      // Should not happen on save, but stay safe — bubble up as unavailable.
      saveText = status.text;
      sheets = undefined;
      return;
    }
    saveText = status.text;
    sheets = parseSheetsFromStatus(status.text);
  });

  if (!saveText) {
    return { outcome: "unavailable" };
  }
  return {
    outcome: "ok",
    status_text: saveText.slice(0, 500),
    sheets_status: sheets,
  };
}

async function runCommentsPhase(
  page: Page,
  onAction: (action: string) => void,
  watchdog?: JobWatchdog,
): Promise<CommentsPhaseResult> {
  if (getSoftSignals(page).commentsDisabled) {
    return { outcome: "disabled", status_text: "comments turned off on page" };
  }

  onAction("extracting_comments");
  let extractStatus: PhaseStatusOutcome | null = null;
  await withRetries("extract_comments", async () => {
    watchdog?.touch("click_extract_comments");
    await page.locator(`${PANEL} [data-action="extract-comments"]`).click();
    extractStatus = await waitStatusOk(
      page,
      "comments",
      "top comments",
      config.phaseTimeoutMs,
      watchdog,
    );
  });
  if (extractStatus) {
    if (extractStatus.kind === "comments_disabled") {
      return { outcome: "disabled", status_text: extractStatus.text };
    }
    if (extractStatus.kind === "comments_empty") {
      return { outcome: "empty", status_text: extractStatus.text };
    }
  }

  onAction("saving_comments");
  let saveText = "";
  let sheets: string | undefined;
  await withRetries("save_comments", async () => {
    await waitButtonEnabled(page, "save-comments", 30000, watchdog);
    watchdog?.touch("click_save_comments");
    await page.locator(`${PANEL} [data-action="save-comments"]`).click();
    const status = await waitStatusOk(
      page,
      "comments",
      "saved",
      config.phaseTimeoutMs,
      watchdog,
    );
    if (status.kind === "comments_disabled") {
      saveText = status.text;
      return;
    }
    if (status.kind === "comments_empty") {
      saveText = status.text;
      return;
    }
    saveText = status.text;
    sheets = parseSheetsFromStatus(status.text);
  });

  const lower = saveText.toLowerCase();
  if (
    lower.includes("comments are turned off") ||
    lower.includes("comments disabled") ||
    lower.includes("comments unavailable")
  ) {
    return { outcome: "disabled", status_text: saveText.slice(0, 500) };
  }
  if (lower.includes("no comments")) {
    return { outcome: "empty", status_text: saveText.slice(0, 500) };
  }
  return {
    outcome: "ok",
    status_text: saveText.slice(0, 500),
    sheets_status: sheets,
  };
}

export interface ProcessVideoResult {
  overallSuccess: boolean;
  result: JobResult;
  transcriptError?: Error;
  commentsError?: Error;
}

export async function processVideoOnPage(
  page: Page,
  videoUrl: string,
  mode: string,
  onAction: (action: string) => void,
  watchdog?: JobWatchdog,
): Promise<ProcessVideoResult> {
  const logs: string[] = [];
  const result: JobResult = { logs };
  const started = Date.now();

  await navigateToVideo(page, videoUrl, watchdog);
  await ensurePanel(page, watchdog);

  let transcriptError: Error | undefined;
  let commentsError: Error | undefined;

  if (mode === "transcript" || mode === "both") {
    logs.push("phase:transcript");
    try {
      const t = await runTranscriptPhase(page, onAction, watchdog);
      result.transcript_outcome = t.outcome;
      if (t.status_text) result.transcript_status = t.status_text;
      if (t.sheets_status) result.sheets_transcript = t.sheets_status;
    } catch (err) {
      transcriptError = err instanceof Error ? err : new Error(String(err));
      result.transcript_outcome = "failed";
      result.transcript_status = transcriptError.message.slice(0, 500);
      log.warn("transcript phase failed", { error: transcriptError.message });
    }
  } else {
    result.transcript_outcome = "skipped";
  }

  if (mode === "comments" || mode === "both") {
    logs.push("phase:comments");
    try {
      const c = await runCommentsPhase(page, onAction, watchdog);
      result.comments_outcome = c.outcome;
      if (c.status_text) result.comments_status = c.status_text;
      if (c.sheets_status) result.sheets_comments = c.sheets_status;
    } catch (err) {
      commentsError = err instanceof Error ? err : new Error(String(err));
      result.comments_outcome = "failed";
      result.comments_status = commentsError.message.slice(0, 500);
      log.warn("comments phase failed", { error: commentsError.message });
    }
  } else {
    result.comments_outcome = "skipped";
  }

  result.duration_ms = Date.now() - started;

  // Job-level success:
  //   - transcript mode: transcript must be ok (unavailable = nothing useful)
  //   - comments  mode: comments must be ok (disabled/empty = nothing useful)
  //   - both:     comments are best-effort; any non-failed transcript outcome is fine.
  //               That way comments-only problems never mark the job (or the worker) as broken.
  let overallSuccess: boolean;
  if (mode === "transcript") {
    overallSuccess = result.transcript_outcome === "ok";
  } else if (mode === "comments") {
    overallSuccess = result.comments_outcome === "ok";
  } else {
    overallSuccess =
      result.transcript_outcome === "ok" || result.transcript_outcome === "unavailable";
  }

  return {
    overallSuccess,
    result,
    transcriptError,
    commentsError,
  };
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
