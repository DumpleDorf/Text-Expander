console.log("TeamsFilter script loaded.");

// Function to filter the dropdown options
function filterDropdownOptions() {

    // Find the dropdown element by its id
    const dropdown = document.querySelector('#tcc-header-team-id');
    if (dropdown) {

        // Define the list of labels to keep
        // hardcoded - is probably best to update this eventually
        const labelsToKeep = ['Charging Support', 'Commerce Support', 'Pacific Tesla Support', 'Roadside', 'Service Center']; 
        const labelsToKeepSet = new Set(labelsToKeep);

        // Find the dropdown options within the dropdown element
        const optionList = dropdown.querySelector('div.tds-form-input');
        if (optionList) {
            Array.from(optionList.querySelectorAll('li')).forEach((item) => {
                const label = item.getAttribute('data-tds-label');
                if (!labelsToKeepSet.has(label)) {
                    // Hide items not in the list
                    item.style.display = 'none'; // Hide the item
                }
            });
        }
    } else {
        console.log("TeamsFilter: Dropdown not found.");
    }
}

// Check the setting and run the filtering function only if enabled
function handlePageClick() {
    chrome.storage.sync.get({ teamsFilter: false }, (items) => {
        if (items.teamsFilter) {
            filterDropdownOptions();
        }
    });
}

// Throttle click handling to avoid frequent execution
let clickTimeout = null;
document.addEventListener('click', () => {
    if (clickTimeout) clearTimeout(clickTimeout);
    clickTimeout = setTimeout(handlePageClick, 100); // Throttle to 100ms
});
