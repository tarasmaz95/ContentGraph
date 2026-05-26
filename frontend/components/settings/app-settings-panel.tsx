"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { HistoricalAnalyticsInfoCard } from "@/components/settings/historical-analytics-info";
import { SheetsConnectionPanel } from "@/components/settings/sheets-connection-panel";
import { Toast } from "@/components/ui/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { LastSyncBadge } from "@/components/sync/last-sync-badge";
import { useSheetsSync } from "@/components/sync/sheets-sync-context";
import {
  fetchDataSourceSettings,
  updateDataSourceSettings,
} from "@/services/api";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_MODEL_OPTIONS,
  isOpenAIModelOption,
  openAIModelLabel,
  type DataSourceSettings,
  type DataSourceSettingsUpdate,
  type OpenAIModelOption,
} from "@/types/settings";

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

/** Google Sheets + OpenAI model — lightweight internal settings. */
export function AppSettingsPanel() {
  const t = useT();
  const { startSync, lastSync, isActive, isStarting } = useSheetsSync();
  const [settings, setSettings] = useState<DataSourceSettings | null>(null);
  const [openaiModel, setOpenaiModel] = useState<OpenAIModelOption>(DEFAULT_OPENAI_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDataSourceSettings();
      setSettings(data);
      setOpenaiModel(
        isOpenAIModelOption(data.openai_model) ? data.openai_model : DEFAULT_OPENAI_MODEL,
      );
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : t("settings.loadFailed"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const withModel = (payload: DataSourceSettingsUpdate): DataSourceSettingsUpdate => ({
    ...payload,
    openai_model: openaiModel,
  });

  const handleSave = async (payload: DataSourceSettingsUpdate) => {
    setSaving(true);
    try {
      const updated = await updateDataSourceSettings(withModel(payload));
      setSettings(updated);
      setToast({ message: t("settings.saveSuccess"), variant: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? parseApiError(err.message) : t("settings.saveFailed"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSync = async (payload: DataSourceSettingsUpdate) => {
    setSaving(true);
    try {
      const updated = await updateDataSourceSettings(withModel(payload));
      setSettings(updated);
      setToast({ message: t("settings.dataSource.saveSyncSuccess"), variant: "success" });
      await startSync("full");
    } catch (err) {
      setToast({
        message: err instanceof Error ? parseApiError(err.message) : t("settings.dataSource.syncFailed"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isActive || isStarting;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.ai.title")}</CardTitle>
            <CardDescription>{t("settings.ai.description")}</CardDescription>
            {settings && (
              <p className="text-xs text-muted-foreground">
                {t("settings.ai.currentModel")}:{" "}
                <span className="font-medium text-foreground">
                  {openAIModelLabel(settings.openai_model)}
                </span>
                <span className="ml-2 text-muted-foreground">({settings.model_source})</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="openai-model" className="text-sm font-medium">
                {t("settings.ai.modelLabel")}
              </label>
              <select
                id="openai-model"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value as OpenAIModelOption)}
                disabled={busy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {OPENAI_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("settings.ai.modelHint")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.dataSource.connectTitle")}</CardTitle>
            <CardDescription>{t("settings.dataSource.connectDesc")}</CardDescription>
            <div className="pt-2">
              <LastSyncBadge lastSync={lastSync} />
            </div>
            {settings?.spreadsheet_id && (
              <p className="text-xs text-muted-foreground">
                {t("settings.dataSource.activeSource")}:{" "}
                <span className="font-mono">{settings.source}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <SheetsConnectionPanel
              initial={settings}
              busy={busy}
              onSave={handleSave}
              onSaveAndSync={handleSaveAndSync}
            />
          </CardContent>
        </Card>

        <HistoricalAnalyticsInfoCard
          onToast={(message, variant) => setToast({ message, variant })}
        />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
