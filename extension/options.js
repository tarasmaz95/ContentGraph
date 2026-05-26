const DEFAULT_API_BASE = "https://tm1.website/api/v1";

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("apiBase");
  const keyInput = document.getElementById("extensionApiKey");
  const status = document.getElementById("status");
  const stored = await chrome.storage.sync.get({
    apiBase: DEFAULT_API_BASE,
    extensionApiKey: "",
  });
  input.value = stored.apiBase || DEFAULT_API_BASE;
  keyInput.value = stored.extensionApiKey || "";

  document.getElementById("save").addEventListener("click", async () => {
    const apiBase = input.value.trim().replace(/\/$/, "") || DEFAULT_API_BASE;
    const extensionApiKey = keyInput.value.trim();
    await chrome.storage.sync.set({ apiBase, extensionApiKey });
    status.textContent = "Saved.";
  });
});
