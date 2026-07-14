(function paceAdvisorAvailabilityWallboardBootstrap() {
  const INSIGHTS_PATH = /\/pace\/admin\/contact-center\/insights/i;
  if (!INSIGHTS_PATH.test(location.pathname)) return;

  if (window.__paceAdvisorWallboardLoaded) return;
  window.__paceAdvisorWallboardLoaded = true;

  const WALLBOARD_ID = "pace-advisor-wallboard";
  const OPEN_BTN_ID = "pace-advisor-wallboard-open";
  const TICK_MS = 1000;

  let overlay = null;
  let tickTimer = null;
  let observer = null;
  let cachedRows = [];
  let lastDomUpdateAt = null;

  function injectStyles() {
    if (!document.getElementById("pace-wallboard-formatter-styles")) {
      const shared = document.createElement("link");
      shared.id = "pace-wallboard-formatter-styles";
      shared.rel = "stylesheet";
      shared.href = chrome.runtime.getURL("PACEImprovements/wallboardFormatter.css");
      (document.head || document.documentElement).appendChild(shared);
    }
    if (document.getElementById("pace-advisor-wallboard-styles")) return;
    const link = document.createElement("link");
    link.id = "pace-advisor-wallboard-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("PACEImprovements/advisorAvailabilityWallboard.css");
    (document.head || document.documentElement).appendChild(link);
  }

  function isAdvisorAvailabilityTab() {
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === "advisor-availability") return true;
    const tab = document.getElementById("advisor-availability");
    return !!(tab && tab.getAttribute("aria-selected") === "true");
  }

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function getAdvisorTable() {
    return document.querySelector(".advisor-availability-container table.tds-data-table") ||
      document.querySelector(".insights-content table.tds-data-table");
  }

  function extractName(row) {
    const link = row.querySelector("th .tds-link, th a.tds-link");
    if (link) return normalize(link.textContent);
    const th = row.querySelector("th");
    if (!th) return "";
    const clone = th.cloneNode(true);
    clone.querySelectorAll("button, .tds-tooltip, svg").forEach(el => el.remove());
    return normalize(clone.textContent).replace(/\([^)]+\)\s*$/, "").trim();
  }

  function extractVoiceState(row) {
    const cells = row.querySelectorAll("td");
    if (!cells.length) return "";

    // Operational State is usually the first td
    const opCell = cells[0];
    const blocks = [...opCell.querySelectorAll(":scope > div > div")];
    for (const block of blocks) {
      const label = normalize(block.querySelector("span")?.textContent || "");
      if (!/^voice:?$/i.test(label) && !label.toLowerCase().startsWith("voice")) continue;
      const chip = block.querySelector(".tds-chip-text, .tds-chip");
      if (chip) return normalize(chip.textContent);
    }

    // Fallback: find a Voice: label anywhere in the cell
    const spans = [...opCell.querySelectorAll("span")];
    for (let i = 0; i < spans.length; i++) {
      if (!/^voice:?$/i.test(normalize(spans[i].textContent))) continue;
      const chip = spans[i].closest("div")?.parentElement?.querySelector(".tds-chip-text");
      if (chip) return normalize(chip.textContent);
    }
    return "";
  }

  function parseAbsoluteUpdatedAt(text) {
    const match = text.match(
      /([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!match) return null;

    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[match[1].toLowerCase()];
    if (month == null) return null;

    let hour = Number(match[3]);
    const minute = Number(match[4]);
    const ampm = match[5].toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    const now = new Date();
    const date = new Date(now.getFullYear(), month, Number(match[2]), hour, minute, 0, 0);
    // If date is far in the future (timezone edge), pull back a year
    if (date.getTime() - now.getTime() > 12 * 60 * 60 * 1000) {
      date.setFullYear(date.getFullYear() - 1);
    }
    return date;
  }

  function parseRelativeSeconds(text) {
    const cleaned = normalize(text).toLowerCase();
    if (!cleaned || cleaned === "just now") return 0;

    let total = 0;
    let matched = false;
    const hour = cleaned.match(/(\d+)\s*h/);
    const min = cleaned.match(/(\d+)\s*m(?!\s*ax)/);
    const sec = cleaned.match(/(\d+)\s*s/);
    if (hour) {
      total += Number(hour[1]) * 3600;
      matched = true;
    }
    if (min) {
      total += Number(min[1]) * 60;
      matched = true;
    }
    if (sec) {
      total += Number(sec[1]);
      matched = true;
    }
    return matched ? total : null;
  }

  function extractDisplayState(row) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return "";
    // Display State is the second data cell (after Operational State)
    const displayCell = cells[1];
    const label = displayCell.querySelector(":scope > div > span, :scope > div span");
    return normalize(label?.textContent || "");
  }

  function extractUpdatedAt(row) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return null;
    const lastCell = cells[cells.length - 1];
    const text = lastCell.innerText || lastCell.textContent || "";
    const absolute = parseAbsoluteUpdatedAt(text);
    if (absolute) return absolute;

    const relative = parseRelativeSeconds(text.split("\n")[0] || text);
    if (relative == null) return null;
    return new Date(Date.now() - relative * 1000);
  }

  function formatDuration(seconds) {
    if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "--";
    const totalMins = Math.floor(seconds / 60);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  function stateStatus(state) {
    const value = normalize(state).toLowerCase();
    if (!value) return null;
    if (value === "available" || value === "ready") return "green";
    if (value === "on call" || value === "on chat" || value === "on case") return "yellow";
    if (value === "lunch" || value === "break") return null;
    if (value === "meeting" || value === "project" || value === "training" || value === "roadside") return "blue";
    // ACW and everything else
    return "red";
  }

  function stateSortRank(state) {
    const value = normalize(state).toLowerCase();
    if (value === "available") return 0;
    if (value === "on call") return 1;
    if (value === "acw") return 2;
    if (value === "lunch") return 3;
    return 4;
  }

  function rowSeconds(row, now = Date.now()) {
    if (!row.updatedAt) return -1;
    return Math.max(0, Math.floor((now - row.updatedAt.getTime()) / 1000));
  }

  function sortAdvisors(rows) {
    const now = Date.now();
    return [...rows].sort((a, b) => {
      const rankA = stateSortRank(a.state);
      const rankB = stateSortRank(b.state);
      if (rankA !== rankB) return rankA - rankB;

      // Other reasons: group alphabetically by state, then time descending within group
      if (rankA === 4) {
        const nameCmp = normalize(a.state).localeCompare(normalize(b.state), undefined, {
          sensitivity: "base"
        });
        if (nameCmp !== 0) return nameCmp;
      }

      return rowSeconds(b, now) - rowSeconds(a, now);
    });
  }

  function scrapeAdvisors() {
    const table = getAdvisorTable();
    if (!table) return [];

    const rows = [...table.querySelectorAll("tbody tr")];
    const scraped = rows.map(row => {
      const name = extractName(row);
      let state = extractVoiceState(row);
      // Voice chip is often just "Busy" for AUX — prefer Display State (Lunch, Break, etc.)
      if (/^busy$/i.test(state)) {
        const display = extractDisplayState(row);
        if (display) state = display;
      }
      const updatedAt = extractUpdatedAt(row);
      if (!name) return null;
      return { name, state, updatedAt };
    }).filter(Boolean);

    return sortAdvisors(scraped);
  }

  function buildOverlay() {
    const root = document.createElement("div");
    root.id = WALLBOARD_ID;
    root.className = "pace-advisor-wallboard";
    root.innerHTML = `
      <div class="pace-advisor-wallboard-bar">
        <div class="pace-advisor-wallboard-header-left">
          <span class="pace-advisor-wallboard-brand">Advisor Workspace Admin</span>
          <span class="pace-advisor-wallboard-sep" aria-hidden="true">·</span>
          <span class="pace-advisor-wallboard-board">Advisor Availability</span>
        </div>
        <div class="pace-advisor-wallboard-header-right">
          <span class="pace-advisor-wallboard-timestamp" data-timestamp role="status">
            <span class="pace-advisor-wallboard-live" aria-label="Live">
              <span class="pace-advisor-wallboard-live-dot" aria-hidden="true"></span>
            </span>
            <span data-last-updated>Last Updated --</span>
          </span>
          <button type="button" class="pace-advisor-wallboard-close" data-close aria-label="Exit Wallboard">×</button>
        </div>
      </div>
      <div class="pace-advisor-wallboard-table" data-table>
        <div class="pace-advisor-wallboard-columns" data-columns>
          <div class="pace-advisor-wallboard-grid" data-grid-left></div>
          <div class="pace-advisor-wallboard-grid" data-grid-right hidden></div>
        </div>
      </div>
    `;

    root.querySelector("[data-close]").addEventListener("click", closeWallboard);
    root.addEventListener("click", (e) => {
      if (e.target === root) closeWallboard();
    });
    return root;
  }

  function buildGridHtml(rows, now, { showEmpty = false } = {}) {
    const parts = [
      `<div class="pace-advisor-cell pace-advisor-cell--head">Name</div>`,
      `<div class="pace-advisor-cell pace-advisor-cell--head">State</div>`,
      `<div class="pace-advisor-cell pace-advisor-cell--head">Time</div>`
    ];

    rows.forEach(row => {
      const seconds = row.updatedAt ? rowSeconds(row, now) : null;
      const timeText = formatDuration(seconds);
      const stateClass = stateStatus(row.state);

      parts.push(`<div class="pace-advisor-cell pace-advisor-cell--name">${escapeHtml(row.name)}</div>`);
      parts.push(
        `<div class="pace-advisor-cell pace-advisor-cell--state${stateClass ? ` pace-wallboard-wait--${stateClass}` : ""}">${escapeHtml(row.state || "--")}</div>`
      );
      parts.push(
        `<div class="pace-advisor-cell pace-advisor-cell--time">${escapeHtml(timeText)}</div>`
      );
    });

    if (showEmpty && !rows.length) {
      parts.push(`<div class="pace-advisor-cell pace-advisor-cell--empty">No advisors found on this page</div>`);
    }

    return parts.join("");
  }

  function estimateFitCount(tableEl, probeGrid) {
    const style = getComputedStyle(tableEl);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const available = tableEl.clientHeight - padY;
    if (available <= 0) return Infinity;

    const head = probeGrid.querySelector(".pace-advisor-cell--head");
    const nameCell = probeGrid.querySelector(".pace-advisor-cell--name:not(.pace-advisor-cell--head)");
    const headHeight = head?.getBoundingClientRect().height || 42;
    const rowHeight = nameCell?.getBoundingClientRect().height || 42;
    if (rowHeight <= 0) return Infinity;

    return Math.max(1, Math.floor((available - headHeight) / rowHeight));
  }

  function renderGrid(rows) {
    if (!overlay) return;
    const tableEl = overlay.querySelector("[data-table]");
    const columnsEl = overlay.querySelector("[data-columns]");
    const leftGrid = overlay.querySelector("[data-grid-left]");
    const rightGrid = overlay.querySelector("[data-grid-right]");
    if (!tableEl || !columnsEl || !leftGrid || !rightGrid) return;

    const now = Date.now();
    const sorted = sortAdvisors(rows);

    // Probe as a single column first
    tableEl.classList.remove("pace-advisor-wallboard-table--split");
    rightGrid.hidden = true;
    rightGrid.innerHTML = "";
    leftGrid.innerHTML = buildGridHtml(sorted, now, { showEmpty: true });

    const applySplit = () => {
      if (!overlay || !tableEl.isConnected) return;

      if (sorted.length < 2) {
        tableEl.classList.remove("pace-advisor-wallboard-table--split");
        rightGrid.hidden = true;
        rightGrid.innerHTML = "";
        leftGrid.innerHTML = buildGridHtml(sorted, now, { showEmpty: true });
        return;
      }

      const fit = estimateFitCount(tableEl, leftGrid);
      if (sorted.length <= fit) {
        tableEl.classList.remove("pace-advisor-wallboard-table--split");
        rightGrid.hidden = true;
        rightGrid.innerHTML = "";
        leftGrid.innerHTML = buildGridHtml(sorted, now, { showEmpty: true });
        return;
      }

      // Fill left to capacity, spill remaining into the right column
      const leftCount = Math.max(1, Math.min(fit, sorted.length - 1));
      const leftRows = sorted.slice(0, leftCount);
      const rightRows = sorted.slice(leftCount);

      tableEl.classList.add("pace-advisor-wallboard-table--split");
      rightGrid.hidden = false;
      leftGrid.innerHTML = buildGridHtml(leftRows, now);
      rightGrid.innerHTML = buildGridHtml(rightRows, now);
    };

    requestAnimationFrame(applySplit);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateTimestampLabel() {
    if (!overlay) return;
    const label = overlay.querySelector("[data-last-updated]");
    if (!label) return;
    if (!lastDomUpdateAt) {
      label.textContent = "Last Updated --";
      return;
    }
    label.textContent = `Last Updated ${lastDomUpdateAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    })}`;
  }

  function refreshFromPage({ fromDom = false } = {}) {
    cachedRows = scrapeAdvisors();
    renderGrid(cachedRows);
    if (fromDom) {
      lastDomUpdateAt = new Date();
      updateTimestampLabel();
    }
  }

  function tickDurations() {
    // Only advance Time values — do not bump Last Updated
    renderGrid(cachedRows);
  }

  function onViewportChange() {
    if (!overlay) return;
    clearTimeout(onViewportChange._debounce);
    onViewportChange._debounce = setTimeout(() => renderGrid(cachedRows), 100);
  }

  function openWallboard() {
    if (overlay) return;
    injectStyles();
    overlay = buildOverlay();
    document.documentElement.appendChild(overlay);
    document.documentElement.classList.add("pace-advisor-wallboard-open");
    lastDomUpdateAt = new Date();
    refreshFromPage();
    updateTimestampLabel();

    clearInterval(tickTimer);
    tickTimer = setInterval(tickDurations, TICK_MS);

    window.addEventListener("resize", onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onViewportChange);
    }
    if (typeof ResizeObserver !== "undefined") {
      openWallboard._ro = new ResizeObserver(onViewportChange);
      const tableEl = overlay.querySelector("[data-table]");
      if (tableEl) openWallboard._ro.observe(tableEl);
    }

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      clearTimeout(openWallboard._debounce);
      openWallboard._debounce = setTimeout(() => {
        refreshFromPage({ fromDom: true });
      }, 150);
    });
    const table = getAdvisorTable();
    const container = document.querySelector(".advisor-availability-container") || table;
    if (container) {
      observer.observe(container, { childList: true, subtree: true, characterData: true });
    }
  }

  function closeWallboard() {
    clearInterval(tickTimer);
    tickTimer = null;
    window.removeEventListener("resize", onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onViewportChange);
    }
    if (openWallboard._ro) {
      openWallboard._ro.disconnect();
      openWallboard._ro = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    overlay?.remove();
    overlay = null;
    lastDomUpdateAt = null;
    document.documentElement.classList.remove("pace-advisor-wallboard-open");
  }

  function ensureOpenButton() {
    if (!isAdvisorAvailabilityTab()) {
      document.getElementById(OPEN_BTN_ID)?.remove();
      if (overlay) closeWallboard();
      return;
    }

    if (document.getElementById(OPEN_BTN_ID)) return;

    const heading = [...document.querySelectorAll(".advisor-availability-container h2")]
      .find(h => /advisor availability/i.test(h.textContent || ""));
    const mount = heading?.parentElement || document.querySelector(".advisor-availability-container");
    if (!mount) return;

    const btn = document.createElement("button");
    btn.id = OPEN_BTN_ID;
    btn.type = "button";
    btn.className = "tds-btn tds-btn--secondary pace-advisor-wallboard-open-btn";
    btn.textContent = "Open Wallboard";
    btn.addEventListener("click", openWallboard);

    if (heading) {
      const wrap = document.createElement("div");
      wrap.className = "pace-advisor-wallboard-open-wrap";
      heading.insertAdjacentElement("afterend", wrap);
      wrap.appendChild(btn);
    } else {
      mount.prepend(btn);
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay) closeWallboard();
  });

  const pageObserver = new MutationObserver(() => ensureOpenButton());
  pageObserver.observe(document.documentElement, { childList: true, subtree: true });

  injectStyles();
  ensureOpenButton();
  console.log("[PACE Advisor Wallboard] Loaded");
})();
