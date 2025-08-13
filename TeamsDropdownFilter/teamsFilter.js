console.log("TeamsFilter script loaded.");

function filterDropdownOptions() {
  const dropdown = document.querySelector('#tcc-header-team-id');
  if (dropdown) {
    const labelsToKeep = ['Charging Support', 'Commerce Support', 'Pacific Tesla Support', 'Roadside', 'Service Center'];
    const labelsToKeepSet = new Set(labelsToKeep);

    const optionList = dropdown.querySelector('div.tds-form-input');
    if (optionList) {
      Array.from(optionList.querySelectorAll('li')).forEach((item) => {
        const label = item.getAttribute('data-tds-label');
        if (!labelsToKeepSet.has(label)) {
          item.style.display = 'none';
        }
      });
    }
  } else {
    console.log("TeamsFilter: Dropdown not found.");
  }
}

// Check the setting before running the filter
function handlePageClick() {
  chrome.storage.sync.get({ teamsFilter: false }, (items) => {
    if (items.teamsFilter) {
      filterDropdownOptions();
    } else {
      // Optional: If disabled, you might want to reset visibility for all options if needed
      resetDropdownVisibility();
    }
  });
}

// Optional helper to reset visibility if filter disabled
function resetDropdownVisibility() {
  const dropdown = document.querySelector('#tcc-header-team-id');
  if (dropdown) {
    const optionList = dropdown.querySelector('div.tds-form-input');
    if (optionList) {
      Array.from(optionList.querySelectorAll('li')).forEach((item) => {
        item.style.display = ''; // Reset to default
      });
    }
  }
}

// Throttle clicks
let clickTimeout = null;
document.addEventListener('click', () => {
  if (clickTimeout) clearTimeout(clickTimeout);
  clickTimeout = setTimeout(handlePageClick, 100);
});

// Run once on load if enabled
handlePageClick();
