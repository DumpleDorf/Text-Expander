console.log('[TCC QOL] AU dashboard filter script loaded');

const ROADSIDE_DASHBOARD_PATH = '/dashboard/roadsidedashboard';
const COUNTRY_STORAGE_KEY = 'roadsideCountryFilter';
const COUNTRY_OPTIONS = [
  { code: 'AU', label: 'Australia', matchers: [/^AU$/i, /^AU\b/i, /^Australia\b/i] },
  { code: 'NZ', label: 'New Zealand', matchers: [/^NZ$/i, /^NZ\b/i, /^New Zealand\b/i] }
];

let isActive = false;
let activeTimers = [];
let countdownRafId = null;
let tableObserver = null;
let searchApplied = false;
let filteringInProgress = false;
let suppressTableObserver = false;
let selectedCountryCode = 'AU';
let countdownStartTime = null;
let lastProcessedSignature = '';
const COUNTDOWN_TOTAL_SECONDS = 5 * 60;

function isTccQolEnabled(callback) {
  chrome.storage.sync.get({ tccQolEnabled: true, auFilterEnabled: true }, (items) => {
    const enabled = items.tccQolEnabled !== null && items.tccQolEnabled !== undefined
      ? items.tccQolEnabled
      : items.auFilterEnabled;
    callback(!!enabled);
  });
}

function getSelectedCountry() {
  return COUNTRY_OPTIONS.find((option) => option.code === selectedCountryCode) || COUNTRY_OPTIONS[0];
}

function loadSelectedCountry(callback) {
  chrome.storage.sync.get({ [COUNTRY_STORAGE_KEY]: 'AU' }, (items) => {
    const saved = items[COUNTRY_STORAGE_KEY];
    selectedCountryCode = COUNTRY_OPTIONS.some((option) => option.code === saved) ? saved : 'AU';
    callback(getSelectedCountry());
  });
}

function saveSelectedCountry(code) {
  selectedCountryCode = code;
  chrome.storage.sync.set({ [COUNTRY_STORAGE_KEY]: code });
}

function isOnRoadsideDashboard() {
  return location.pathname.toLowerCase().startsWith(ROADSIDE_DASHBOARD_PATH);
}

function trackInterval(fn, ms) {
  const id = setInterval(fn, ms);
  activeTimers.push(id);
  return id;
}

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function stopAuFilter() {
  activeTimers.forEach(clearInterval);
  activeTimers = [];
  if (countdownRafId) cancelAnimationFrame(countdownRafId);
  countdownRafId = null;
  if (tableObserver) {
    tableObserver.disconnect();
    tableObserver = null;
  }
  document.querySelector('#au-filter-toolbar')?.remove();
  isActive = false;
  searchApplied = false;
  filteringInProgress = false;
  suppressTableObserver = false;
  lastProcessedSignature = '';
  countdownStartTime = null;
  console.log('[AU Filter] Stopped');
}

function getHeaderLabel(th) {
  const button = th.querySelector('button.tds-th--inner');
  const source = button || th;
  const clone = source.cloneNode(true);
  clone.querySelectorAll('svg, tds-icon').forEach((el) => el.remove());
  return normalizeText(clone.textContent);
}

function findDashboardTable() {
  const headers = document.querySelectorAll('th.tds-data-th');
  for (const th of headers) {
    if (/^Country$/i.test(getHeaderLabel(th))) {
      return th.closest('table');
    }
  }
  return (
    document.querySelector('div.tcc-roadside-dashboard-table table') ||
    document.querySelector('table.tds-data-table') ||
    null
  );
}

function getHeaderCells(table) {
  if (!table) return [];
  const headerRow =
    table.querySelector('thead tr') ||
    [...table.querySelectorAll('tr')].find((row) => row.querySelector('th.tds-data-th'));
  if (!headerRow) return [];
  return [...headerRow.querySelectorAll('th')];
}

function getColumnIndex(table, headerMatcher) {
  return getHeaderCells(table).findIndex((th) => headerMatcher(getHeaderLabel(th)));
}

