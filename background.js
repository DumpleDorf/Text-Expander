// -------------------------
// Background Script
// -------------------------

let towbookAudioNotifierEnabled = false;
let oceanaNotifierEnabled = false;

// Initialize cached setting
chrome.storage.sync.get('towbookAudioNotifier', (data) => {
  towbookAudioNotifierEnabled = !!data.towbookAudioNotifier;
  console.log('Initial towbookAudioNotifier:', towbookAudioNotifierEnabled);
});

chrome.storage.sync.get('oceanaNotifierEnabled', (data) => {
  oceanaNotifierEnabled = !!data.oceanaNotifierEnabled;
  console.log('Initial oceanaNotifierEnabled:', oceanaNotifierEnabled);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    // Towbook Audio Notifier toggle
    if ("towbookAudioNotifier" in changes) {
      towbookAudioNotifierEnabled = changes.towbookAudioNotifier.newValue;
      console.log(`Towbook Audio Notifier is now ${towbookAudioNotifierEnabled ? 'ON' : 'OFF'}`);
    }

    // Oceana Notifier toggle
    if ("oceanaNotifierEnabled" in changes) {
      oceanaNotifierEnabled = changes.oceanaNotifierEnabled.newValue;
      console.log(`Oceana Notifier is now ${oceanaNotifierEnabled ? 'ON' : 'OFF'}`);
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Towbook
  if (changeInfo.audible && tab.url && isTowbookUrl(tab.url)) {
    if (towbookAudioNotifierEnabled) {
      console.log("Towbook audible tab detected and notifier enabled, sending notification.");

      chrome.windows.update(tab.windowId, { focused: true }, () => {
        chrome.tabs.update(tab.id, { active: true }, () => {
          console.log("✅ Towbook tab focused");
        });
      });

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

  // Oceana
  if (changeInfo.audible && tab.url && isOceanaUrl(tab.url)) {
    if (oceanaNotifierEnabled) {
      console.log("Oceana audible tab detected and notifier enabled, sending notification.");

      chrome.windows.update(tab.windowId, { focused: true }, () => {
        chrome.tabs.update(tab.id, { active: true }, () => {
          console.log("✅ Oceana tab focused");
        });
      });

      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/avaya_logo.png"), // your Oceana icon
        title: "Oceana Alert",
        message: "Incoming Oceana Notification",
        priority: 2,
      });
    } else {
      console.log("Oceana audible tab detected but notifier disabled, no notification.");
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

function isOceanaUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "workspaces.tesla.com";
  } catch {
    return false;
  }
}