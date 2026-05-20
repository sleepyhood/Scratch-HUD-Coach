chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  document.getElementById("btn-toggle").addEventListener("click", () => {
    chrome.tabs.sendMessage(tab.id, { type: "toggle-hud" });
    window.close();
  });
});
