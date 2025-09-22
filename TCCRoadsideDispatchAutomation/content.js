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
        } else {
            console.log('[Extension] Waiting for autocomplete option to appear...');
        }
    }, delay);
}

// -------------------------
// Main polling function
// -------------------------
function pollDropdowns() {
    const currentLocationInput = document.getElementById(currentLocationInputId);
    if (!currentLocationInput) return;

    const address = currentLocationInput.value.trim();
    console.log('[Extension] Current location input:', address);

    // Only proceed if address ends with "Australia"
    if (!address.endsWith('Australia')) {
        console.log('[Extension] Address is not in Australia. Skipping script.');
        return;
    }

    const firstDropdown = document.getElementById(firstDropdownId);
    if (!firstDropdown) return;

    const valueSpan = firstDropdown.querySelector('.mat-select-value-text .mat-select-min-line');
    if (!valueSpan) return;

    const currentValue = valueSpan.textContent.trim();
    if (currentValue !== lastFirstDropdownValue) {
        console.log(`[Extension] First dropdown value changed: "${currentValue}"`);
        lastFirstDropdownValue = currentValue;

        if (currentValue === 'Yes') {
            console.log('[Extension] Customer Keeping Damaged Wheel: Yes Triggered');

            // -------------------------
            // 1️⃣ Select Tesla Service Center in second dropdown
            // -------------------------
            const secondDropdown = document.querySelector(secondDropdownSelector);
            if (secondDropdown) {
                selectMatOption(secondDropdown, 'Tesla Service Center');
            } else {
                console.warn('[Extension] Second dropdown not found');
            }

            // -------------------------
            // 2️⃣ Wait for Service Center input and select Virtual Roadside
            // -------------------------
            waitForElement(serviceCenterInputSelector, (input) => {
                console.log(`[Extension] Typing "${serviceCenterSearchText}" to trigger autocomplete`);
                input.focus();
                input.value = serviceCenterSearchText;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                // Click the full option once it appears
                selectAutocompleteOption(serviceCenterFullOption);
            });
        }
    }
}

// Poll every 200ms to catch changes in Angular Material dropdowns
setInterval(pollDropdowns, 1000);
