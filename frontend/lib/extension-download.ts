/** Extension download paths (served from Next.js public/) */

export const EXTENSION_ZIP_PATH = "/downloads/contentgraph-extension.zip";
export const EXTENSION_META_PATH = "/downloads/extension-meta.json";

export interface ExtensionMeta {
  version: string;
  name: string;
  updatedAt: string;
  sizeBytes: number;
  filename: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMetaDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
