console.log("TeamsFilter script loaded.");

// Labels to keep
const labelsToKeep = ['Charging Support', 'Commerce Support', 'Pacific Tesla Support', 'Roadside', 'Service Center'];
const labelsToKeepSet = new Set(labelsToKeep);

// Filter function
function filterDropdownOptions() {
  const dropdown = document.querySelector('#tcc-header-team-id');
  if (!dropdown) return;

  const optionList = dropdown.querySelector('div.tds-form-input');
  if (!optionList) return;

  Array.from(optionList.querySelectorAll('li')).forEach(item => {
    const label = item.getAttribute('data-tds-label');
    item.style.display = labelsToKeepSet.has(label) ? '' : 'none';
  });
}

// Reset visibility if filter is disabled
function resetDropdownVisibility() {
  const dropdown = document.querySelector('#tcc-header-team-id');
  if (!dropdown) return;

  const optionList = dropdown.querySelector('div.tds-form-input');
  if (!optionList) return;

  Array.from(optionList.querySelectorAll('li')).forEach(item => {
    item.style.display = '';
  });
}

// Apply filter if enabled
function applyFilter() {
  if (!window.chrome || !chrome.storage || !chrome.storage.sync) return;

  chrome.storage.sync.get({ teamsFilter: false }, (items) => {
    if (items.teamsFilter) {
      filterDropdownOptions();
    } else {
      resetDropdownVisibility();
    }
  });
}

// Throttled click handler
let clickTimeout = null;
document.addEventListener('click', () => {
  if (clickTimeout) clearTimeout(clickTimeout);
  clickTimeout = setTimeout(applyFilter, 100);
});

// Wait for dropdown to exist before running filter
function waitForDropdown() {
  if (window.top !== window.self) return; // Only run in top frame

  const dropdown = document.querySelector('#tcc-header-team-id');
  if (dropdown) {
    applyFilter();
  } else {
    setTimeout(waitForDropdown, 500); // Retry every 500ms
  }
}

// Start observing
waitForDropdown();
