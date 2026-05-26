"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useCopilotContext, type CopilotPageContext } from "@/components/copilot/copilot-context";

/**
 * Maps URL → copilot context so the sidebar stays context-aware.
 */
export function CopilotRouteSync() {
  const pathname = usePathname();
  const { setPageContext } = useCopilotContext();

  useEffect(() => {
    let context: CopilotPageContext = "other";
    let creatorName: string | null = null;
    let videoId: number | null = null;

    if (pathname === "/dashboard" || pathname === "/") {
      context = "dashboard";
    } else if (pathname === "/feed") {
      context = "feed";
    } else if (pathname === "/compare") {
      context = "compare";
    } else if (pathname === "/chat") {
      context = "chat";
    } else if (pathname === "/research") {
      context = "research";
    } else if (pathname === "/hooks") {
      context = "hooks";
    } else if (pathname === "/scripts") {
      context = "scripts";
    } else if (pathname === "/analytics") {
      context = "analytics";
    } else if (pathname.startsWith("/creators/")) {
      context = "creator";
      creatorName = decodeURIComponent(pathname.split("/")[2] ?? "");
    } else if (pathname.startsWith("/videos/")) {
      context = "video";
      const id = parseInt(pathname.split("/")[2] ?? "", 10);
      videoId = Number.isNaN(id) ? null : id;
    }

    setPageContext({ context, creatorName, videoId });
  }, [pathname, setPageContext]);

  return null;
}
