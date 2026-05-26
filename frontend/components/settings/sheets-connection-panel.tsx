"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Table2,
} from "lucide-react";

import { CopyButton } from "@/components/convenience/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { spreadsheetEditUrl } from "@/lib/sheets-url";
import {
  fetchSheetPreview,
  fetchSheetTabs,
  parseSheetsUrl,
} from "@/services/api";
import {
  DEFAULT_SERVICE_ACCOUNT_EMAIL,
  type DataSourceSettings,
  type DataSourceSettingsUpdate,
} from "@/types/settings";
import {
  REQUIRED_SHEET_FIELDS,
  SHEET_FIELD_KEYS,
  type SheetFieldKey,
  type SheetPreviewResponse,
} from "@/types/sheets";
function parseApiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { detail?: string };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    /* plain */
  }
  return raw || "Request failed";
}

interface SheetsConnectionPanelProps {
  initial: DataSourceSettings | null;
  busy: boolean;
  onSave: (payload: DataSourceSettingsUpdate) => Promise<void>;
  onSaveAndSync: (payload: DataSourceSettingsUpdate) => Promise<void>;
}

/** Paste URL → pick tab → map columns → sync */
export function SheetsConnectionPanel({
  initial,
  busy,
  onSave,
  onSaveAndSync,
}: SheetsConnectionPanelProps) {
  const t = useT();

  const [sheetUrl, setSheetUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [tabs, setTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState("");
  const [range, setRange] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [missingRequired, setMissingRequired] = useState<string[]>([]);

  const [inspecting, setInspecting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const applyPreview = useCallback((preview: SheetPreviewResponse) => {
    setHeaders(preview.headers);
    setPreviewRows(preview.preview_rows);
    setColumnMapping(preview.column_mapping);
    setMissingRequired(preview.missing_required);
    setRange(preview.suggested_range);
  }, []);

  const loadPreview = useCallback(
    async (id: string, tab: string) => {
      setPreviewLoading(true);
      setError(null);
      try {
        const preview = await fetchSheetPreview(id, tab);
        applyPreview(preview);
      } catch (err) {
        setError(err instanceof Error ? parseApiError(err.message) : t("sheetsConnect.previewFailed"));
      } finally {
        setPreviewLoading(false);
      }
    },
    [applyPreview, t],
  );

  const inspectUrl = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      setInspecting(true);
      setError(null);
      try {
        const result = await parseSheetsUrl(trimmed);
        setSpreadsheetId(result.spreadsheet_id);
        setSheetUrl(result.spreadsheet_url);
        setTabs(result.tabs);
        const tab = result.tabs[0] ?? "";
        setSelectedTab(tab);
        if (tab) await loadPreview(result.spreadsheet_id, tab);
      } catch (err) {
        setError(
          err instanceof Error ? parseApiError(err.message) : t("sheetsConnect.urlFailed"),
        );
        setTabs([]);
        setSelectedTab("");
      } finally {
        setInspecting(false);
      }
    },
    [loadPreview, t],
  );

  useEffect(() => {
    if (!initial || hydrated) return;
    const id = initial.spreadsheet_id?.trim();
    if (!id) {
      setHydrated(true);
      return;
    }
    setSpreadsheetId(id);
    setSheetUrl(initial.sheet_url || spreadsheetEditUrl(id));
    setRange(initial.range || "");
    setColumnMapping(initial.column_mapping ?? {});
    const tab = initial.sheet_tab ?? "";
    setSelectedTab(tab);

    void (async () => {
      try {
        const tabList = await fetchSheetTabs(id);
        setTabs(tabList);
        const activeTab =
          tab && tabList.includes(tab) ? tab : tabList[0] ?? "";
        setSelectedTab(activeTab);
        if (activeTab) await loadPreview(id, activeTab);
      } catch {
        if (tab) await loadPreview(id, tab);
      } finally {
        setHydrated(true);
      }
    })();
  }, [initial, hydrated, loadPreview]);

  const onTabChange = (tab: string) => {
    setSelectedTab(tab);
    if (spreadsheetId && tab) void loadPreview(spreadsheetId, tab);
  };

  const buildPayload = (): DataSourceSettingsUpdate | null => {
    if (!spreadsheetId.trim()) {
      setError(t("sheetsConnect.urlRequired"));
      return null;
    }
    if (!selectedTab || !range.trim()) {
      setError(t("sheetsConnect.tabRequired"));
      return null;
    }
    if (missingRequired.length > 0) {
      setError(t("sheetsConnect.mappingRequired"));
      return null;
    }
    setError(null);
    return {
      spreadsheet_id: spreadsheetId.trim(),
      range: range.trim(),
      column_mapping: columnMapping,
      openai_model: initial?.openai_model ?? "gpt-5.4", // parent overwrites on save
    };
  };

  const updateMapping = (field: SheetFieldKey, header: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (header) next[field] = header;
      else delete next[field];
      const normalizedHeaders = headers.map((h) => h.toLowerCase());
      const missing = REQUIRED_SHEET_FIELDS.filter((f) => {
        const label = next[f];
        return !label || !normalizedHeaders.includes(label.toLowerCase());
      });
      setMissingRequired(missing);
      return next;
    });
  };

  const connected = Boolean(spreadsheetId && tabs.length);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm font-medium">{t("settings.dataSource.shareTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.dataSource.shareDesc")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-md border bg-background px-2 py-1 text-xs font-mono break-all">
            {initial?.service_account_email ?? DEFAULT_SERVICE_ACCOUNT_EMAIL}
          </code>
          <CopyButton
            text={initial?.service_account_email ?? DEFAULT_SERVICE_ACCOUNT_EMAIL}
            label={t("settings.dataSource.copyEmail")}
            variant="outline"
            size="sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="sheets-url" className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="h-4 w-4 text-primary" />
          {t("sheetsConnect.urlLabel")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="sheets-url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder={t("sheetsConnect.urlPlaceholder")}
            disabled={busy || inspecting}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy || inspecting || !sheetUrl.trim()}
            onClick={() => void inspectUrl(sheetUrl)}
          >
            {inspecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("sheetsConnect.loadSheet")
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("sheetsConnect.urlHint")}</p>
      </div>

      {connected && (
        <>
          <div className="space-y-2">
            <label htmlFor="sheet-tab" className="text-sm font-medium">
              {t("sheetsConnect.tabLabel")}
            </label>
            <select
              id="sheet-tab"
              value={selectedTab}
              onChange={(e) => onTabChange(e.target.value)}
              disabled={busy || previewLoading}
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {tabs.map((tab) => (
                <option key={tab} value={tab}>
                  {tab}
                </option>
              ))}
            </select>
          </div>

          {previewLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("sheetsConnect.loadingPreview")}
            </div>
          )}

          {headers.length > 0 && !previewLoading && (
            <>
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Table2 className="h-4 w-4" />
                  {t("sheetsConnect.previewTitle")}
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {headers.map((_, colIdx) => (
                            <td key={colIdx} className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                              {row[colIdx] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium">{t("sheetsConnect.mappingTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("sheetsConnect.mappingHint")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SHEET_FIELD_KEYS.map((field) => (
                    <div key={field} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t(`sheetsConnect.field_${field}`)}
                        {REQUIRED_SHEET_FIELDS.includes(field) && " *"}
                      </label>
                      <select
                        value={columnMapping[field] ?? ""}
                        onChange={(e) => updateMapping(field, e.target.value)}
                        disabled={busy}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">—</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {missingRequired.length > 0 && (
                  <p className="text-xs text-destructive">{t("sheetsConnect.mappingRequired")}</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        {advancedOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {t("sheetsConnect.advanced")}
      </button>

      {advancedOpen && (
        <div className="space-y-3 rounded-lg border border-dashed p-4 text-xs">
          <div>
            <span className="text-muted-foreground">{t("sheetsConnect.advancedId")}</span>
            <code className="ml-2 font-mono">{spreadsheetId || "—"}</code>
          </div>
          <div className="space-y-1">
            <label htmlFor="advanced-range" className="font-medium">
              {t("sheetsConnect.advancedRange")}
            </label>
            <Input
              id="advanced-range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              disabled={busy}
              className="font-mono text-xs"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            const payload = buildPayload();
            if (payload) void onSaveAndSync(payload);
          }}
          disabled={busy || !connected}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t("sheetsConnect.connectSync")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const payload = buildPayload();
            if (payload) void onSave(payload);
          }}
          disabled={busy || !connected}
        >
          <Save className="mr-2 h-4 w-4" />
          {t("sheetsConnect.saveConfig")}
        </Button>
      </div>

    </div>
  );
}
