console.log("TeamsFilter script loaded.");

// -----------------------------
// CONSTANTS
// -----------------------------
const labelsToKeep = [
  'Charging Support',
  'Commerce Support',
  'Pacific Tesla Support',
  'Roadside',
  'Service Center'
];
const labelsToKeepSet = new Set(labelsToKeep);

// -----------------------------
// FILTER FUNCTIONS
// -----------------------------
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

// -----------------------------
// APPLY FILTER TO HEADER + SMS TEAM DROPDOWN
// -----------------------------
function applyFilter() {
  if (!chrome?.storage?.sync) return;

  chrome.storage.sync.get({ teamsFilter: false }, (items) => {
    const headerDropdown = document.querySelector('#tcc-header-team-id');
    const smsTeamDropdown = document.querySelector('app-log-communication tds-form-input-dropdown');

    if (!items.teamsFilter) {
      resetDropdownVisibility(headerDropdown);
      resetDropdownVisibility(smsTeamDropdown);
    } else {
      filterDropdownOptions(headerDropdown);
      filterDropdownOptions(smsTeamDropdown);
    }
  });
}

// -----------------------------
// THROTTLED CLICK HANDLER
// -----------------------------
let clickTimeout = null;
document.addEventListener('click', () => {
  if (clickTimeout) clearTimeout(clickTimeout);
  clickTimeout = setTimeout(applyFilter, 100);
});

// -----------------------------
// INITIAL DROPDOWN WAIT
// -----------------------------
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

// -----------------------------
// AUTO SELECT EN-AU FOR SMS PANEL
// -----------------------------
function selectEnAuIfVisible() {
  try {
    const dropdowns = document.querySelectorAll('app-log-communication tds-form-input-dropdown');
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

// -----------------------------
// SMS OBSERVER
// -----------------------------
const smsObserver = new MutationObserver(() => {
  const smsElement = document.querySelector('app-log-communication .tcc-log-communication-container');
  if (smsElement) selectEnAuIfVisible();
});

smsObserver.observe(document.body, { childList: true, subtree: true });