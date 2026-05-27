import fs from "node:fs";
import type { Cookie } from "playwright";
import { log } from "./logger.js";

type RawCookie = Record<string, unknown>;

function mapSameSite(raw: unknown): Cookie["sameSite"] {
  const s = String(raw ?? "").toLowerCase();
  if (s === "strict") return "Strict";
  if (s === "lax") return "Lax";
  if (s === "none" || s === "no_restriction" || s === "unspecified") return "None";
  return "Lax";
}

function normalizeCookie(raw: RawCookie): Cookie | null {
  const name = String(raw.name ?? "").trim();
  const value = String(raw.value ?? "").trim();
  const domain = String(raw.domain ?? "").trim();
  if (!name || !domain) return null;

  const path = String(raw.path ?? "/") || "/";
  const expires =
    typeof raw.expires === "number"
      ? raw.expires
      : typeof raw.expirationDate === "number"
        ? raw.expirationDate
        : undefined;

  return {
    name,
    value,
    domain,
    path,
    expires: expires && expires > 0 ? expires : undefined,
    httpOnly: Boolean(raw.httpOnly),
    secure: Boolean(raw.secure),
    sameSite: mapSameSite(raw.sameSite),
  };
}

/** Load cookies exported from Chrome (Cookie-Editor JSON) into Playwright format. */
export function loadCookiesFromFile(filePath: string): Cookie[] {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  const list = Array.isArray(parsed) ? parsed : [];
  const cookies: Cookie[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = normalizeCookie(item as RawCookie);
    if (c) cookies.push(c);
  }
  return cookies;
}

export async function applyCookiesFile(
  addCookies: (cookies: Cookie[]) => Promise<void>,
  filePath: string,
): Promise<number> {
  const cookies = loadCookiesFromFile(filePath);
  if (!cookies.length) return 0;
  const relevant = cookies.filter(
    (c) =>
      c.domain.includes("google.com") ||
      c.domain.includes("youtube.com") ||
      c.domain.includes("google.com.ua"),
  );
  if (!relevant.length) {
    log.warn("cookies file has no google/youtube domains", { file: filePath });
    return 0;
  }
  await addCookies(relevant);
  log.info("imported cookies from file", { file: filePath, count: relevant.length });
  return relevant.length;
}
