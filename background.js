// -------------------------
// Background Script
// -------------------------

const TCC_QOL_MIGRATION_KEY = 'tccQolDefaultEnabledV1';
const PACE_QOL_MIGRATION_KEY = 'paceQolDefaultEnabledV1';

// Teams dropdown filter stays permanently off (it reset the header team /
// version modal). AU dashboard filter is re-enabled with the QOL toggle.
function forceTeamsFilterOff() {
  chrome.storage.sync.set({ teamsFilter: false });
}

function enableTccQol(enabled = true) {
  chrome.storage.sync.set({
    tccQolEnabled: enabled,
    teamsFilter: false,
    auFilterEnabled: enabled
  });
}

forceTeamsFilterOff();

function enablePaceQol(enabled = true) {
  chrome.storage.sync.set({ paceQolEnabled: enabled });
}

const PACE_URL_PATTERN = /^https:\/\/os\.tesla\.com\/en-AU\/pace(\/|$|\?)/i;

function isPacePageUrl(url) {
  return PACE_URL_PATTERN.test(url || "");
}

function shouldInjectPaceQol(url) {
  return isPacePageUrl(url);
}

async function injectPaceTransferPicker(tabId, url) {
  const items = await chrome.storage.sync.get({ paceQolEnabled: true });
  if (items.paceQolEnabled === false) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['PACEImprovements/transferPicker.js']
    });
    console.log('[PACE QOL] Injected into PACE tab', tabId, url || '');
  } catch (err) {
    console.warn('[PACE QOL] Injection failed for tab', tabId, url || '', err.message);
  }
}

function injectPaceQolIntoMatchingTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id && tab.url && shouldInjectPaceQol(tab.url)) {
        injectPaceTransferPicker(tab.id, tab.url);
      }
    });
  });
}

function registerPaceContentScript() {
  chrome.scripting.unregisterContentScripts({ ids: ['pace-qol-transfer-picker'] }, () => {
    chrome.scripting.registerContentScripts([{
      id: 'pace-qol-transfer-picker',
      js: ['PACEImprovements/transferPicker.js'],
      matches: [
        'https://os.tesla.com/en-AU/pace',
        'https://os.tesla.com/en-AU/pace/',
        'https://os.tesla.com/en-AU/pace/*'
      ],
      runAt: 'document_idle',
      persistAcrossSessions: true
    }]).then(() => {
      console.log('[PACE QOL] Registered dynamic content script');
    }).catch((err) => {
      console.warn('[PACE QOL] Dynamic registration failed:', err.message);
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || !shouldInjectPaceQol(tab.url)) return;
  if (changeInfo.status === 'complete' || changeInfo.url) {
    injectPaceTransferPicker(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return;
    if (shouldInjectPaceQol(tab.url)) {
      injectPaceTransferPicker(tab.id, tab.url);
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.paceQolEnabled) return;
  if (changes.paceQolEnabled.newValue !== false) {
    injectPaceQolIntoMatchingTabs();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    enableTccQol(true);
    enablePaceQol(true);
    chrome.storage.sync.set({
      [TCC_QOL_MIGRATION_KEY]: true,
      [PACE_QOL_MIGRATION_KEY]: true
    });
    console.log('[TCC QOL] Enabled by default on install');
    console.log('[PACE QOL] Enabled by default on install');
    registerPaceContentScript();
    injectPaceQolIntoMatchingTabs();
    return;
  }

  if (details.reason === 'update') {
    chrome.storage.sync.get({
      [TCC_QOL_MIGRATION_KEY]: false,
      [PACE_QOL_MIGRATION_KEY]: false
    }, (items) => {
      if (!items[TCC_QOL_MIGRATION_KEY]) {
        enableTccQol(true);
        chrome.storage.sync.set({ [TCC_QOL_MIGRATION_KEY]: true });
        console.log('[TCC QOL] Enabled for existing users on update');
      }
      if (!items[PACE_QOL_MIGRATION_KEY]) {
        enablePaceQol(true);
        chrome.storage.sync.set({ [PACE_QOL_MIGRATION_KEY]: true });
        console.log('[PACE QOL] Enabled for existing users on update');
      }
      injectPaceQolIntoMatchingTabs();
      registerPaceContentScript();
    });
  }

  registerPaceContentScript();
  injectPaceQolIntoMatchingTabs();
});

registerPaceContentScript();
injectPaceQolIntoMatchingTabs();

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

    // TCC QOL toggle is handled in the content scripts
    if ("tccQolEnabled" in changes) {
      console.log(`[TCC QOL] Toggle changed to ${changes.tccQolEnabled.newValue ? 'ON' : 'OFF'}`);
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