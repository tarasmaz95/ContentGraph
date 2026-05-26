const DEFAULT_API_BASE = "https://tm1.website/api/v1";
const EXTENSION_KEY_HEADER = "X-Extension-Key";

async function getApiBase() {
  const stored = await chrome.storage.sync.get({ apiBase: DEFAULT_API_BASE });
  return (stored.apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
}

async function getIngestHeaders() {
  const stored = await chrome.storage.sync.get({ extensionApiKey: "" });
  const headers = { "Content-Type": "application/json" };
  const key = (stored.extensionApiKey || "").trim();
  if (key) {
    headers[EXTENSION_KEY_HEADER] = key;
  }
  return headers;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SAVE_TRANSCRIPT") {
    postIngest("/transcripts/ingest", message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  if (message?.type === "SAVE_COMMENTS") {
    postIngest("/comments/ingest", message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }
  return false;
});

async function postIngest(path, payload) {
  const apiBase = await getApiBase();
  const headers = await getIngestHeaders();
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join("; ")
          : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body;
}
