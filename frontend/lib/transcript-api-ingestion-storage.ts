const STORAGE_KEY = "contentgraph:transcript-api-ingestion-run-id";

export function getStoredIngestionRunId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

export function setStoredIngestionRunId(runId: number): void {
  localStorage.setItem(STORAGE_KEY, String(runId));
}

export function clearStoredIngestionRunId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
