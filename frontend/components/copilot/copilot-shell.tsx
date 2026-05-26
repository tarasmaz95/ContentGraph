"use client";

import { CopilotProvider } from "@/components/copilot/copilot-context";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { CopilotRouteSync } from "@/components/copilot/copilot-route-sync";

/** Wraps app content with persistent copilot sidebar */
export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      <CopilotRouteSync />
      <div className="flex w-full">
        <div className="min-w-0 flex-1">{children}</div>
        <CopilotPanel />
      </div>
    </CopilotProvider>
  );
}