function getTableRows(table) {
  if (!table) return [];
  const bodyRows = [...table.querySelectorAll('tbody tr')].filter(
    (row) => !row.querySelector('th.tds-data-th button.tds-th--inner')
  );
  if (bodyRows.length) return bodyRows;
  return [...table.querySelectorAll('tr')].filter(
    (row) => !row.querySelector('th.tds-data-th button.tds-th--inner')
  );
}

function getRowCells(row) {
  return [...row.children].filter((el) => el.matches('th, td'));
}

function getCellRawText(cell) {
  if (!cell) return '';
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('svg, tds-icon, button').forEach((el) => el.remove());
  const text = normalizeText(clone.textContent);
  if (text) return text;

  const img = cell.querySelector('img[alt], img[title]');
  if (img) return normalizeText(img.alt || img.title);

  return normalizeText(
    cell.getAttribute('title') ||
    cell.getAttribute('aria-label') ||
    cell.querySelector('[title], [aria-label]')?.getAttribute('title') ||
    cell.querySelector('[aria-label]')?.getAttribute('aria-label') ||
    ''
  );
}

function getCellText(row, columnIndex) {
  if (columnIndex < 0) return '';
  return getCellRawText(getRowCells(row)[columnIndex]);
}

function matchesSelectedCountry(text) {
  const value = normalizeText(text);
  if (!value) return false;
  return getSelectedCountry().matchers.some((matcher) => matcher.test(value));
}

function parseEtaValue(text) {
  if (!text || text === '--') return -Infinity;
  const match = text.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : -Infinity;
}

function findStageField() {
  return (
    document.querySelector('div.tcc-dashboard-other-field:has(app-tcc-multi-select[label="Stage"])') ||
    document.querySelector('app-tcc-multi-select[label="Stage"]')?.closest('div.tcc-dashboard-other-field') ||
    [...document.querySelectorAll('label, .tds-form-label, span')].find((el) =>
      normalizeText(el.textContent) === 'Stage'
    )?.closest('div.tcc-dashboard-other-field, .tds-form-item, div') ||
    null
  );
}

function findDashboardSearchInput() {
  const scoped =
    document.querySelector('tds-form-input-search input.tds-form-input-search[placeholder="Search"]') ||
    document.querySelector('input.tds-form-input-search[placeholder="Search"]');
  if (scoped) return scoped;

  return [...document.querySelectorAll('input.tds-form-input-search')].find((input) =>
    /search/i.test(input.getAttribute('placeholder') || '')
  ) || null;
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
}

function clearSearchInput(input) {
  const clearBtn =
    input.closest('tds-form-input-search, .tds-form-input, .tds-tooltip-wrapper')
      ?.querySelector('.tds-form-input-search-clear button, tds-icon-button button, button.tds-icon-btn');

  if (clearBtn && input.value) {
    clearBtn.click();
    return true;
  }

  setNativeInputValue(input, '');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return false;
}

async function typeSearchValue(input, value) {
  if (!input) return;

  input.focus();
  const usedClearButton = clearSearchInput(input);
  if (usedClearButton || input.value !== value) {
    await new Promise((r) => setTimeout(r, 120));
  }

  setNativeInputValue(input, value);
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    composed: true,
    data: value,
    inputType: 'insertText'
  }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));

  // Retry once if Angular ignored the first write
  if (normalizeText(input.value) !== value) {
    await new Promise((r) => setTimeout(r, 80));
    setNativeInputValue(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  console.log('[AU Filter] Search bar set to', JSON.stringify(input.value));
}

function getRowSignature(table) {
  const rows = getTableRows(table);
  if (!rows.length) return `0`;
  const countryIdx = getColumnIndex(table, (label) => /^Country$/i.test(label));
  const sample = rows.slice(0, 5).map((row) => getCellText(row, countryIdx)).join('|');
  return `${rows.length}:${sample}`;
}

function waitForTableUpdate(previousSignature, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = trackInterval(() => {
      const table = findDashboardTable();
      const signature = getRowSignature(table);
      const rows = getTableRows(table);
      const elapsed = Date.now() - started;

      if (signature !== previousSignature) {
        clearInterval(poll);
        console.log('[AU Filter] Table updated after search', `(${rows.length} rows)`);
        resolve(true);
        return;
      }

      if (elapsed >= timeoutMs) {
        clearInterval(poll);
        console.log('[AU Filter] Search wait timed out — continuing with current rows');
        resolve(false);
      }
    }, 250);
  });
}

