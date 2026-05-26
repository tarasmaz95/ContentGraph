/**
 * Thin API client for ContentGraph Lite backend.
 * All paths are relative to NEXT_PUBLIC_API_URL.
 */

import type { DashboardAnalytics } from "@/types/analytics";
import type {
  CreatorGrowthResponse,
  VelocityResponse,
  VideoBreakoutsResponse,
} from "@/types/growth";
import type {
  SnapshotRunHistoryResponse,
  SnapshotRunResult,
  SnapshotStatus,
} from "@/types/snapshot";
import type {
  CreatorComparisonRequest,
  CreatorComparisonResult,
  CreatorListItem,
  CreatorProfile,
} from "@/types/creator";
import type { CreatorCompareResult } from "@/types/creator-compare";
import type { CreatorIntelligence } from "@/types/creator-intelligence";
import type { CreatorPageAnalytics } from "@/types/creator-page";
import type {
  HookCompareRequest,
  HookCompareResult,
  HookGenerateRequest,
  HookGenerateResult,
  HookSearchResult,
  HookWorkspace,
} from "@/types/hooks";
import type { VideoIntelligence } from "@/types/video-intelligence";
import type {
  ScriptAnalyzeRequest,
  ScriptAnalyzeResult,
  ScriptCompareRequest,
  ScriptCompareResult,
  ScriptGenerateRequest,
  ScriptGenerateResult,
  ScriptWorkspace,
} from "@/types/scripts";
import type { ChatRequest, ChatResponse } from "@/types/chat";
import type {
  AIBrief,
  CopilotPanelResponse,
  IntelligenceFeedResponse,
  ResearchAssistantHints,
} from "@/types/copilot";
import { getPersonalizationPayload } from "@/lib/personalization";
import type {
  ResearchCollection,
  ResearchItem,
  ResearchItemCreate,
  ResearchItemUpdate,
  ResearchNote,
  ResearchNoteCreate,
  ResearchSearchResult,
  ResearchSummary,
  ResearchWorkspace,
  SavedInsight,
  SavedInsightCreate,
} from "@/types/research";
import type { DataSourceSettings, DataSourceSettingsUpdate } from "@/types/settings";
import type { IntelligenceHealthResponse } from "@/types/intelligence-health";
import type {
  LastSyncStatus,
  SyncRun,
  SyncRunMode,
  SyncRunStartResponse,
} from "@/types/sync-run";
import type { CatalogStats, SyncResult, Video, VideoListResponse } from "@/types/video";
import type {
  BrowserIngestionDashboard,
  BrowserIngestionJobsPage,
  BrowserIngestionRun,
  BrowserIngestionStartRequest,
  BrowserIngestionStartResponse,
  BrowserJobStatusFilter,
} from "@/types/browser-ingestion";
import type {
  JobStatusFilter,
  TranscriptApiIngestionDashboardStats,
  TranscriptApiIngestionJobsPage,
  TranscriptApiIngestionRun,
  TranscriptApiIngestionStartRequest,
  TranscriptApiIngestionStartResponse,
} from "@/types/transcript-api-ingestion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchDataSourceSettings(): Promise<DataSourceSettings> {
  return request<DataSourceSettings>("/settings/data-source");
}

