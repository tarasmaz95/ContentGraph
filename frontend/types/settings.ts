/** App settings — Google Sheets + OpenAI model (global, internal tool). */

export type SettingsSource = "database" | "env" | "database+env";

/** Internal model selector — static allowlist with display labels */
export const OPENAI_MODEL_OPTIONS = [
  { id: "gpt-5.5", label: "GPT-5.5 — Best reasoning / flagship" },
  { id: "gpt-5.4", label: "GPT-5.4 — Previous flagship" },
  { id: "gpt-5.3-instant", label: "GPT-5.3 Instant — Fast chat model" },
  { id: "gpt-5.2", label: "GPT-5.2 — Balanced general model" },
  { id: "gpt-5.1", label: "GPT-5.1 — Early reasoning model" },
  { id: "gpt-5", label: "GPT-5 — First GPT-5 flagship" },
  { id: "gpt-5-mini", label: "GPT-5 Mini — Fast & cheap" },
  { id: "gpt-5-nano", label: "GPT-5 Nano — Ultra-low latency" },
  { id: "gpt-4.1", label: "GPT-4.1 — Stable legacy model" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini — Cheap legacy model" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano — Lightweight legacy" },
] as const;

export type OpenAIModelOption = (typeof OPENAI_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_OPENAI_MODEL: OpenAIModelOption = "gpt-5.4";

export const OPENAI_MODEL_IDS: readonly OpenAIModelOption[] = OPENAI_MODEL_OPTIONS.map(
  (o) => o.id,
);

export function isOpenAIModelOption(value: string): value is OpenAIModelOption {
  return (OPENAI_MODEL_IDS as readonly string[]).includes(value);
}

export function openAIModelLabel(modelId: string): string {
  const found = OPENAI_MODEL_OPTIONS.find((o) => o.id === modelId);
  return found?.label ?? modelId;
}

export interface DataSourceSettings {
  spreadsheet_id: string;
  range: string;
  sheet_url?: string;
  sheet_tab?: string | null;
  column_mapping?: Record<string, string>;
  openai_model: string;
  service_account_email: string;
  source: SettingsSource;
  model_source: SettingsSource;
}

/** Fallback when API omits email (older backend) */
export const DEFAULT_SERVICE_ACCOUNT_EMAIL =
  "contentgraph-lite@denis-automation.iam.gserviceaccount.com";

export interface DataSourceSettingsUpdate {
  spreadsheet_id: string;
  range: string;
  column_mapping?: Record<string, string>;
  openai_model: string;
}
