console.log('[TCC QOL] AU dashboard filter script loaded');

const ROADSIDE_DASHBOARD_PATH = '/dashboard/roadsidedashboard';
const COUNTRY_STORAGE_KEY = 'roadsideCountryFilter';
const COUNTRY_OPTIONS = [
  { code: 'AU', label: 'Australia', matchers: [/^AU$/i, /^AU\b/i, /^Australia\b/i] },
  { code: 'NZ', label: 'New Zealand', matchers: [/^NZ$/i, /^NZ\b/i, /^New Zealand\b/i] }
];

let isActive = false;
let activeTimers = [];
let countdownTimerId = null;
let tableObserver = null;
let searchApplied = false;
let filteringInProgress = false;
let suppressTableObserver = false;
let selectedCountryCode = 'AU';
let countdownStartTime = null;
let lastProcessedSignature = '';
let activatedAt = 0;
let allowSearchTyping = true;
let lastSearchTouchAt = 0;
let lastJobCount = -1;
const COUNTDOWN_TOTAL_SECONDS = 5 * 60;
// Give TCC time to finish boot / version-modal checks before we touch inputs
const BOOT_QUIET_MS = 6000;
const MODAL_CLEAR_MS = 2000;
const HIDDEN_ROW_CLASS = 'au-filter-hidden';

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
  const path = location.pathname.toLowerCase();
  return path.includes('roadsidedashboard') || path.startsWith(ROADSIDE_DASHBOARD_PATH);
}

