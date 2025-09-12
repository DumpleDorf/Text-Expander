// -------------------------
// Background Script
// -------------------------

let towbookAudioNotifierEnabled = false;

// Initialize cached setting
chrome.storage.sync.get('towbookAudioNotifier', (data) => {
  towbookAudioNotifierEnabled = !!data.towbookAudioNotifier;
  console.log('Initial towbookAudioNotifier:', towbookAudioNotifierEnabled);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    // Towbook Audio Notifier toggle
    if ("towbookAudioNotifier" in changes) {
      towbookAudioNotifierEnabled = changes.towbookAudioNotifier.newValue;
      console.log(`Towbook Audio Notifier is now ${towbookAudioNotifierEnabled ? 'ON' : 'OFF'}`);
    }

    // SC AutoMessager toggle
    if ("scAutoMessagerEnabled" in changes) {
      chrome.tabs.query({ url: "*://app.towbook.com/*" }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: "toggleAutoMessager",
            enabled: changes.scAutoMessagerEnabled.newValue
          });
        });
      });
    }

    // AU Filter toggle is now handled entirely in the content script
    if ("auFilterEnabled" in changes) {
      console.log(`[AU Filter] Toggle changed to ${changes.auFilterEnabled.newValue ? 'ON' : 'OFF'}`);
      // No injection needed
    }
  }
});

// Notify on audible Towbook tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible && tab.url && isTowbookUrl(tab.url)) {
    if (towbookAudioNotifierEnabled) {
      console.log("Towbook audible tab detected and notifier enabled, sending notification.");
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/towbook_icon.png"),
        title: "Towbook Alert",
        message: "Incoming Towbook Alert",
        priority: 2,
      });
    } else {
      console.log("Towbook audible tab detected but notifier disabled, no notification.");
    }
  }
});

function isTowbookUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "app.towbook.com";
  } catch {
    return false;
  }
}
