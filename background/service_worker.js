// MV3 Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Scratch HUD Coach installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CAPTURE_SCREENSHOT") {
    // Use sender.tab if available; otherwise query active tab
    const doCapture = (windowId) => {
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, dataUrl });
        }
      });
    };

    if (sender.tab && sender.tab.windowId !== undefined) {
      doCapture(sender.tab.windowId);
    } else {
      chrome.windows.getLastFocused({}, (win) => doCapture(win.id));
    }

    return true; // async
  }

  if (msg && msg.type === "COMMAND") {
    // keyboard shortcuts wired via content script
    chrome.tabs.sendMessage(sender.tab.id, { type: msg.payload }, () => {});
  }
});
