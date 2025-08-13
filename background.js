// Towbook Audio Notifier

let towbookAudioNotifierEnabled = false;

// Initialize cached setting
chrome.storage.sync.get('towbookAudioNotifier', (data) => {
  towbookAudioNotifierEnabled = !!data.towbookAudioNotifier;
  console.log('Initial towbookAudioNotifier:', towbookAudioNotifierEnabled);
});

// Listen for changes to update cache
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'towbookAudioNotifier' in changes) {
    towbookAudioNotifierEnabled = !!changes.towbookAudioNotifier.newValue;
    console.log('Updated towbookAudioNotifier:', towbookAudioNotifierEnabled);
  }
});

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
