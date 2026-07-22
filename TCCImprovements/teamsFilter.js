// Disabled — teams dropdown filter is turned off for now.
// Re-enable by restoring this file in manifest.json content_scripts.
console.log("[TCC QOL] Teams filter disabled.");

/*
console.log("[TCC QOL] Teams filter script loaded.");

const labelsToKeep = [
  'Charging Support',
  'Commerce Support',
  'Pacific Tesla Support',
  'Roadside',
  'Service Center'
];
const labelsToKeepSet = new Set(labelsToKeep);

function isTccQolEnabled(callback) {
  chrome.storage.sync.get({ tccQolEnabled: true, teamsFilter: true }, (items) => {
    const enabled = items.tccQolEnabled !== null && items.tccQolEnabled !== undefined
      ? items.tccQolEnabled
      : items.teamsFilter;
    callback(!!enabled);
  });
}

function filterDropdownOptions(dropdown) {
  if (!dropdown) return;
  const optionList = dropdown.querySelector('div.tds-form-input');
  if (!optionList) return;

  for (const item of optionList.querySelectorAll('li')) {
    const label = item.getAttribute('data-tds-label')?.trim();
    item.style.display = labelsToKeepSet.has(label) ? '' : 'none';
  }
}

function resetDropdownVisibility(dropdown) {
  if (!dropdown) return;
  const optionList = dropdown.querySelector('div.tds-form-input');
  if (!optionList) return;

  for (const item of optionList.querySelectorAll('li')) {
    item.style.display = '';
  }
}

function applyFilter() {
  if (!chrome?.storage?.sync) return;

  isTccQolEnabled((enabled) => {
    const headerDropdown = document.querySelector('#tcc-header-team-id');
    const smsTeamDropdown = document.querySelector('app-log-communication tds-form-input-dropdown');

    if (!enabled) {
      resetDropdownVisibility(headerDropdown);
      resetDropdownVisibility(smsTeamDropdown);
    } else {
      filterDropdownOptions(headerDropdown);
      filterDropdownOptions(smsTeamDropdown);
    }
  });
}

let clickTimeout = null;
document.addEventListener('click', () => {
  if (clickTimeout) clearTimeout(clickTimeout);
  clickTimeout = setTimeout(applyFilter, 100);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && ('tccQolEnabled' in changes || 'teamsFilter' in changes)) {
    applyFilter();
  }
});

function waitForDropdown() {
  if (window.top !== window.self) return;

  const headerDropdown = document.querySelector('#tcc-header-team-id');
  const smsTeamDropdown = document.querySelector('app-log-communication tds-form-input-dropdown');

  if (headerDropdown || smsTeamDropdown) {
    applyFilter();
  } else {
    setTimeout(waitForDropdown, 500);
  }
}

waitForDropdown();

function selectEnAuIfVisible() {
  try {
    const dropdowns = document.querySelectorAll(
      'app-log-communication tds-form-input-dropdown, app-graph-email tds-form-input-dropdown'
    );
    if (!dropdowns.length) return;

    dropdowns.forEach(dropdown => {
      const listbox = dropdown.querySelector('ul.tds-listbox');
      if (!listbox) return;

      const wrapper = listbox.closest('.tds-dropdown');
      if (!wrapper) return;

      const styles = window.getComputedStyle(wrapper);
      if (styles.display === "none") return;

      const target = listbox.querySelector('[data-tds-label="en-au"]');
      if (!target) return;
      if (target.getAttribute("aria-selected") === "true") return;

      console.log("✅ Auto-selecting EN-AU");
      target.click();

      setTimeout(() => {
        const input = dropdown.querySelector('input.tds-form-input-dropdown');
        if (input) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 200);
    });
  } catch (err) {
    console.warn("LocaleSelect error:", err);
  }
}

const commsObserver = new MutationObserver(() => {
  const commsElement = document.querySelector(
    'app-log-communication .tcc-log-communication-container, app-graph-email .tcc-log-communication-container'
  );
  if (commsElement) selectEnAuIfVisible();
});

commsObserver.observe(document.body, { childList: true, subtree: true });
*/
