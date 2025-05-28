console.log("Towbook Audio Notifier script loaded.");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible && tab.url && isTowbookUrl(tab.url)) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/towbook_icon.png"),
      title: "Towbook Alert",
      message: "Incoming Towbook Alert",
      priority: 2
    });
  }
});

function isTowbookUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "app.towbook.com";
  } catch (e) {
    return false;
  }
}
