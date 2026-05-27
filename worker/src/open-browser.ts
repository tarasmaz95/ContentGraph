import { closeBrowser, getPage } from "./browser-session.js";
import { config, validateConfig } from "./config.js";
import { log } from "./logger.js";

async function main(): Promise<void> {
  validateConfig();
  const channel = config.loginBrowserChannel;
  log.info("opening worker browser for manual Google / YouTube login", {
    profile: config.chromeUserDataDir,
    channel,
    note: "Google blocks sign-in in Playwright Chromium — using real Chrome",
  });

  const page = await getPage({ channel });
  await page.goto("https://www.youtube.com", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  log.info("Sign in via YouTube (top-right avatar → Sign in), not accounts.google.com if blocked");
  log.info("When done, press Ctrl+C in this terminal to close the browser");

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      log.info("closing browser");
      await closeBrowser();
      resolve();
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
  });
}

main().catch(async (err) => {
  log.error("open-browser failed", { error: err instanceof Error ? err.message : String(err) });
  await closeBrowser();
  process.exit(1);
});
