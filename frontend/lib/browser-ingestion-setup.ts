/** Setup constants for browser ingestion operator UX. */

export const WORKER_ZIP_URL = "/downloads/contentgraph-browser-worker.zip";
export const EXTENSION_PAGE_URL = "/extension";
export const CHROME_EXTENSIONS_URL = "chrome://extensions";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_API_URL;
    if (fromEnv) return fromEnv.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "https://tm1.website/api/v1"
  );
}

export const SETUP_COMMANDS_UNIX = `cd worker
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env — paste your Worker Token
npm start`;

export const SETUP_COMMANDS_WINDOWS = `cd worker
npm install
npx playwright install chromium
copy .env.example .env
REM Edit .env — paste your Worker Token
npm start`;

export const NPM_INSTALL_ONE_LINER = "cd worker && npm install && npx playwright install chromium";
export const NPM_START_ONE_LINER = "cd worker && npm start";
