/** Client-side spreadsheet URL helpers (display only; server validates). */

const SPREADSHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const BARE_ID_RE = /^[a-zA-Z0-9-_]{20,}$/;

export function spreadsheetEditUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export function looksLikeSheetsUrl(value: string): boolean {
  const v = value.trim();
  return SPREADSHEET_ID_RE.test(v) || BARE_ID_RE.test(v);
}