function withTableMutationsPaused(fn) {
  suppressTableObserver = true;
  try {
    return fn();
  } finally {
    setTimeout(() => {
      suppressTableObserver = false;
    }, 100);
  }
}

function deleteNonMatchingCountryRows() {
  const table = findDashboardTable();
  const countryIdx = getColumnIndex(table, (label) => /^Country$/i.test(label));
  if (!table || countryIdx < 0) return 0;

  const rows = getTableRows(table);
  const country = getSelectedCountry();
  const toRemove = rows.filter((row) => !matchesSelectedCountry(getCellText(row, countryIdx)));
  if (!toRemove.length) return rows.length;

  toRemove.forEach((row) => row.remove());

  const kept = rows.length - toRemove.length;
  console.log(`[AU Filter] Kept ${kept} ${country.code} rows, deleted ${toRemove.length} other rows`);
  return kept;
}

function sortByEtaDescending() {
  const table = findDashboardTable();
  if (!table) return false;

  const etaIdx = getColumnIndex(table, (label) => /^ETA\b/i.test(label));
  const tbody = table.querySelector('tbody') || table;
  const rows = getTableRows(table);
  if (etaIdx < 0 || rows.length < 2) return false;

  const sorted = [...rows].sort(
    (a, b) => parseEtaValue(getCellText(b, etaIdx)) - parseEtaValue(getCellText(a, etaIdx))
  );
  const alreadySorted = rows.every((row, i) => row === sorted[i]);
  if (alreadySorted) return false;

  sorted.forEach((row) => tbody.appendChild(row));
  console.log('[AU Filter] Sorted by ETA (mins) descending');
  return true;
}

function applyRowCleanup() {
  if (filteringInProgress || suppressTableObserver) return;

  const table = findDashboardTable();
  const signature = getRowSignature(table);
  if (signature === lastProcessedSignature) return;

  withTableMutationsPaused(() => {
    deleteNonMatchingCountryRows();
    sortByEtaDescending();
  });
  lastProcessedSignature = getRowSignature(findDashboardTable());
}

function getActiveJobCount() {
  return getTableRows(findDashboardTable()).length;
}

