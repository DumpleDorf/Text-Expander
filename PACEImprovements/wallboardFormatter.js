(function paceWallboardFormatterBootstrap() {
  const WALLBOARD_PATH = /\/pace\/.*\/insights\/wallboard/i;
  if (!WALLBOARD_PATH.test(location.pathname + location.search)) return;

  if (window.__paceWallboardFormatterLoaded) return;
  window.__paceWallboardFormatterLoaded = true;

  const HEADER_LABEL = "Oldest Interaction Waiting";
  const WAITING_HEADER_LABEL = "Waiting";
  const STATUS_CLASSES = [
    "pace-wallboard-wait--green",
    "pace-wallboard-wait--yellow",
    "pace-wallboard-wait--red"
  ];

  // Display labels + preferred row order for AU Vehicle Support queues
  const GROUP_CONFIG = [
    {
      label: "Roadside",
      patterns: [/CustomerSupport-RS(?::Voice)?/i, /^Roadside$/i]
    },
    {
      label: "Vehicle Support",
      patterns: [/CustomerSupport-VS(?::Voice)?/i, /^Vehicle Support$/i]
    },
    {
      label: "Service Center",
      patterns: [/CustomerSupport-ServiceCenter(?::Voice)?/i, /^Service Center$/i]
    },
    {
      label: "Home Charging",
      patterns: [/CustomerSupport-HomeCharging(?::Voice)?/i, /^Home Charging$/i]
    },
    {
      label: "Body Shop",
      patterns: [/CustomerSupport-BodyShop(?::Voice)?/i, /^Body Shop$/i]
    }
  ];

  let observer = null;
  let refreshTimer = null;
  let applying = false;

  function injectStyles() {
    if (document.getElementById("pace-wallboard-formatter-styles")) return;
    const link = document.createElement("link");
    link.id = "pace-wallboard-formatter-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("PACEImprovements/wallboardFormatter.css");
    (document.head || document.documentElement).appendChild(link);
  }

  function normalizeHeaderText(text) {
    return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function getVisibleGrid() {
    return document.querySelector(".gm-wallboard-columns .gm-grid") ||
      document.querySelector(".gm-wallboard-table .gm-wallboard-columns .gm-grid") ||
      document.querySelector(".gm-wallboard-table .gm-grid:not(.gm-probe .gm-grid)");
  }

  function getGridCells(grid) {
    return [...grid.children].filter(el => el.classList?.contains("gm-cell"));
  }

  function getColumnCount(cells) {
    const heads = cells.filter(cell => cell.classList.contains("gm-cell--head"));
    return heads.length || 10;
  }

  function getHeaderColumnIndex(cells, columnCount, label) {
    const heads = cells.filter(cell => cell.classList.contains("gm-cell--head"));
    const idx = heads.findIndex(cell =>
      normalizeHeaderText(cell.textContent) === normalizeHeaderText(label)
    );
    if (idx >= 0) return idx;

    for (let i = 0; i < Math.min(cells.length, columnCount); i++) {
      if (normalizeHeaderText(cells[i].textContent) === normalizeHeaderText(label)) {
        return i;
      }
    }
    return -1;
  }

  function getNameColumnIndex(cells, columnCount) {
    const heads = cells.filter(cell => cell.classList.contains("gm-cell--head"));
    const matchIdx = heads.findIndex(cell => {
      const text = normalizeHeaderText(cell.textContent);
      return text.includes("group") || text.includes("queue") || text.includes("store") || text === "name";
    });
    if (matchIdx >= 0) return matchIdx;
    return 0;
  }

  function resolveGroup(text) {
    const value = normalizeText(text);
    if (!value) return null;
    for (let i = 0; i < GROUP_CONFIG.length; i++) {
      const config = GROUP_CONFIG[i];
      if (config.patterns.some(pattern => pattern.test(value))) {
        return { label: config.label, order: i };
      }
    }
    return null;
  }

  function getDataRows(cells, columnCount) {
    const rows = [];
    for (let rowStart = columnCount; rowStart < cells.length; rowStart += columnCount) {
      const rowCells = cells.slice(rowStart, rowStart + columnCount);
      if (rowCells.length < columnCount) break;
      if (rowCells.every(cell => cell.classList.contains("gm-cell--head"))) continue;
      rows.push(rowCells);
    }
    return rows;
  }

  function applyGroupLabelsAndOrder() {
    const grid = getVisibleGrid();
    if (!grid) return;

    const cells = getGridCells(grid);
    const columnCount = getColumnCount(cells);
    if (columnCount <= 0) return;

    const nameIndex = getNameColumnIndex(cells, columnCount);
    const rows = getDataRows(cells, columnCount);
    if (!rows.length) return;

    const decorated = rows.map((rowCells, fallbackOrder) => {
      const nameCell = rowCells[nameIndex];
      if (!nameCell) {
        return { rowCells, order: 1000 + fallbackOrder, label: "" };
      }

      const original = nameCell.getAttribute("data-pace-group-original") || normalizeText(nameCell.textContent);
      if (!nameCell.getAttribute("data-pace-group-original") && original) {
        nameCell.setAttribute("data-pace-group-original", original);
      }

      const resolved = resolveGroup(original) || resolveGroup(nameCell.textContent);
      if (resolved && normalizeText(nameCell.textContent) !== resolved.label) {
        nameCell.textContent = resolved.label;
      }

      return {
        rowCells,
        order: resolved ? resolved.order : 1000 + fallbackOrder,
        label: resolved?.label || normalizeText(nameCell.textContent)
      };
    });

    decorated.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });

    let needsReorder = false;
    for (let i = 0; i < decorated.length; i++) {
      if (rows[i] !== decorated[i].rowCells) {
        needsReorder = true;
        break;
      }
    }
    if (!needsReorder) return;

    applying = true;
    try {
      decorated.forEach(({ rowCells }) => {
        rowCells.forEach(cell => grid.appendChild(cell));
      });
    } finally {
      applying = false;
    }
  }

  function getWaitRowPairs() {
    const grid = getVisibleGrid();
    if (!grid) return [];

    const cells = getGridCells(grid);
    const columnCount = getColumnCount(cells);
    const oldestIndex = getHeaderColumnIndex(cells, columnCount, HEADER_LABEL);
    const waitingIndex = getHeaderColumnIndex(cells, columnCount, WAITING_HEADER_LABEL);
    if (oldestIndex < 0 || columnCount <= 0) return [];

    const pairs = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.classList.contains("gm-cell--head")) continue;
      if (i % columnCount !== oldestIndex) continue;

      const rowStart = i - oldestIndex;
      const waitingCell = waitingIndex >= 0 ? cells[rowStart + waitingIndex] : null;
      pairs.push({
        oldest: cell,
        waiting: waitingCell && !waitingCell.classList.contains("gm-cell--head") ? waitingCell : null
      });
    }
    return pairs;
  }

  function parseWaitSeconds(rawText) {
    const text = (rawText || "").replace(/\s+/g, " ").trim();
    if (!text || text === "--" || text === "—") return null;

    const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (clock) {
      const a = Number(clock[1]);
      const b = Number(clock[2]);
      const c = clock[3] != null ? Number(clock[3]) : null;
      if (c != null) return a * 3600 + b * 60 + c;
      return a * 60 + b;
    }

    let total = 0;
    let matched = false;

    const hourMatch = text.match(/(\d+)\s*h(?:ours?)?/i);
    if (hourMatch) {
      total += Number(hourMatch[1]) * 3600;
      matched = true;
    }

    const minMatch = text.match(/(\d+)\s*m(?:ins?|inutes?)?/i);
    if (minMatch) {
      total += Number(minMatch[1]) * 60;
      matched = true;
    }

    const secMatch = text.match(/(\d+)\s*s(?:ecs?|econds?)?/i);
    if (secMatch) {
      total += Number(secMatch[1]);
      matched = true;
    }

    if (matched) return total;

    const plain = text.match(/^(\d+)$/);
    if (plain) return Number(plain[1]);

    return null;
  }

  function waitStatus(seconds) {
    if (seconds == null || Number.isNaN(seconds)) return null;
    if (seconds < 20) return "green";
    if (seconds <= 60) return "yellow";
    return "red";
  }

  function clearCellStatus(cell) {
    cell.classList.remove(...STATUS_CLASSES);
    cell.removeAttribute("data-pace-wallboard-wait");
  }

  function applyCellStatus(cell, status) {
    clearCellStatus(cell);
    if (!status) return;
    cell.classList.add(`pace-wallboard-wait--${status}`);
    cell.setAttribute("data-pace-wallboard-wait", status);
  }

  function applyRowStatus(pair, status) {
    applyCellStatus(pair.oldest, status);
    // Waiting column mirrors yellow/red only — never green
    if (!pair.waiting) return;
    if (status === "yellow" || status === "red") {
      applyCellStatus(pair.waiting, status);
    } else {
      clearCellStatus(pair.waiting);
    }
  }

  function refreshFormatting() {
    if (applying) return;
    applyGroupLabelsAndOrder();
    const pairs = getWaitRowPairs();
    pairs.forEach(pair => {
      const seconds = parseWaitSeconds(pair.oldest.textContent);
      applyRowStatus(pair, waitStatus(seconds));
    });
  }

  function scheduleRefresh() {
    if (applying) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      try {
        refreshFormatting();
      } catch (err) {
        console.warn("[PACE Wallboard] Refresh failed:", err);
      }
    }, 50);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => scheduleRefresh());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  injectStyles();
  startObserver();
  scheduleRefresh();
  console.log("[PACE Wallboard] Formatter loaded");
})();
