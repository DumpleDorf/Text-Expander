console.log('[Extension] Content script loaded');

// -------------------------
// Configuration
// -------------------------
const firstDropdownId = 'tcc-svctemplate-roadsideForm-CustomerKeepingDamagedTire';
const secondDropdownSelector = 'mat-select[formcontrolname="destinationLocationType"]';
const serviceCenterInputSelector = 'input[formcontrolname="destinationServiceCenter"]';
const serviceCenterFullOption = 'Virtual Roadside Australia - ( AP-AU-Australia-Tesla Roadside )';
const serviceCenterSearchText = 'Virtual Roadside';
const currentLocationInputId = 'autocompleteCurrentLocationAddress0';

let lastFirstDropdownValue = null;
let addressPollingInterval = null;

// TODO: REPLACE WITH BETTER LOGIC - MAYBE A POPUP INSTEAD

// -------------------------
// Helper: select mat-select option
// -------------------------
function selectMatOption(dropdown, optionText) {
    if (!dropdown) {
        console.warn('[Extension] Dropdown not found');
        return;
    }

    console.log(`[Extension] Opening dropdown ${dropdown.id || dropdown} to select "${optionText}"`);
    dropdown.click();

    setTimeout(() => {
        const options = Array.from(document.querySelectorAll('mat-option .mat-option-text'));
        console.log('[Extension] Found mat-select options:', options.map(o => o.textContent.trim()));

        const targetOption = options.find(o => o.textContent.trim() === optionText);
        if (targetOption) {
            targetOption.click();
            console.log(`[Extension] Selected mat-select option "${optionText}"`);
        } else {
            console.warn(`[Extension] Option "${optionText}" not found`);
        }
    }, 100);
}

// -------------------------
// Helper: wait for element
// -------------------------
function waitForElement(selector, callback, retries = 20, delay = 200) {
    let attempt = 0;
    const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
            clearInterval(interval);
            callback(el);
        } else if (++attempt >= retries) {
            clearInterval(interval);
            console.warn(`[Extension] Element "${selector}" never appeared`);
        }
    }, delay);
}

// -------------------------
// Helper: click autocomplete option once it appears
// -------------------------
function selectAutocompleteOption(optionText, retries = 30, delay = 200) {
    let attempt = 0;
    const interval = setInterval(() => {
        const option = Array.from(document.querySelectorAll('mat-option .mat-option-text'))
            .find(el => el.textContent.trim().replace(/\s+/g, ' ') === optionText.replace(/\s+/g, ' '));

        if (option) {
            console.log('[Extension] Clicking autocomplete option:', option.textContent.trim());
            option.click();
            clearInterval(interval);
        } else if (++attempt >= retries) {
            clearInterval(interval);
            console.warn('[Extension] Autocomplete option not found:', optionText);
        }
    }, delay);
}

// -------------------------
// Poll the address field until Australia, New Zealand, AU, or NZ is detected
// -------------------------
function startAddressPolling() {
    if (addressPollingInterval) return;

    addressPollingInterval = setInterval(() => {
        const currentLocationInput = document.getElementById(currentLocationInputId);
        if (!currentLocationInput) return;

        const address = currentLocationInput.value.trim();
        if (!address) return;

        console.log('[Extension] Current location input:', address);

        if (
            address.endsWith('Australia') || address.endsWith('AU') ||
            address.endsWith('New Zealand') || address.endsWith('NZ')
        ) {
            clearInterval(addressPollingInterval);
            addressPollingInterval = null;
            console.log('[Extension] Address detected. Stopping address polling.');

            const firstDropdown = document.getElementById(firstDropdownId);
            const valueSpan = firstDropdown?.querySelector('.mat-select-value-text .mat-select-min-line');
            const firstDropdownValue = valueSpan?.textContent.trim();

            if ((address.endsWith('Australia') || address.endsWith('AU')) && firstDropdownValue === 'Yes') {
                executeAutomation();
                copyWarrantyInline();
            }
        }
    }, 500);
}

// -------------------------
// Observe changes to the address input to restart polling
// -------------------------
function observeInputChanges() {
    const input = document.getElementById(currentLocationInputId);
    if (!input) return;

    input.addEventListener('input', () => {
        console.log('[Extension] Current location input changed. Restarting address polling...');
        startAddressPolling();
    });
}

// -------------------------
// Poll first dropdown continuously
// -------------------------
function pollFirstDropdown() {
    const firstDropdown = document.getElementById(firstDropdownId);
    if (!firstDropdown) return;

    const valueSpan = firstDropdown.querySelector('.mat-select-value-text .mat-select-min-line');
    if (!valueSpan) return;

    const currentValue = valueSpan.textContent.trim();
    if (currentValue !== lastFirstDropdownValue) {
        console.log(`[Extension] First dropdown value changed: "${currentValue}"`);
        lastFirstDropdownValue = currentValue;

        const currentLocationInput = document.getElementById(currentLocationInputId);
        const address = currentLocationInput?.value.trim();

        if (
            (address?.endsWith('Australia') || address?.endsWith('AU')) &&
            currentValue === 'Yes'
        ) {
            executeAutomation();
        }
    }
}

// -------------------------
// Execute the automation logic
// -------------------------
function executeAutomation() {
    console.log('[Extension] Executing automation for Australia address');

    const secondDropdown = document.querySelector(secondDropdownSelector);
    if (secondDropdown) {
        selectMatOption(secondDropdown, 'Tesla Service Center');
    } else {
        console.warn('[Extension] Second dropdown not found');
    }

    waitForElement(serviceCenterInputSelector, (input) => {
        console.log(`[Extension] Typing "${serviceCenterSearchText}" to trigger autocomplete`);
        input.focus();
        input.value = serviceCenterSearchText;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        selectAutocompleteOption(serviceCenterFullOption);
    });
}

// -------------------------
// Copy warranty elements inline (BAT, DU, VEH)
// -------------------------
function addWarrantyBadgesInline() {
    const header = Array.from(document.querySelectorAll('div.padding-top-10 h1.mat-h3'))
        .find(h => h.textContent.trim() === 'Payment Details');
    if (!header) return;

    const container = header.parentElement;
    if (container.querySelector('.inline-warranty-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'inline-warranty-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '2px';
    wrapper.style.alignItems = 'center';
    wrapper.style.marginLeft = '20px';
    wrapper.style.paddingTop = '5px';

    // Grab all visible badges (skip ones with status--hide)
    const badgeWrappers = Array.from(document.querySelectorAll('.tds-tooltip-wrapper--inline'))
        .filter(wrapper => {
            const label = wrapper.querySelector('label.tcc-warranty-details-badge-text');
            return label && !label.classList.contains('status--hide');
        });

    badgeWrappers.forEach(tooltipWrapper => {
        const clone = tooltipWrapper.cloneNode(true);
        clone.style.display = 'inline-flex';
        clone.style.paddingTop = '5px'; // consistent spacing
        wrapper.appendChild(clone);
    });

    if (wrapper.childNodes.length) {
        container.appendChild(wrapper);
        console.log('[Extension] All visible warranty badges added inline with Payment Details');
    }
}

// Run every 5 seconds indefinitely
setInterval(addWarrantyBadgesInline, 5000);

// -------------------------
// Initialize
// -------------------------
startAddressPolling();
setInterval(pollFirstDropdown, 1000);

const bodyObserver = new MutationObserver(() => {
    const input = document.getElementById(currentLocationInputId);
    if (input) {
        observeInputChanges();
        bodyObserver.disconnect();
    }
});
bodyObserver.observe(document.body, { childList: true, subtree: true });