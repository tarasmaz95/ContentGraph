"use client";

import { CommandPaletteProvider } from "@/components/command-palette/command-palette";
import { KeyboardShortcuts } from "@/components/convenience/keyboard-shortcuts";
import { ToastProvider } from "@/components/convenience/toast-provider";
import { CopilotShell } from "@/components/copilot/copilot-shell";
import { SheetsSyncProvider } from "@/components/sync/sheets-sync-context";
import { LocaleProvider } from "@/lib/i18n";

/** Root client providers — locale, command palette, copilot shell */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ToastProvider>
        <CommandPaletteProvider>
          <SheetsSyncProvider>
            <KeyboardShortcuts />
            <CopilotShell>{children}</CopilotShell>
          </SheetsSyncProvider>
        </CommandPaletteProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