function injectToolbarStyles() {
  let style = document.getElementById('au-filter-toolbar-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'au-filter-toolbar-styles';
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = `
    #au-filter-toolbar {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    #au-country-filter {
      min-width: 200px;
      font-family: inherit;
    }
    #au-country-filter .au-filter-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #8e8e8e;
      margin-bottom: 8px;
    }
    #au-country-filter .au-filter-input-shell {
      display: flex;
      align-items: center;
      min-height: 40px;
      border: none;
      border-radius: 4px;
      background: #eee;
      padding: 0 12px;
      box-sizing: border-box;
      box-shadow: none;
    }
    #au-country-filter .au-filter-input-shell:hover {
      background: #e5e5e5;
    }
    #au-country-filter .au-filter-input-shell:focus-within {
      border: none;
      box-shadow: none;
      outline: none;
      background: #eee;
    }
    #au-country-filter select {
      width: 100%;
      border: none;
      outline: none;
      box-shadow: none;
      background: transparent;
      font-size: 14px;
      line-height: 20px;
      color: #393c41;
      font-family: inherit;
      padding: 10px 20px 10px 0;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%235c5e62' d='M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right center;
      cursor: pointer;
    }
    #au-country-filter select:focus {
      outline: none;
      box-shadow: none;
    }
    #au-country-filter select option {
      background: #fff;
      color: #393c41;
    }
    #au-job-count-wrapper {
      display: flex;
      align-items: center;
      gap: 20px;
    }
  `;
}

function startCountdownTimer() {
  if (countdownRafId) cancelAnimationFrame(countdownRafId);
  countdownStartTime = performance.now();

  const countdownNumber = document.querySelector('#au-countdown-number');
  const progressBar = document.querySelector('#au-countdown-progress');
  if (!countdownNumber || !progressBar) return;

  function update() {
    const elapsed = (performance.now() - countdownStartTime) / 1000;
    const remainingSeconds = Math.max(COUNTDOWN_TOTAL_SECONDS - elapsed, 0);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    countdownNumber.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    progressBar.style.width = `${(remainingSeconds / COUNTDOWN_TOTAL_SECONDS) * 100}%`;

    if (remainingSeconds > 0) {
      countdownRafId = requestAnimationFrame(update);
    } else {
      window.location.reload();
    }
  }

  countdownRafId = requestAnimationFrame(update);
}

async function onCountryChanged(code) {
  console.log('[AU Filter] Country changed to', code);
  saveSelectedCountry(code);
  searchApplied = false;
  lastProcessedSignature = '';
  startCountdownTimer();

  // Pause observer while country switch rewrites the table
  suppressTableObserver = true;
  filteringInProgress = false;

  try {
    const searchInput = findDashboardSearchInput();
    if (searchInput) {
      await typeSearchValue(searchInput, code);
    }
    await runFilterPipeline(true);
  } finally {
    setTimeout(() => {
      suppressTableObserver = false;
      lastProcessedSignature = getRowSignature(findDashboardTable());
    }, 500);
  }
}

function injectToolbar(stageField) {
  if (document.querySelector('#au-filter-toolbar')) return;

  injectToolbarStyles();

  const toolbar = document.createElement('div');
  toolbar.id = 'au-filter-toolbar';

  const countryFilter = document.createElement('div');
  countryFilter.id = 'au-country-filter';

  const countryLabel = document.createElement('label');
  countryLabel.className = 'au-filter-label';
  countryLabel.setAttribute('for', 'au-country-select');
  countryLabel.textContent = 'Country';
  countryFilter.appendChild(countryLabel);

  const shell = document.createElement('div');
  shell.className = 'au-filter-input-shell';

  const select = document.createElement('select');
  select.id = 'au-country-select';
  select.setAttribute('aria-label', 'Country filter');
  COUNTRY_OPTIONS.forEach((option) => {
    const el = document.createElement('option');
    el.value = option.code;
    el.textContent = option.label;
    if (option.code === selectedCountryCode) el.selected = true;
    select.appendChild(el);
  });
  select.addEventListener('change', () => onCountryChanged(select.value));
  shell.appendChild(select);
  countryFilter.appendChild(shell);
  toolbar.appendChild(countryFilter);

  const jobCountWrapper = document.createElement('div');
  jobCountWrapper.id = 'au-job-count-wrapper';

  const jobCountLabel = document.createElement('span');
  jobCountLabel.id = 'au-job-count-label';
  jobCountLabel.style.fontSize = '12px';
  jobCountLabel.style.color = '#666';
  jobCountLabel.innerHTML = `Current Active Dispatches: <span style="font-weight: 800;">${getActiveJobCount()}</span>`;
  jobCountWrapper.appendChild(jobCountLabel);

  const countdownContainer = document.createElement('div');
  countdownContainer.id = 'au-countdown-container';
  countdownContainer.style.display = 'flex';
  countdownContainer.style.flexDirection = 'column';
  countdownContainer.style.minWidth = '200px';

  const label = document.createElement('div');
  label.style.fontSize = '12px';
  label.style.color = '#666';
  label.textContent = 'Time till refresh: ';

  const countdownNumber = document.createElement('span');
  countdownNumber.id = 'au-countdown-number';
  countdownNumber.style.marginLeft = '5px';
  countdownNumber.textContent = '5:00';
  label.appendChild(countdownNumber);
  countdownContainer.appendChild(label);

  const progressWrapper = document.createElement('div');
  progressWrapper.style.width = '100%';
  progressWrapper.style.height = '16px';
  progressWrapper.style.background = '#e0e0e0';
  progressWrapper.style.borderRadius = '8px';
  progressWrapper.style.overflow = 'hidden';
  progressWrapper.style.marginTop = '6px';
  countdownContainer.appendChild(progressWrapper);

  const progressBar = document.createElement('div');
  progressBar.id = 'au-countdown-progress';
  progressBar.style.height = '100%';
  progressBar.style.width = '100%';
  progressBar.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
  progressBar.style.borderRadius = '8px';
  progressWrapper.appendChild(progressBar);

  jobCountWrapper.appendChild(countdownContainer);
  toolbar.appendChild(jobCountWrapper);

  const insertParent = stageField.parentNode || stageField;
  insertParent.insertBefore(toolbar, stageField.nextSibling);

  trackInterval(() => {
    const labelEl = document.querySelector('#au-job-count-label');
    if (labelEl) {
      labelEl.innerHTML = `Current Active Dispatches: <span style="font-weight: 800;">${getActiveJobCount()}</span>`;
    }
  }, 1000);

  startCountdownTimer();
}

async function runFilterPipeline(forceSearch = false) {
  if (filteringInProgress && !forceSearch) return;
  filteringInProgress = true;

  try {
    const searchInput = findDashboardSearchInput();
    const table = findDashboardTable();
    const country = getSelectedCountry();
    let rows = getTableRows(table);

    if (!searchInput || !table) {
      return false;
    }

    const beforeSignature = getRowSignature(table);
    const needsSearch = forceSearch || !searchApplied || normalizeText(searchInput.value) !== country.code;

    if (needsSearch) {
      console.log(`[AU Filter] Typing ${country.code} into search bar`);
      await typeSearchValue(searchInput, country.code);
      searchApplied = true;
      await waitForTableUpdate(beforeSignature);
      rows = getTableRows(findDashboardTable());
    }

    if (!rows.length) {
      console.log('[AU Filter] No rows yet after search — will retry');
      return false;
    }

    withTableMutationsPaused(() => {
      deleteNonMatchingCountryRows();
      sortByEtaDescending();
    });
    lastProcessedSignature = getRowSignature(findDashboardTable());

    const stageField = findStageField();
    if (stageField) injectToolbar(stageField);

    return true;
  } catch (err) {
    console.warn('[AU Filter] Pipeline error:', err);
    return false;
  } finally {
    filteringInProgress = false;
  }
}

function auFilter() {
  console.log('[AU Filter] Script activated');

  loadSelectedCountry(() => {
    const bootInterval = trackInterval(async () => {
      const ready = await runFilterPipeline();
      if (!ready) return;

      clearInterval(bootInterval);
      console.log('[AU Filter] Initial pipeline complete for', getSelectedCountry().code);

      const table = findDashboardTable();
      const tbody = table?.querySelector('tbody') || table;
      if (tbody && !tableObserver) {
        let debounce = null;
        tableObserver = new MutationObserver((mutations) => {
          if (suppressTableObserver || filteringInProgress) return;

          // Only react to rows being added/removed — ignore class/style flash updates
          const rowStructureChanged = mutations.some((mutation) => {
            if (mutation.type !== 'childList') return false;
            return [...mutation.addedNodes, ...mutation.removedNodes].some(
              (node) => node.nodeType === 1 && (node.matches?.('tr') || node.querySelector?.('tr'))
            );
          });
          if (!rowStructureChanged) return;

          clearTimeout(debounce);
          debounce = setTimeout(applyRowCleanup, 400);
        });
        tableObserver.observe(tbody, { childList: true, subtree: false });
      }

      // Light recovery if Angular clears the search value; avoid constant re-pipelines
      trackInterval(() => {
        if (filteringInProgress || suppressTableObserver) return;
        const searchInput = findDashboardSearchInput();
        const country = getSelectedCountry();
        if (searchInput && normalizeText(searchInput.value) !== country.code) {
          searchApplied = false;
          runFilterPipeline(true);
        }
      }, 10000);
    }, 500);
  });
}

function maybeActivate() {
  if (!isOnRoadsideDashboard()) {
    if (isActive) stopAuFilter();
    return;
  }
  if (isActive) return;

  isTccQolEnabled((enabled) => {
    if (!isOnRoadsideDashboard() || isActive) return;

    if (enabled) {
      isActive = true;
      console.log('[AU Filter] Enabled — running filter');
      auFilter();
    } else {
      console.log('[AU Filter] Disabled — not running');
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  if ('tccQolEnabled' in changes || 'auFilterEnabled' in changes) {
    const enabled = 'tccQolEnabled' in changes
      ? changes.tccQolEnabled.newValue
      : changes.auFilterEnabled.newValue;

    if (enabled) {
      maybeActivate();
    } else if (isActive) {
      stopAuFilter();
    }
  }
});

let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    maybeActivate();
  }
}, 1000);

maybeActivate();
