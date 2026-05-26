const STORAGE_KEY = "contentgraph:sheets-sync-run-id";

export function getStoredSyncRunId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

export function setStoredSyncRunId(runId: number): void {
  localStorage.setItem(STORAGE_KEY, String(runId));
}

export function clearStoredSyncRunId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
