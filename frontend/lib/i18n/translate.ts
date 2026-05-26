import type { Locale, TranslationTree } from "./types";
import { en } from "./locales/en";
import { uk } from "./locales/uk";

const LOCALES: Record<Locale, TranslationTree> = { en, uk };

export function getMessages(locale: Locale): TranslationTree {
  return LOCALES[locale] ?? en;
}

function resolvePath(tree: TranslationTree, path: string): string | undefined {
  const parts = path.split(".");
  let node: string | TranslationTree | undefined = tree;
  for (const part of parts) {
    if (!node || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Lookup string by dot path; optional {{var}} interpolation */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = resolvePath(getMessages(locale), key) ?? resolvePath(getMessages("en"), key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const val = vars[name];
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}
