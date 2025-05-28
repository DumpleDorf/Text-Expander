chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("shortcuts", (data) => {
    if (!data.shortcuts) {
      chrome.storage.local.set({ shortcuts: {} });
    }
  });
});

// Open options page on icon click
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
});

// Check the setting on startup and add listeners accordingly
chrome.storage.sync.get("towbookAudioNotifier", (data) => {
  if (data.towbookAudioNotifier) {
    // Add your towbook audio notifier logic here directly,
    // or import it synchronously at the top of the file instead of here.
    // For example:
    setupTowbookAudioNotifier();
  }
});

function setupTowbookAudioNotifier() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.audible && tab.url && isTowbookUrl(tab.url)) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/towbook_icon.png"),
        title: "Towbook Alert",
        message: "Incoming Towbook Alert",
        priority: 2,
      });
    }
  });
}

function isTowbookUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "app.towbook.com";
  } catch {
    return false;
  }
}
