document.addEventListener("DOMContentLoaded", () => {
  const optionsButton = document.getElementById("options");
  if (!optionsButton) return;

  optionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        window.open(chrome.runtime.getURL("options.html"), "_blank");
      }
    });
  });
});
