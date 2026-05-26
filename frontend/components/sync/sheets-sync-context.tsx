"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SheetsSyncProgressPanel } from "@/components/sync/sheets-sync-progress-panel";
import {
  clearStoredSyncRunId,
  getStoredSyncRunId,
  setStoredSyncRunId,
} from "@/lib/sheets-sync-storage";
import { useT } from "@/lib/i18n";
import {
  fetchActiveSyncRun,
  fetchLastSyncStatus,
  fetchSyncRun,
  startSheetsSync,
} from "@/services/api";
import {
  isSyncRunActive,
  type LastSyncStatus,
  type SyncRun,
  type SyncRunMode,
} from "@/types/sync-run";

function parseApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: string | { msg?: string }[] };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) {
      return parsed.detail[0].msg;
    }
  } catch {
    /* plain text */
  }
  return raw || "Request failed";
}

export const SHEETS_SYNC_COMPLETE_EVENT = "contentgraph:sheets-sync-complete";

type SheetsSyncContextValue = {
  run: SyncRun | null;
  lastSync: LastSyncStatus | null;
  isActive: boolean;
  isStarting: boolean;
  isRecovering: boolean;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  startSync: (mode?: SyncRunMode) => Promise<void>;
  refreshRun: () => Promise<void>;
  refreshLastSync: () => Promise<void>;
  lastError: string | null;
  clearLastError: () => void;
};

const SheetsSyncContext = createContext<SheetsSyncContextValue | null>(null);

export function SheetsSyncProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [run, setRun] = useState<SyncRun | null>(null);
  const [lastSync, setLastSync] = useState<LastSyncStatus | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const completeFiredRef = useRef<number | null>(null);

  const isActive = isSyncRunActive(run);

  const refreshLastSync = useCallback(async () => {
    try {
      setLastSync(await fetchLastSyncStatus());
    } catch {
      /* optional */
    }
  }, []);

  const recover = useCallback(async () => {
    setIsRecovering(true);
    try {
      let active = await fetchActiveSyncRun();
      if (!active) {
        const storedId = getStoredSyncRunId();
        if (storedId) {
          active = await fetchSyncRun(storedId);
        }
      }
      if (!active) return;
      setRun(active);
      if (isSyncRunActive(active)) {
        setStoredSyncRunId(active.id);
      } else {
        clearStoredSyncRunId();
      }
    } catch {
      /* recovery is best-effort */
    } finally {
      setIsRecovering(false);
    }
  }, []);

  useEffect(() => {
    void recover();
    void refreshLastSync();
  }, [recover, refreshLastSync]);

  useEffect(() => {
    if (!run?.id || !isActive) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await fetchSyncRun(run.id);
        if (cancelled) return;
        setRun(next);
        if (!isSyncRunActive(next)) {
          clearStoredSyncRunId();
        }
      } catch {
        /* keep last known state */
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [run?.id, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (run?.status !== "completed" || completeFiredRef.current === run.id) {
      return;
    }
    completeFiredRef.current = run.id;
    void refreshLastSync();
    window.dispatchEvent(
      new CustomEvent(SHEETS_SYNC_COMPLETE_EVENT, { detail: run }),
    );
  }, [run, refreshLastSync]);

  const startSync = useCallback(
    async (mode: SyncRunMode = "quick") => {
      if (isActive) {
        setLastError(t("sheetsSync.alreadyRunning"));
        setPanelOpen(true);
        return;
      }
      setIsStarting(true);
      setLastError(null);
      try {
        const { run_id } = await startSheetsSync(mode);
        setStoredSyncRunId(run_id);
        const fresh = await fetchSyncRun(run_id);
        setRun(fresh);
        setPanelOpen(true);
        completeFiredRef.current = null;
      } catch (err) {
        const raw =
          err instanceof Error ? err.message : t("sheetsSync.startFailed");
        setLastError(parseApiError(raw));
        setPanelOpen(true);
      } finally {
        setIsStarting(false);
      }
    },
    [isActive, t],
  );

  const refreshRun = useCallback(async () => {
    if (!run?.id) return;
    const next = await fetchSyncRun(run.id);
    setRun(next);
  }, [run?.id]);

  const value = useMemo(
    () => ({
      run,
      lastSync,
      isActive,
      isStarting,
      isRecovering,
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
      startSync,
      refreshRun,
      refreshLastSync,
      lastError,
      clearLastError: () => setLastError(null),
    }),
    [
      run,
      lastSync,
      isActive,
      isStarting,
      isRecovering,
      panelOpen,
      startSync,
      refreshRun,
      refreshLastSync,
      lastError,
    ],
  );

  void tick;

  return (
    <SheetsSyncContext.Provider value={value}>
      {children}
      <SheetsSyncProgressPanel />
    </SheetsSyncContext.Provider>
  );
}

export function useSheetsSync(): SheetsSyncContextValue {
  const ctx = useContext(SheetsSyncContext);
  if (!ctx) {
    throw new Error("useSheetsSync must be used within SheetsSyncProvider");
  }
  return ctx;
}
