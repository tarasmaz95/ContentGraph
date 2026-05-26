import path from "node:path";
import { chromium, type BrowserContext, type Page, type ServiceWorker } from "playwright";
import { config } from "./config.js";
import { log } from "./logger.js";

let context: BrowserContext | null = null;
let jobsSinceRestart = 0;

export function getJobsSinceRestart(): number {
  return jobsSinceRestart;
}

function isExtensionServiceWorker(worker: ServiceWorker): boolean {
  return worker.url().startsWith("chrome-extension://");
}

async function waitForExtensionServiceWorker(ctx: BrowserContext): Promise<void> {
  const existing = ctx.serviceWorkers().find(isExtensionServiceWorker);
  if (existing) {
    log.info("extension loaded", { service_worker: existing.url() });
    return;
  }

  try {
    const worker = await ctx.waitForEvent("serviceworker", {
      predicate: isExtensionServiceWorker,
      timeout: 10000,
    });
    log.info("extension loaded", { service_worker: worker.url() });
  } catch {
    log.warn("extension service worker not detected yet", {
      hint: "If ContentGraph panel is missing on YouTube, use BROWSER_CHANNEL=chromium and install Playwright Chromium.",
    });
  }
}

export async function launchBrowser(): Promise<BrowserContext> {
  if (context) {
    return context;
  }
  const extPath = path.resolve(config.extensionPath);
  log.info("launching browser", {
    channel: config.browserChannel,
    profile: config.chromeUserDataDir,
    extension_path: extPath,
  });
  context = await chromium.launchPersistentContext(config.chromeUserDataDir, {
    channel: config.browserChannel,
    headless: false,
    slowMo: 30,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  await waitForExtensionServiceWorker(context);
  jobsSinceRestart = 0;
  return context;
}

async function cleanupExtraTabs(ctx: BrowserContext, keep: Page): Promise<void> {
  for (const p of ctx.pages()) {
    if (p !== keep && !p.isClosed()) {
      try {
        await p.close();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function getPage(): Promise<Page> {
  const ctx = await launchBrowser();
  const pages = ctx.pages().filter((p) => !p.isClosed());
  const page = pages.length > 0 ? pages[0]! : await ctx.newPage();
  await cleanupExtraTabs(ctx, page);
  return page;
}

export async function closePage(page: Page | null): Promise<void> {
  if (page && !page.isClosed()) {
    try {
      await page.close();
    } catch {
      /* ignore */
    }
  }
}

export async function restartBrowser(reason?: string): Promise<Page> {
  log.warn("browser restart", { reason: reason || "unspecified" });
  await closeBrowser();
  const page = await getPage();
  jobsSinceRestart = 0;
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    try {
      await context.close();
    } catch (err) {
      log.warn("browser close error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    context = null;
  }
}

export async function maybePeriodicRestart(): Promise<Page | null> {
  if (
    config.restartBrowserEveryJobs > 0 &&
    jobsSinceRestart >= config.restartBrowserEveryJobs
  ) {
    return restartBrowser("periodic_job_limit");
  }
  return null;
}

export function incrementJobsSinceRestart(): void {
  jobsSinceRestart += 1;
}

export async function recoverBrowserSession(): Promise<Page> {
  return restartBrowser("recovery");
}
