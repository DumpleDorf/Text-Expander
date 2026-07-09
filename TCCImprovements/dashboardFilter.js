console.log('[TCC QOL] AU dashboard filter script loaded');

const ROADSIDE_DASHBOARD_PATH = '/dashboard/roadsidedashboard';
let isActive = false;
let activeTimers = [];
let countdownRafId = null;

function isTccQolEnabled(callback) {
  chrome.storage.sync.get({ tccQolEnabled: true, auFilterEnabled: true }, (items) => {
    const enabled = items.tccQolEnabled !== null && items.tccQolEnabled !== undefined
      ? items.tccQolEnabled
      : items.auFilterEnabled;
    callback(!!enabled);
  });
}

function isOnRoadsideDashboard() {
    return location.pathname.toLowerCase().startsWith(ROADSIDE_DASHBOARD_PATH);
}

function trackInterval(fn, ms) {
    const id = setInterval(fn, ms);
    activeTimers.push(id);
    return id;
}

function stopAuFilter() {
    activeTimers.forEach(clearInterval);
    activeTimers = [];
    if (countdownRafId) cancelAnimationFrame(countdownRafId);
    countdownRafId = null;
    document.querySelector('#au-job-count-wrapper')?.remove();
    isActive = false;
    console.log('[AU Filter] Stopped');
}

function auFilter() {
    console.log('[AU Filter] Script activated');

    const waitForStage = trackInterval(() => {
        const stageField = document.querySelector(
            'div.tcc-dashboard-other-field:has(app-tcc-multi-select[label="Stage"])'
        );
        if (!stageField) return;

        clearInterval(waitForStage);

        if (document.querySelector('#au-job-count-wrapper')) return;

        injectJobCountAndTimer(stageField);

    }, 200);

    function getActiveJobCount() {
        const rows = document.querySelectorAll('mat-row');
        return Array.from(rows).filter(row => {
            const countryCell = row.querySelector('.mat-column-country');
            return countryCell && countryCell.textContent.trim() === 'AU';
        }).length;
    }

    function removeNonAU() {
        const rows = document.querySelectorAll('mat-row');
        let removedCount = 0;
        rows.forEach(row => {
            const countryCell = row.querySelector('.mat-column-country');
            if (countryCell && countryCell.textContent.trim() !== 'AU') {
                row.remove();
                removedCount++;
            }
        });
        console.log(`[AU Filter] Removed ${removedCount} non-AU rows`);
    }

    function sortByETA() {
        const table = document.querySelector('div.tcc-roadside-dashboard-table mat-table');
        if (!table) return;

        const rows = Array.from(table.querySelectorAll('mat-row'));
        const getETAValue = row => {
            const etaCell = row.querySelector('div.ng-star-inserted span');
            if (!etaCell) return Infinity;
            const text = etaCell.textContent.trim();
            if (text === '--') return -Infinity;
            return parseInt(text, 10) || 0;
        };

        rows.sort((a, b) => getETAValue(a) - getETAValue(b));
        rows.forEach(row => table.appendChild(row));
    }

    function injectJobCountAndTimer(stageField) {
        const wrapper = document.createElement('div');
        wrapper.id = 'au-job-count-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '20px';
        wrapper.style.marginTop = '20px';

        const jobCountLabel = document.createElement('span');
        jobCountLabel.style.fontSize = '12px';
        jobCountLabel.style.color = '#666';
        jobCountLabel.innerHTML = `Current Active Dispatches: <span style="font-weight: 800;">${getActiveJobCount()}</span>`;
        wrapper.appendChild(jobCountLabel);

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
        progressBar.style.height = '100%';
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
        progressBar.style.borderRadius = '8px';
        progressBar.style.transformOrigin = 'right';
        progressWrapper.appendChild(progressBar);

        wrapper.appendChild(countdownContainer);

        stageField.parentNode.insertBefore(wrapper, stageField.nextSibling);

        trackInterval(() => {
            jobCountLabel.innerHTML = `Current Active Dispatches: <span style="font-weight: 800;">${getActiveJobCount()}</span>`;
        }, 1000);

        const totalSeconds = 5 * 60;
        const startTime = performance.now();

        function update() {
            const elapsed = (performance.now() - startTime) / 1000;
            const remainingSeconds = Math.max(totalSeconds - elapsed, 0);

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = Math.floor(remainingSeconds % 60);
            countdownNumber.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const percentage = (remainingSeconds / totalSeconds) * 100;
            progressBar.style.width = `${percentage}%`;

            if (remainingSeconds > 0) {
                countdownRafId = requestAnimationFrame(update);
            } else {
                window.location.reload();
            }
        }
        countdownRafId = requestAnimationFrame(update);
    }

    function removeSortArrow() {
        const countryHeader = document.querySelector(
            'mat-header-cell.mat-column-country .mat-sort-header-container'
        );
        if (!countryHeader) return;
        const sortArrow = countryHeader.querySelector('.mat-sort-header-arrow');
        if (sortArrow) sortArrow.remove();
    }

    const tableInterval = trackInterval(() => {
        const rows = document.querySelectorAll('mat-row');
        const countryHeader = document.querySelector(
            'mat-header-cell.mat-column-country .mat-sort-header-container'
        );

        if (rows.length && countryHeader) {
            clearInterval(tableInterval);
            console.log(`[AU Filter] Table loaded with ${rows.length} rows`);

            countryHeader.click();
            setTimeout(() => {
                removeNonAU();
                removeSortArrow();
                sortByETA();
            }, 1000);
        }
    }, 500);
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
    if (area !== 'sync' || (!('tccQolEnabled' in changes) && !('auFilterEnabled' in changes))) return;

    const enabled = 'tccQolEnabled' in changes
      ? changes.tccQolEnabled.newValue
      : changes.auFilterEnabled.newValue;

    if (enabled) {
        maybeActivate();
    } else if (isActive) {
        stopAuFilter();
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