export async function updateDataSourceSettings(
  body: DataSourceSettingsUpdate,
): Promise<DataSourceSettings> {
  return request<DataSourceSettings>("/settings/data-source", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** @deprecated Use startSheetsSync + poll SyncRun */
export async function syncSheets(): Promise<SyncResult> {
  return request<SyncResult>("/sheets/sync", { method: "POST" });
}

export async function startSheetsSync(
  mode: SyncRunMode = "quick",
): Promise<SyncRunStartResponse> {
  return request<SyncRunStartResponse>("/sheets/sync", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export async function fetchLastSyncStatus(): Promise<LastSyncStatus | null> {
  const response = await fetch(`${API_BASE}/sheets/sync/runs/last`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  const text = await response.text();
  if (!text || text === "null") return null;
  return JSON.parse(text) as LastSyncStatus;
}

export async function fetchSyncRun(runId: number): Promise<SyncRun> {
  return request<SyncRun>(`/sheets/sync/runs/${runId}`);
}

export async function fetchActiveSyncRun(): Promise<SyncRun | null> {
  const response = await fetch(`${API_BASE}/sheets/sync/runs/active`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as SyncRun;
}

export async function parseSheetsUrl(url: string): Promise<import("@/types/sheets").ParseSheetsUrlResponse> {
  return request("/sheets/parse-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function fetchSheetTabs(spreadsheetId: string): Promise<string[]> {
  return request<string[]>(`/sheets/${encodeURIComponent(spreadsheetId)}/tabs`);
}

export async function fetchSheetPreview(
  spreadsheetId: string,
  sheetName: string,
): Promise<import("@/types/sheets").SheetPreviewResponse> {
  const params = new URLSearchParams({ sheet_name: sheetName });
  return request(
    `/sheets/${encodeURIComponent(spreadsheetId)}/preview?${params.toString()}`,
  );
}

export async function fetchVideos(limit = 100): Promise<VideoListResponse> {
  return request<VideoListResponse>(`/videos?limit=${limit}`);
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  return request<CatalogStats>("/videos/catalog-stats");
}

export async function fetchVideoById(id: number): Promise<Video> {
  return request<Video>(`/videos/${id}`);
}

export async function fetchVideoIntelligence(
  id: number,
  refresh = false,
): Promise<VideoIntelligence> {
  const q = refresh ? "?refresh=true" : "";
  return request<VideoIntelligence>(`/videos/${id}/intelligence${q}`);
}

export async function searchVideos(q: string): Promise<Video[]> {
  const encoded = encodeURIComponent(q);
  return request<Video[]>(`/videos/search?q=${encoded}`);
}

/** pgvector semantic search — natural language queries */
export async function semanticSearchVideos(q: string, limit = 30): Promise<Video[]> {
  const encoded = encodeURIComponent(q);
  return request<Video[]>(`/videos/semantic-search?q=${encoded}&limit=${limit}`);
}

export async function fetchCreators(): Promise<CreatorListItem[]> {
  return request<CreatorListItem[]>("/creators");
}

export async function fetchCreator(
  name: string,
  refresh = false,
): Promise<CreatorProfile> {
  const encoded = encodeURIComponent(name);
  const q = refresh ? "?refresh=true" : "";
  return request<CreatorProfile>(`/creators/${encoded}${q}`);
}

export async function fetchCreatorAnalytics(
  nameOrSlug: string,
): Promise<CreatorPageAnalytics> {
  const encoded = encodeURIComponent(nameOrSlug);
  return request<CreatorPageAnalytics>(`/creators/${encoded}/analytics`);
}

export async function fetchCreatorIntelligence(
  nameOrSlug: string,
): Promise<CreatorIntelligence> {
  const encoded = encodeURIComponent(nameOrSlug);
  return request<CreatorIntelligence>(`/creators/${encoded}/intelligence`);
}

export async function fetchCreatorCompare(
  creatorA: string,
  creatorB: string,
  depth: "full" | "core" | "extended" = "full",
): Promise<CreatorCompareResult> {
  const a = encodeURIComponent(creatorA);
  const b = encodeURIComponent(creatorB);
  return request<CreatorCompareResult>(
    `/compare?creator_a=${a}&creator_b=${b}&depth=${depth}`,
  );
}

export async function creatorSemanticSearch(
  nameOrSlug: string,
  q: string,
  limit = 20,
): Promise<Video[]> {
  const encoded = encodeURIComponent(nameOrSlug);
  const query = encodeURIComponent(q);
  return request<Video[]>(
    `/creators/${encoded}/semantic-search?q=${query}&limit=${limit}`,
  );
}

export async function fetchHookWorkspace(): Promise<HookWorkspace> {
  return request<HookWorkspace>("/hooks/workspace");
}

export async function searchHooks(q: string, limit = 25): Promise<HookSearchResult[]> {
  return request<HookSearchResult[]>(
    `/hooks/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export async function generateHooks(body: HookGenerateRequest): Promise<HookGenerateResult> {
  return request<HookGenerateResult>("/hooks/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function compareHooks(body: HookCompareRequest): Promise<HookCompareResult> {
  return request<HookCompareResult>("/hooks/compare", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reindexHooks(): Promise<{ hooks_indexed: number }> {
  return request<{ hooks_indexed: number }>("/hooks/reindex", { method: "POST" });
}

export async function fetchScriptWorkspace(
  creator?: string,
): Promise<ScriptWorkspace> {
  const q = creator ? `?creator=${encodeURIComponent(creator)}` : "";
  return request<ScriptWorkspace>(`/scripts/workspace${q}`);
}

export async function generateScript(
  body: ScriptGenerateRequest,
): Promise<ScriptGenerateResult> {
  return request<ScriptGenerateResult>("/scripts/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function analyzeScript(
  body: ScriptAnalyzeRequest,
): Promise<ScriptAnalyzeResult> {
  return request<ScriptAnalyzeResult>("/scripts/analyze", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function compareScript(
  body: ScriptCompareRequest,
): Promise<ScriptCompareResult> {
  return request<ScriptCompareResult>("/scripts/compare", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function compareCreators(
  creators: string[],
): Promise<CreatorComparisonResult> {
  const body: CreatorComparisonRequest = { creators };
  return request<CreatorComparisonResult>("/creators/compare", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Videos used for dashboard “At a glance” metrics (top by views). */
/** Sample size for heavy charts on /analytics (summary metrics are always full catalog). */
export const ANALYTICS_CHARTS_SAMPLE_SIZE = 200;

export async function fetchDashboardAnalytics(
  chartsLimit?: number,
): Promise<DashboardAnalytics> {
  const params =
    chartsLimit !== undefined ? `?charts_limit=${chartsLimit}` : "";
  return request<DashboardAnalytics>(`/analytics/dashboard${params}`);
}

export async function fetchCreatorGrowth(limit = 10): Promise<CreatorGrowthResponse> {
  return request<CreatorGrowthResponse>(`/analytics/creators/growth?limit=${limit}`);
}

export async function fetchVideoBreakouts(limit = 10): Promise<VideoBreakoutsResponse> {
  return request<VideoBreakoutsResponse>(`/analytics/videos/breakouts?limit=${limit}`);
}

export async function fetchVelocitySpikes(limit = 10): Promise<VelocityResponse> {
  return request<VelocityResponse>(`/analytics/velocity?limit=${limit}`);
}

export async function fetchSnapshotStatus(): Promise<SnapshotStatus> {
  return request<SnapshotStatus>("/analytics/snapshots/status");
}

export async function fetchSnapshotHistory(
  limit = 5,
): Promise<SnapshotRunHistoryResponse> {
  return request<SnapshotRunHistoryResponse>(`/analytics/snapshots/history?limit=${limit}`);
}

export async function runSnapshotsNow(): Promise<SnapshotRunResult> {
  return request<SnapshotRunResult>("/analytics/snapshots/run", { method: "POST" });
}

export async function fetchIntelligenceHealth(): Promise<IntelligenceHealthResponse> {
  return request<IntelligenceHealthResponse>("/intelligence/health");
}

export async function fetchResearchWorkspace(): Promise<ResearchWorkspace> {
  return request<ResearchWorkspace>("/research/workspace");
}

export async function fetchResearchSummary(): Promise<ResearchSummary> {
  return request<ResearchSummary>("/research/summary");
}

export async function searchResearch(q: string): Promise<ResearchSearchResult[]> {
  return request<ResearchSearchResult[]>(`/research/search?q=${encodeURIComponent(q)}`);
}

export async function exportResearchMarkdown(): Promise<{ markdown: string }> {
  return request<{ markdown: string }>("/research/export/markdown");
}

export async function saveInsight(data: SavedInsightCreate): Promise<SavedInsight> {
  return request<SavedInsight>("/research/insights", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteInsight(id: number): Promise<void> {
  await request(`/research/insights/${id}`, { method: "DELETE" });
}

export async function createResearchNote(data: ResearchNoteCreate): Promise<ResearchNote> {
  return request<ResearchNote>("/research/notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteResearchNote(id: number): Promise<void> {
  await request(`/research/notes/${id}`, { method: "DELETE" });
}

export async function fetchResearchCollections(): Promise<ResearchCollection[]> {
  return request<ResearchCollection[]>("/research/collections");
}

export async function createResearchCollection(name: string): Promise<ResearchCollection> {
  return request<ResearchCollection>("/research/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteResearchCollection(id: number): Promise<void> {
  await request(`/research/collections/${id}`, { method: "DELETE" });
}

export async function fetchResearchItems(params?: {
  collection_id?: number;
  type?: string;
}): Promise<ResearchItem[]> {
  const q = new URLSearchParams();
  if (params?.collection_id != null) q.set("collection_id", String(params.collection_id));
  if (params?.type) q.set("type", params.type);
  const suffix = q.toString() ? `?${q}` : "";
  return request<ResearchItem[]>(`/research/items${suffix}`);
}

export async function fetchResearchItem(id: number): Promise<ResearchItem> {
  return request<ResearchItem>(`/research/items/${id}`);
}

export async function createResearchItem(data: ResearchItemCreate): Promise<ResearchItem> {
  return request<ResearchItem>("/research/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateResearchItem(
  id: number,
  data: ResearchItemUpdate,
): Promise<ResearchItem> {
  return request<ResearchItem>(`/research/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteResearchItem(id: number): Promise<void> {
  await request(`/research/items/${id}`, { method: "DELETE" });
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const body: ChatRequest = { message };
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** AI Copilot sidebar — insights + recommendations with personalization */
export async function fetchCopilotPanel(params: {
  context: string;
  creatorName?: string;
  videoId?: number;
}): Promise<CopilotPanelResponse> {
  const q = new URLSearchParams({ context: params.context });
  if (params.creatorName) q.set("creator_name", params.creatorName);
  if (params.videoId != null) q.set("video_id", String(params.videoId));
  return request<CopilotPanelResponse>(`/copilot/panel?${q}`, {
    method: "POST",
    body: JSON.stringify(getPersonalizationPayload()),
  });
}

export async function fetchIntelligenceFeed(limit = 8): Promise<IntelligenceFeedResponse> {
  return request<IntelligenceFeedResponse>(`/copilot/feed?limit=${limit}`);
}

export async function fetchTrendBrief(): Promise<AIBrief> {
  return request<AIBrief>("/copilot/brief/trend");
}

export async function fetchCreatorBrief(name: string): Promise<AIBrief> {
  return request<AIBrief>(`/copilot/brief/creator/${encodeURIComponent(name)}`);
}

export async function fetchVideoBrief(videoId: number): Promise<AIBrief> {
  return request<AIBrief>(`/copilot/brief/video/${videoId}`);
}

export async function fetchAudienceBrief(videoId: number): Promise<AIBrief> {
  return request<AIBrief>(`/copilot/brief/audience/${videoId}`);
}

export async function fetchResearchAssistant(
  tags?: string[],
  creator?: string,
): Promise<ResearchAssistantHints> {
  const q = new URLSearchParams();
  if (tags?.length) q.set("tags", tags.join(","));
  if (creator) q.set("creator", creator);
  const suffix = q.toString() ? `?${q}` : "";
  return request<ResearchAssistantHints>(`/copilot/research-assistant${suffix}`);
}

export async function fetchTranscriptApiIngestionStats(): Promise<TranscriptApiIngestionDashboardStats> {
  return request<TranscriptApiIngestionDashboardStats>("/transcripts/api-ingestion/stats");
}

export async function fetchTranscriptApiIngestionJobs(
  runId: number,
  params?: { status?: JobStatusFilter; offset?: number; limit?: number },
): Promise<TranscriptApiIngestionJobsPage> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q}` : "";
  return request<TranscriptApiIngestionJobsPage>(
    `/transcripts/api-ingestion/runs/${runId}/jobs${suffix}`,
  );
}

export async function fetchActiveTranscriptApiIngestionRun(): Promise<TranscriptApiIngestionRun | null> {
  const response = await fetch(`${API_BASE}/transcripts/api-ingestion/runs/active`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error((await response.text()) || `Request failed: ${response.status}`);
  }
  const text = await response.text();
  if (!text || text === "null") return null;
  return JSON.parse(text) as TranscriptApiIngestionRun;
}

export async function fetchTranscriptApiIngestionRun(
  runId: number,
): Promise<TranscriptApiIngestionRun> {
  return request<TranscriptApiIngestionRun>(`/transcripts/api-ingestion/runs/${runId}`);
}

export async function startTranscriptApiIngestion(
  body: TranscriptApiIngestionStartRequest,
): Promise<TranscriptApiIngestionStartResponse> {
  return request<TranscriptApiIngestionStartResponse>("/transcripts/api-ingestion/runs/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pauseTranscriptApiIngestion(
  runId: number,
): Promise<TranscriptApiIngestionRun> {
  return request<TranscriptApiIngestionRun>(
    `/transcripts/api-ingestion/runs/${runId}/pause`,
    { method: "POST" },
  );
}

export async function resumeTranscriptApiIngestion(
  runId: number,
): Promise<TranscriptApiIngestionRun> {
  return request<TranscriptApiIngestionRun>(
    `/transcripts/api-ingestion/runs/${runId}/resume`,
    { method: "POST" },
  );
}

export async function retryFailedTranscriptApiIngestion(
  runId: number,
): Promise<TranscriptApiIngestionRun> {
  return request<TranscriptApiIngestionRun>(
    `/transcripts/api-ingestion/runs/${runId}/retry-failed`,
    { method: "POST" },
  );
}

export async function registerBrowserWorker(
  name: string,
): Promise<{ worker_id: number; token: string; message: string }> {
  return request<{ worker_id: number; token: string; message: string }>(
    "/browser-ingestion/workers/register",
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
}

export async function fetchBrowserIngestionDashboard(
  runId?: number,
): Promise<BrowserIngestionDashboard> {
  const q = runId != null ? `?run_id=${runId}` : "";
  return request<BrowserIngestionDashboard>(`/browser-ingestion/dashboard${q}`);
}

export async function fetchBrowserIngestionRun(runId: number): Promise<BrowserIngestionRun> {
  return request<BrowserIngestionRun>(`/browser-ingestion/runs/${runId}`);
}

export async function fetchBrowserIngestionJobs(
  runId: number,
  params?: { status?: BrowserJobStatusFilter; offset?: number; limit?: number },
): Promise<BrowserIngestionJobsPage> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q}` : "";
  return request<BrowserIngestionJobsPage>(
    `/browser-ingestion/runs/${runId}/jobs${suffix}`,
  );
}

export async function startBrowserIngestion(
  body: BrowserIngestionStartRequest,
): Promise<BrowserIngestionStartResponse> {
  return request<BrowserIngestionStartResponse>("/browser-ingestion/runs/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pauseBrowserIngestion(runId: number): Promise<BrowserIngestionRun> {
  return request<BrowserIngestionRun>(`/browser-ingestion/runs/${runId}/pause`, {
    method: "POST",
  });
}

export async function resumeBrowserIngestion(runId: number): Promise<BrowserIngestionRun> {
  return request<BrowserIngestionRun>(`/browser-ingestion/runs/${runId}/resume`, {
    method: "POST",
  });
}

export async function retryFailedBrowserIngestion(
  runId: number,
): Promise<BrowserIngestionRun> {
  return request<BrowserIngestionRun>(
    `/browser-ingestion/runs/${runId}/retry-failed`,
    { method: "POST" },
  );
}

export async function clearBrowserIngestionRun(
  runId: number,
): Promise<BrowserIngestionDashboard> {
  return request<BrowserIngestionDashboard>(`/browser-ingestion/runs/${runId}/clear`, {
    method: "POST",
  });
}

export async function resetBrowserWorkerCooldown(): Promise<BrowserIngestionDashboard> {
  return request<BrowserIngestionDashboard>("/browser-ingestion/workers/reset-cooldown", {
    method: "POST",
  });
}
