const STORAGE_KEY = "contentgraph:browser-ingestion-run-id";

export function getStoredBrowserIngestionRunId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

export function setStoredBrowserIngestionRunId(runId: number): void {
  localStorage.setItem(STORAGE_KEY, String(runId));
}

export function clearStoredBrowserIngestionRunId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
