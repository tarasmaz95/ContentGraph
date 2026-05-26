import { Info } from "lucide-react";

import { InfoTip } from "@/components/ui/info-tip";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

interface DashboardMetricsNoticeProps {
  catalogTotal: number;
  sampleSize: number;
  /** Compact one-line hint for exploration mode */
  compact?: boolean;
}

/** Explains why dashboard metrics use a top-N sample, not the full catalog. */
export function DashboardMetricsNotice({
  catalogTotal,
  sampleSize,
  compact = false,
}: DashboardMetricsNoticeProps) {
  const t = useT();

  if (catalogTotal <= 0 || sampleSize <= 0) return null;

  const isFullCatalog = sampleSize >= catalogTotal;

  if (compact && !isFullCatalog) {
    return (
      <p
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        role="note"
      >
        <Info className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        {t("dashboard.metricsCompactHint", { sample: sampleSize })}
        <InfoTip term="dashboard_metrics_sample" />
      </p>
    );
  }

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
      role="note"
      aria-label={t("dashboard.metricsNoticeTitle")}
    >
      <div className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {t("dashboard.metricsNoticeTitle")}
            <InfoTip term="dashboard_metrics_sample" />
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {isFullCatalog
              ? t("dashboard.metricsNoticeFullCatalog", { count: catalogTotal })
              : t("dashboard.metricsNoticeBody", {
                  catalog: catalogTotal,
                  sample: sampleSize,
                })}
          </p>
          {!isFullCatalog && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">
                {t("dashboard.metricsBadgeCatalog", { count: catalogTotal })}
              </Badge>
              <Badge variant="secondary">
                {t("dashboard.metricsBadgeSample", { count: sampleSize })}
              </Badge>
              <Badge variant="muted">{t("dashboard.metricsBadgeSort")}</Badge>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("dashboard.metricsNoticeFootnote")}</p>
        </div>
      </div>
    </div>
  );
}
