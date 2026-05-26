/** localStorage helpers for pins, saved searches, quick compare — no backend. */

const PINNED_KEY = "cg:pinned-creators";
const SAVED_SEARCHES_KEY = "cg:saved-searches";
const LAST_COMPARE_KEY = "cg:last-compare-partner";

export type SavedSearchKind = "semantic" | "compare";

export interface SavedSearch {
  id: string;
  kind: SavedSearchKind;
  label: string;
  /** semantic query or "creatorA|creatorB" for compare */
  value: string;
  createdAt: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getPinnedCreators(): string[] {
  if (typeof window === "undefined") return [];
  return safeParse<string[]>(localStorage.getItem(PINNED_KEY), []);
}

export function togglePinnedCreator(name: string): string[] {
  const pins = getPinnedCreators();
  const lower = name.toLowerCase();
  const next = pins.some((p) => p.toLowerCase() === lower)
    ? pins.filter((p) => p.toLowerCase() !== lower)
    : [...pins, name].slice(0, 12);
  localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  return next;
}

export function isPinnedCreator(name: string): boolean {
  const lower = name.toLowerCase();
  return getPinnedCreators().some((p) => p.toLowerCase() === lower);
}

export function getSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  return safeParse<SavedSearch[]>(localStorage.getItem(SAVED_SEARCHES_KEY), []);
}

export function addSavedSearch(
  kind: SavedSearchKind,
  label: string,
  value: string,
): SavedSearch[] {
  const items = getSavedSearches().filter(
    (s) => !(s.kind === kind && s.value === value),
  );
  const entry: SavedSearch = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label,
    value,
    createdAt: Date.now(),
  };
  const next = [entry, ...items].slice(0, 24);
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export function removeSavedSearch(id: string): SavedSearch[] {
  const next = getSavedSearches().filter((s) => s.id !== id);
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export function getLastComparePartner(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_COMPARE_KEY);
}

export function setLastComparePartner(name: string): void {
  localStorage.setItem(LAST_COMPARE_KEY, name);
}

export function compareUrl(creatorA: string, creatorB: string): string {
  return `/compare?a=${encodeURIComponent(creatorA)}&b=${encodeURIComponent(creatorB)}`;
}
