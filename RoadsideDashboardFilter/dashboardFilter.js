// dashboardfilter.js

console.log('[AU Filter] Script loaded');

function auFilter() {
    console.log('[AU Filter] Script activated');

    // -----------------------------
    // Wait for "Stage" field to exist
    // -----------------------------
    const waitForStage = setInterval(() => {
        const stageField = document.querySelector(
            'div.tcc-dashboard-other-field:has(app-tcc-multi-select[label="Stage"])'
        );
        if (!stageField) return;

        clearInterval(waitForStage);

        // Avoid injecting twice
        if (document.querySelector('#au-countdown-container')) return;

        // -----------------------------
        // Countdown timer + bar
        // -----------------------------
        const container = document.createElement('div');
        container.id = 'au-countdown-container';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.minWidth = '200px';
        container.style.marginTop = '21px';

        const label = document.createElement('div');
        label.style.fontSize = '12px';
        label.style.color = '#666';
        label.textContent = 'Time till refresh: ';

        const countdownNumber = document.createElement('span');
        countdownNumber.style.marginLeft = '5px';
        countdownNumber.textContent = '5:00';
        label.appendChild(countdownNumber);
        container.appendChild(label);

        const progressWrapper = document.createElement('div');
        progressWrapper.style.width = '100%';
        progressWrapper.style.height = '16px';
        progressWrapper.style.background = '#e0e0e0';
        progressWrapper.style.borderRadius = '8px';
        progressWrapper.style.overflow = 'hidden';
        progressWrapper.style.marginTop = '6px';
        container.appendChild(progressWrapper);

        const progressBar = document.createElement('div');
        progressBar.style.height = '100%';
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
        progressBar.style.borderRadius = '8px';
        progressBar.style.transformOrigin = 'right';
        progressWrapper.appendChild(progressBar);

        stageField.parentNode.insertBefore(container, stageField.nextSibling);

        // -----------------------------
        // Countdown logic (JS-controlled)
        // -----------------------------
        const totalSeconds = 5 * 60;
        let remainingSeconds = totalSeconds;
        const startTime = performance.now();

        function update() {
            const elapsed = (performance.now() - startTime) / 1000;
            remainingSeconds = Math.max(totalSeconds - elapsed, 0);

            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = Math.floor(remainingSeconds % 60);
            countdownNumber.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const percentage = (remainingSeconds / totalSeconds) * 100;
            progressBar.style.width = `${percentage}%`;

            if (remainingSeconds > 0) {
                requestAnimationFrame(update);
            } else {
                window.location.reload();
            }
        }
        requestAnimationFrame(update);
    }, 200);

    // -----------------------------
    // Count Active AU Jobs
    // -----------------------------
    function getActiveJobCount() {
        const rows = document.querySelectorAll('mat-row');
        return Array.from(rows).filter(row => {
            const countryCell = row.querySelector('.mat-column-country');
            return countryCell && countryCell.textContent.trim() === 'AU';
        }).length;
    }

    // -----------------------------
    // Remove non-AU rows
    // -----------------------------
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

    // -----------------------------
    // Sort by ETA: --, negative, 0, positive
    // -----------------------------
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

        // Append rows in sorted order
        rows.forEach(row => table.appendChild(row));
    }

    // -----------------------------
    // Inject Current Active Dispatches inline
    // -----------------------------
    function injectJobCountLabel() {
        const countdownContainer = document.querySelector('#au-countdown-container');
        if (!countdownContainer || document.querySelector('#au-job-count-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'au-job-count-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '12px';

        const label = document.createElement('span');
        label.style.fontSize = '12px';
        label.style.color = '#666';
        label.style.paddingTop = '25px'; 
        label.innerHTML = `Current Active Dispatches: <span style="font-weight: 800;">${getActiveJobCount()}</span>`;


        // Insert wrapper before countdownContainer
        countdownContainer.parentNode.insertBefore(wrapper, countdownContainer);
        // Now move countdownContainer inside wrapper safely
        wrapper.appendChild(label);
        wrapper.appendChild(countdownContainer);

        // Update number every second
        setInterval(() => {
            label.innerHTML = `Current Active Dispatches: <span style="font-weight: 800;">${getActiveJobCount()}</span>`;
        }, 1000);
    }


    // -----------------------------
    // Remove sort arrow
    // -----------------------------
    function removeSortArrow() {
        const countryHeader = document.querySelector(
            'mat-header-cell.mat-column-country .mat-sort-header-container'
        );
        if (!countryHeader) return;
        const sortArrow = countryHeader.querySelector('.mat-sort-header-arrow');
        if (sortArrow) sortArrow.remove();
    }

    // -----------------------------
    // Wait for table and header
    // -----------------------------
    const tableInterval = setInterval(() => {
        const rows = document.querySelectorAll('mat-row');
        const countryHeader = document.querySelector(
            'mat-header-cell.mat-column-country .mat-sort-header-container'
        );

        if (rows.length && countryHeader) {
            clearInterval(tableInterval);
            console.log(`[AU Filter] Table loaded with ${rows.length} rows`);

            // Sort AU jobs
            countryHeader.click();
            setTimeout(() => {
                removeNonAU();
                removeSortArrow();
                injectJobCountLabel();
                sortByETA();
            }, 1000);
        }
    }, 500);
}

// -----------------------------
// Start filter automatically
// -----------------------------
auFilter();