function isTccModalOpen() {
  return !!document.querySelector('dialog.tds-modal[open], dialog[open].tds-modal');
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
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
  if (tableObserver) {
    tableObserver.disconnect();
    tableObserver = null;
  }
  document.querySelector('#au-filter-toolbar')?.remove();
  restoreAllCountryRows();
  isActive = false;
  searchApplied = false;
  filteringInProgress = false;
  suppressTableObserver = false;
  lastProcessedSignature = '';
  countdownStartTime = null;
  activatedAt = 0;
  allowSearchTyping = true;
  lastSearchTouchAt = 0;
  lastJobCount = -1;
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
    document.querySelector('.tcc-roadside-dashboard table.tds-data-table') ||
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

// Hot path for row filtering — avoid cloneNode on every cell
function getCellTextFast(row, columnIndex) {
  if (columnIndex < 0) return '';
  const cell = getRowCells(row)[columnIndex];
  if (!cell) return '';
  return normalizeText(cell.textContent);
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

// Never type into the header team dropdown / transfer team search / modals.
// A global querySelector('input[placeholder=Search]') previously matched the
// header team combobox first, which reset the selected team and forced TCC's
// "Customer Connect Updated" modal on every refresh.
function isForbiddenSearchInput(input) {
  if (!input || !(input instanceof Element)) return true;

  if (
    input.closest?.(
      '#tcc-header-team-id, [id="tcc-header-team-id"], ' +
      '#search-team, [id="search-team"], ' +
      'dialog.tds-modal, dialog, tds-modal, ' +
      'header, .tcc-header, app-tcc-header, .tds-site-header'
    )
  ) {
    return true;
  }

  if (input.id === 'search-team') return true;
  if (input.getAttribute('aria-controls')?.includes('tcc-header-team')) return true;

  return false;
}

function isDashboardSearchCandidate(input) {
  if (isForbiddenSearchInput(input)) return false;
  if (!/search/i.test(input.getAttribute('placeholder') || '')) return false;
  return true;
}

function findDashboardSearchInput() {
  const stageField = findStageField();
  const table = findDashboardTable();
  const scopes = [
    stageField?.parentElement,
    stageField?.closest?.('.tcc-dashboard-filters, .tcc-dashboard, .tcc-roadside-dashboard, form, section'),
    table?.closest?.('.tcc-roadside-dashboard, .tcc-dashboard, .tcc-roadside-dashboard-table, section, main'),
    document.querySelector('.tcc-roadside-dashboard, .tcc-roadside-dashboard-table, div.tcc-dashboard')
  ].filter(Boolean);

  const selector =
    'tds-form-input-search input.tds-form-input-search[placeholder="Search"], ' +
    'input.tds-form-input-search[placeholder="Search"]';

  for (const scope of scopes) {
    const match = [...scope.querySelectorAll(selector)].find(isDashboardSearchCandidate);
    if (match) return match;
  }

  // Last resort: first non-header Search input (still excludes team dropdown)
  return [...document.querySelectorAll(
    `${selector}, input.tds-form-input-search`
  )].find(isDashboardSearchCandidate) || null;
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
}

function describeSearchInput(input) {
  if (!input) return 'null';
  const host = input.closest('tds-form-input-search, .tds-form-item, #tcc-header-team-id') || input.parentElement;
  return {
    id: input.id || '',
    placeholder: input.getAttribute('placeholder') || '',
    hostTag: host?.tagName || '',
    hostClass: host?.className || '',
    inHeaderTeam: !!input.closest('#tcc-header-team-id')
  };
}

// Gentle write only — no focus(), no clear-button clicks, no Enter.
// Those were opening TCC's version modal during page boot.
async function typeSearchValue(input, value) {
  if (!input || !allowSearchTyping) return false;

  if (isForbiddenSearchInput(input) || !isDashboardSearchCandidate(input)) {
    console.error('[AU Filter] Refusing to type into non-dashboard search input', describeSearchInput(input));
    return false;
  }

  if (normalizeText(input.value) === value) {
    console.log('[AU Filter] Dashboard search already', JSON.stringify(value));
    return true;
  }

  console.log('[AU Filter] Gently setting dashboard search', describeSearchInput(input), '→', value);
  lastSearchTouchAt = Date.now();

  setNativeInputValue(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  await new Promise((r) => setTimeout(r, 50));

  // If our typing caused the version modal, disable further search writes this session
  if (isTccModalOpen()) {
    allowSearchTyping = false;
    console.warn('[AU Filter] TCC modal opened after search write — disabling search typing for this page load');
    return false;
  }

  console.log('[AU Filter] Dashboard search set to', JSON.stringify(input.value));
  return normalizeText(input.value) === value;
}

function modalOpenedAfterSearchTouch() {
  return isTccModalOpen() && lastSearchTouchAt > 0 && Date.now() - lastSearchTouchAt < 5000;
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

// Hide instead of removing nodes — deleting rows can scramble Angular state
// (header team selection / version dialog) across TCC.
function hideNonMatchingCountryRows() {
  const table = findDashboardTable();
  const countryIdx = getColumnIndex(table, (label) => /^Country$/i.test(label));
  if (!table || countryIdx < 0) return 0;

  const rows = getTableRows(table);
  const country = getSelectedCountry();
  let kept = 0;
  let hidden = 0;
  let changed = 0;

  for (const row of rows) {
    const match = matchesSelectedCountry(getCellTextFast(row, countryIdx));
    const isHidden = row.classList.contains(HIDDEN_ROW_CLASS);
    if (match) {
      if (isHidden) {
        row.classList.remove(HIDDEN_ROW_CLASS);
        changed++;
      }
      kept++;
    } else {
      if (!isHidden) {
        row.classList.add(HIDDEN_ROW_CLASS);
        changed++;
      }
      hidden++;
    }
  }

  if (changed) {
    console.log(`[AU Filter] Showing ${kept} ${country.code} rows, hid ${hidden} other rows`);
  }
  return kept;
}

function restoreAllCountryRows() {
  getTableRows(findDashboardTable()).forEach((row) => {
    row.classList.remove(HIDDEN_ROW_CLASS);
    if (row.style.display === 'none') row.style.display = '';
  });
}

function sortByEtaDescending() {
  const table = findDashboardTable();
  if (!table) return false;

  const etaIdx = getColumnIndex(table, (label) => /^ETA\b/i.test(label));
  const tbody = table.querySelector('tbody') || table;
  const rows = getTableRows(table).filter((row) => !row.classList.contains(HIDDEN_ROW_CLASS));
  if (etaIdx < 0 || rows.length < 2) return false;

  const sorted = [...rows].sort(
    (a, b) => parseEtaValue(getCellTextFast(b, etaIdx)) - parseEtaValue(getCellTextFast(a, etaIdx))
  );
  const alreadySorted = rows.every((row, i) => row === sorted[i]);
  if (alreadySorted) return false;

  // Single batch reflow
  const frag = document.createDocumentFragment();
  sorted.forEach((row) => frag.appendChild(row));
  tbody.appendChild(frag);
  console.log('[AU Filter] Sorted by ETA (mins) descending');
  return true;
}

function applyRowCleanup() {
  if (filteringInProgress || suppressTableObserver || isTccModalOpen()) return;

  const table = findDashboardTable();
  const signature = getRowSignature(table);
  if (signature === lastProcessedSignature) return;

  withTableMutationsPaused(() => {
    hideNonMatchingCountryRows();
    sortByEtaDescending();
  });
  lastProcessedSignature = getRowSignature(findDashboardTable());
}

function getActiveJobCount() {
  return getTableRows(findDashboardTable()).filter(
    (row) => !row.classList.contains(HIDDEN_ROW_CLASS) && row.style.display !== 'none'
  ).length;
}

function updateJobCountLabel() {
  const labelEl = document.querySelector('#au-job-count-label');
  if (!labelEl) return;
  const count = getActiveJobCount();
  if (count === lastJobCount) return;
  lastJobCount = count;
  labelEl.textContent = '';
  labelEl.append('Current Active Dispatches: ');
  const strong = document.createElement('span');
  strong.style.fontWeight = '800';
  strong.textContent = String(count);
  labelEl.appendChild(strong);
}

function injectToolbarStyles() {
  let style = document.getElementById('au-filter-toolbar-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'au-filter-toolbar-styles';
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = `
    tr.${HIDDEN_ROW_CLASS} {
      display: none !important;
    }
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
  // Once per second — NOT requestAnimationFrame. RAF was updating the DOM
  // 60x/sec and made scrolling/hover feel laggy across the whole page.
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
  countdownStartTime = performance.now();

  const countdownNumber = document.querySelector('#au-countdown-number');
  const progressBar = document.querySelector('#au-countdown-progress');
  if (!countdownNumber || !progressBar) return;

  function update() {
    const elapsed = (performance.now() - countdownStartTime) / 1000;
    const remainingSeconds = Math.max(COUNTDOWN_TOTAL_SECONDS - elapsed, 0);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (countdownNumber.textContent !== label) {
      countdownNumber.textContent = label;
    }
    const width = `${(remainingSeconds / COUNTDOWN_TOTAL_SECONDS) * 100}%`;
    if (progressBar.style.width !== width) {
      progressBar.style.width = width;
    }

    if (remainingSeconds <= 0) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      window.location.reload();
    }
  }

  update();
  countdownTimerId = setInterval(update, 1000);
}

async function onCountryChanged(code) {
  if (isTccModalOpen()) {
    console.log('[AU Filter] Ignoring country change while TCC modal is open');
    return;
  }

  console.log('[AU Filter] Country changed to', code);
  saveSelectedCountry(code);
  searchApplied = false;
  lastProcessedSignature = '';
  // User-initiated — allow a search attempt again
  allowSearchTyping = true;
  startCountdownTimer();

  suppressTableObserver = true;
  filteringInProgress = false;

  try {
    await runFilterPipeline({ forceSearch: true, allowSearch: true });
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
  jobCountWrapper.appendChild(jobCountLabel);
  lastJobCount = -1;
  updateJobCountLabel();

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

  // Cheap: only rewrite the label when the count actually changes
  trackInterval(updateJobCountLabel, 5000);

  startCountdownTimer();
}

function applyClientSideCleanup() {
  const table = findDashboardTable();
  if (!table || !getTableRows(table).length) return false;

  withTableMutationsPaused(() => {
    hideNonMatchingCountryRows();
    sortByEtaDescending();
  });
  lastProcessedSignature = getRowSignature(findDashboardTable());
  return true;
}

async function runFilterPipeline({ forceSearch = false, allowSearch = true } = {}) {
  if (filteringInProgress && !forceSearch) return false;
  if (isTccModalOpen()) return false;

  filteringInProgress = true;

  try {
    const table = findDashboardTable();
    const stageField = findStageField();
    const country = getSelectedCountry();

    if (!table) return false;
    if (stageField) injectToolbar(stageField);

    const searchInput = findDashboardSearchInput();
    const canSearch =
      allowSearch &&
      allowSearchTyping &&
      searchInput &&
      !isForbiddenSearchInput(searchInput);

    const needsSearch =
      canSearch &&
      (forceSearch || !searchApplied || normalizeText(searchInput.value) !== country.code);

    if (needsSearch) {
      // Quiet period: never touch search until TCC has finished booting
      if (Date.now() - activatedAt < BOOT_QUIET_MS) {
        console.log('[AU Filter] Quiet period — client-side cleanup only');
        return applyClientSideCleanup();
      }

      const beforeSignature = getRowSignature(table);
      const typed = await typeSearchValue(searchInput, country.code);

      if (modalOpenedAfterSearchTouch() || isTccModalOpen()) {
        allowSearchTyping = false;
        console.warn('[AU Filter] Aborting search path — modal detected after touch');
        return false;
      }

      if (typed) {
        searchApplied = true;
        await waitForTableUpdate(beforeSignature, 4000);
      }
    }

    if (isTccModalOpen()) return false;

    const rows = getTableRows(findDashboardTable());
    if (!rows.length) {
      console.log('[AU Filter] No rows yet — will retry');
      return false;
    }

    applyClientSideCleanup();
    return true;
  } catch (err) {
    console.warn('[AU Filter] Pipeline error:', err);
    return false;
  } finally {
    filteringInProgress = false;
  }
}

function startTableObserver() {
  const table = findDashboardTable();
  const tbody = table?.querySelector('tbody') || table;
  if (!tbody || tableObserver) return;

  let debounce = null;
  tableObserver = new MutationObserver((mutations) => {
    if (suppressTableObserver || filteringInProgress || isTccModalOpen()) return;

    const rowStructureChanged = mutations.some((mutation) => {
      if (mutation.type !== 'childList') return false;
      return [...mutation.addedNodes, ...mutation.removedNodes].some(
        (node) => node.nodeType === 1 && (node.matches?.('tr') || node.querySelector?.('tr'))
      );
    });
    if (!rowStructureChanged) return;

    clearTimeout(debounce);
    debounce = setTimeout(applyRowCleanup, 1500);
  });
  // Direct children only — ignore hover/class churn inside cells
  tableObserver.observe(tbody, { childList: true, subtree: false });
}

function auFilter() {
  console.log('[AU Filter] Script activated on roadside dashboard');
  activatedAt = Date.now();
  allowSearchTyping = true;
  lastSearchTouchAt = 0;

  let modalFreeSince = null;

  loadSelectedCountry(() => {
    const bootInterval = trackInterval(async () => {
      if (isTccModalOpen()) {
        modalFreeSince = null;
        // If we caused the modal, do not keep hammering search after dismiss
        if (modalOpenedAfterSearchTouch()) {
          allowSearchTyping = false;
        }
        return;
      }

      if (!modalFreeSince) modalFreeSince = Date.now();
      if (Date.now() - modalFreeSince < MODAL_CLEAR_MS) return;

      const stageField = findStageField();
      const table = findDashboardTable();
      if (!stageField || !table) return;

      // Toolbar first — no input events required
      injectToolbar(stageField);

      const quietDone = Date.now() - activatedAt >= BOOT_QUIET_MS;
      const ready = await runFilterPipeline({
        allowSearch: quietDone && allowSearchTyping
      });

      if (!ready) return;

      clearInterval(bootInterval);
      startTableObserver();
      console.log(
        '[AU Filter] Initial pipeline complete for',
        getSelectedCountry().code,
        allowSearchTyping ? '(search enabled)' : '(client-side only — search disabled this load)'
      );

      // Occasional recovery only if search typing is still allowed
      trackInterval(() => {
        if (!allowSearchTyping || filteringInProgress || suppressTableObserver || isTccModalOpen()) return;
        if (Date.now() - activatedAt < BOOT_QUIET_MS) return;
        const searchInput = findDashboardSearchInput();
        const country = getSelectedCountry();
        if (searchInput && normalizeText(searchInput.value) !== country.code) {
          searchApplied = false;
          runFilterPipeline({ forceSearch: true, allowSearch: true });
        }
      }, 15000);
    }, 1000);
  });
}

function maybeActivate() {
  // Only ever run in the top frame — never touch iframe copies of controls
  if (window.top !== window.self) return;

  if (!isOnRoadsideDashboard()) {
    if (isActive) stopAuFilter();
    return;
  }
  if (isActive) return;

  isTccQolEnabled((enabled) => {
    if (window.top !== window.self) return;
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
}, 2000);

maybeActivate();
