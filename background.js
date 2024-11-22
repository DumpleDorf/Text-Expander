chrome.runtime.onInstalled.addListener(() => {
    // Initialize storage with an empty object if no shortcuts are saved
    chrome.storage.local.get("shortcuts", (data) => {
        if (!data.shortcuts) {
            chrome.storage.local.set({ shortcuts: {} });
        }
    });
});

// Open the options page when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
});
