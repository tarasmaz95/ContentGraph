/** Browser worker bundle download (worker + extension in one zip). */

export const WORKER_ZIP_PATH = "/downloads/contentgraph-browser-worker.zip";
export const WORKER_META_PATH = "/downloads/worker-meta.json";

export interface WorkerBundleMeta {
  /** Bundle release version (aligned with extension). */
  version: string;
  extensionVersion: string;
  workerVersion: string;
  name: string;
  updatedAt: string;
  sizeBytes: number;
  filename: string;
}

export { formatBytes, formatMetaDate } from "@/lib/extension-download";

export async function fetchWorkerBundleMeta(): Promise<WorkerBundleMeta | null> {
  try {
    const res = await fetch(WORKER_META_PATH, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as WorkerBundleMeta;
  } catch {
    return null;
  }
}
