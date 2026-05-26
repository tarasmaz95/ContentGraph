"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CopilotPageContext =
  | "dashboard"
  | "creator"
  | "video"
  | "research"
  | "chat"
  | "hooks"
  | "analytics"
  | "feed"
  | "compare"
  | "scripts"
  | "other";

interface CopilotContextValue {
  context: CopilotPageContext;
  creatorName: string | null;
  videoId: number | null;
  /** Active dashboard search query — hides unrelated trend brief */
  dashboardSearchQuery: string | null;
  setDashboardSearchQuery: (query: string | null) => void;
  setPageContext: (ctx: {
    context: CopilotPageContext;
    creatorName?: string | null;
    videoId?: number | null;
  }) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<CopilotPageContext>("dashboard");
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState<string | null>(
    null,
  );

  const setPageContext = useCallback(
    (ctx: {
      context: CopilotPageContext;
      creatorName?: string | null;
      videoId?: number | null;
    }) => {
      setContext(ctx.context);
      setCreatorName(ctx.creatorName ?? null);
      setVideoId(ctx.videoId ?? null);
    },
    [],
  );

  const value = useMemo(
    () => ({
      context,
      creatorName,
      videoId,
      dashboardSearchQuery,
      setDashboardSearchQuery,
      setPageContext,
      collapsed,
      setCollapsed,
    }),
    [
      context,
      creatorName,
      videoId,
      dashboardSearchQuery,
      setPageContext,
      collapsed,
    ],
  );

  return (
    <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
  );
}

export function useCopilotContext(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error("useCopilotContext must be used within CopilotProvider");
  }
  return ctx;
}
