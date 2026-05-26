"use client";

import { Laptop, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BrowserIngestionWorker } from "@/types/browser-ingestion";
import { isWorkerConnected, isWorkerHealthy } from "@/types/browser-ingestion";
import { friendlyPhase, isWorkerProcessing } from "@/lib/browser-ingestion-labels";

export function WorkerCtaBanner({
  worker,
  onScrollToSetup,
}: {
  worker: BrowserIngestionWorker | null;
  onScrollToSetup: () => void;
}) {
  const t = useT();
  const connected = isWorkerConnected(worker);
  const healthy = isWorkerHealthy(worker);
  const processing =
    worker &&
    isWorkerProcessing(worker.current_phase, worker.current_action);

  if (!connected) {
    return (
      <div
        className={cn(
          "rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 text-center shadow-sm",
        )}
      >
        <Laptop className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h2 className="text-lg font-semibold">{t("browserIngestion.ctaOfflineTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("browserIngestion.ctaOfflineDesc")}
        </p>
        <Button className="mt-4" size="lg" onClick={onScrollToSetup}>
          {t("browserIngestion.ctaOfflineButton")}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4 shadow-sm",
        healthy
          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-transparent"
          : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-transparent",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              processing ? "animate-ping bg-emerald-400" : "bg-emerald-500",
            )}
          />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">
            {t("browserIngestion.ctaOnlineTitle")}
          </p>
          {processing && worker && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Radio className="h-3.5 w-3.5 animate-pulse text-primary" />
              {friendlyPhase(worker.current_phase || worker.current_action, t)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
