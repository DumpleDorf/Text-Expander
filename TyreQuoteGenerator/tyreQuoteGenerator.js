console.log("tyreQuoteGenerator.js loaded");

const MODEL_DISPLAY_NAMES = {
  "Model Y": "Model Y/YL"
};

const BRAND_DISPLAY_NAMES = {
  "Continental": "Continental (YL)"
};

function tyreMatchesSelectedModel(tyreModel, selectedModel) {
  if (selectedModel === "Model Y") {
    return tyreModel === "Model Y" || tyreModel === "Model YL";
  }
  return tyreModel === selectedModel;
}

function csvHasModel(csvModels, model) {
  if (model === "Model Y") {
    return csvModels.includes("Model Y") || csvModels.includes("Model YL");
  }
  return csvModels.includes(model);
}

function isModelYLFromText(text) {
  if (!text) return false;
  return /Model\s*YL\b/i.test(text);
}

function detectWheelSizeFromText(text) {
  if (!text) return null;

  const inch = `(?:\\u2033|\\u201D|\\u201C|"|'|\\u2019){1,3}`;
  const patterns = [
    new RegExp(`WHEELS\\s*[\\r\\n]+(\\d{2})\\s*${inch}`, "i"),
    new RegExp(`WHEELS[\\s\\S]{0,160}?(\\d{2})\\s*${inch}`, "i"),
    new RegExp(`(\\d{2})\\s*${inch}\\s*(?:Gemini|Sports\\s+Apollo|Apollo)[\\w\\s()$]*Wheels`, "i"),
    new RegExp(`(\\d{2})\\s*${inch}\\s+[\\w\\s()$]+Wheels`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const wheel = parseInt(match[1], 10);
      if (wheel >= 18 && wheel <= 23) return wheel;
    }
  }
  return null;
}

async function waitForTyreData(timeout = 5000) {
  const start = Date.now();
  while (!window.tyreData?.length && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 50));
  }
  return window.tyreData?.length > 0;
}

async function waitForBrandSizeButtons(timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (document.querySelectorAll("#brandButtons .btn-option").length > 0) {
      return true;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

function isTyreQuoteAutoSelectUrl(url) {
  return url.startsWith("https://customerconnect.tesla.com/") ||
    /^https:\/\/os\.tesla\.com\/en-AU\/pace\//i.test(url);
}

function getTyreQuoteScriptTarget(tabId, url) {
  return isTyreQuoteAutoSelectUrl(url)
    ? { tabId, allFrames: true }
    : { tabId };
}

function clearPositionFlash() {
  if (window.positionFlashTimeout) {
    clearTimeout(window.positionFlashTimeout);
    window.positionFlashTimeout = null;
  }
  document.getElementById('positionRow')?.classList.remove('flash-position');
}

function schedulePositionFlash(delayMs = 0) {
  const row = document.getElementById('positionRow');
  if (!row?.classList.contains('needs-selection')) return;

  clearPositionFlash();
  window.positionFlashTimeout = setTimeout(() => {
    row.classList.add('flash-position');
    window.positionFlashTimeout = null;
  }, delayMs);
}

function scrollToQuoteControlsIfNeeded() {
  const generateBtn = document.getElementById("generateQuote");
  if (!generateBtn) return;

  const needsPosition = hasAmbiguousRimSizes() && !selectedPosition;
  const needsMoreInput = generateBtn.disabled || needsPosition;

  if (!needsMoreInput) return;

  setTimeout(() => {
    generateBtn.scrollIntoView({ behavior: "smooth", block: "end" });
  }, 150);
}

// -------------------------
// CSV LOAD & UI INIT
// -------------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log("[Tyre Quote] Fetching CSV from:", chrome.runtime.getURL("TyreQuoteGenerator/tyre_prices.csv"));
    const response = await fetch(chrome.runtime.getURL("TyreQuoteGenerator/tyre_prices.csv"));
    console.log("[Tyre Quote] Fetch status:", response.status);

    const csvText = await response.text();
    console.log('CSV text:', csvText.slice(0, 200));

    const data = parseCsvData(csvText);
    console.log('Parsed CSV data:', data);

    if (data.length === 0) throw new Error('No data found in CSV');

    window.tyreData = data;

    setupEventListeners();
    populateModels();
    enableInterface();

  } catch (error) {
    console.error('Error loading local CSV:', error);
    alert('Error loading tyre data. See console.');
  }
});

// -------------------------
// PAGE SECTION SWITCH
// -------------------------
document.addEventListener('DOMContentLoaded', () => {
  const landingPage = document.getElementById('landingPage');
  const tyreQuoteSection = document.getElementById('tyreQuoteSection');
  const backBtn = document.getElementById('backBtn');

  document.getElementById('tyreQuoteBtn').addEventListener('click', async () => {
    landingPage.style.display = 'none';
    tyreQuoteSection.style.display = 'block';

    // Populate models and enable interface
    populateModels();
    enableInterface();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url || "";

      if (isTyreQuoteAutoSelectUrl(url)) {
        console.log("[Tyre Quote] TCC page detected (CustomerConnect or PACE): running full auto-select.");
        const dataReady = await waitForTyreData();
        if (!dataReady) {
          console.warn("[Tyre Quote] Tyre data not loaded in time; auto-select skipped.");
          return;
        }
        await autoSelectTyreAndGenerate(); // full flow
      } else {
        console.log("[Tyre Quote] External page: only running VIN detection + model select.");
        const vin = await detectVinFromPage();
        if (vin) {
          console.log("[Tyre Quote] VIN detected on external page:", vin);
          await handleVinAutoSelect(); // only sets model dropdown
        } else {
          console.warn("[Tyre Quote] No VIN detected on external page.");
        }
      }
    } catch (err) {
      console.error("[Tyre Quote] Error during auto-select check:", err);
    }
  });

  backBtn.addEventListener('click', () => {
    tyreQuoteSection.style.display = 'none';
    landingPage.style.display = 'flex';
  });
});

// -------------------------
// VIN DETECTION & AUTO MODEL
// -------------------------
async function detectVinFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    if (!tab.url?.startsWith("https://")) return null;

    const results = await chrome.scripting.executeScript({
      target: getTyreQuoteScriptTarget(tab.id, tab.url),
      func: () => {
        const allText = document.body?.innerText || "";
        const vinMatch = allText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
        return vinMatch ? vinMatch[0] : null;
      }
    });

    return results.map(r => r.result).find(v => v) || null;
  } catch {
    return null;
  }
}

async function handleVinAutoSelect() {
  const vin = await detectVinFromPage();
  if (!vin) return;

  console.log("[Tyre Quote] VIN detected:", vin);

  const modelCode = vin.charAt(3).toUpperCase();
  let modelName = null;
  switch (modelCode) {
    case "3": modelName = "Model 3"; break;
    case "Y": modelName = "Model Y"; break;
    case "S": modelName = "Model S"; break;
    case "X": modelName = "Model X"; break;
    default:
      console.log("[Tyre Quote] Unknown model code:", modelCode);
      return;
  }

  console.log(`[Tyre Quote] Auto-selecting: ${modelName}`);

  const modelDropdown = document.getElementById('modelSelect');

  // Wait until options are populated
  const waitForOptions = () => new Promise((resolve) => {
    const interval = setInterval(() => {
      if (modelDropdown.options.length > 1) { // first option is placeholder
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });

  await waitForOptions();
  modelDropdown.value = modelName;
  modelDropdown.dispatchEvent(new Event("change"));
}

// -------------------------
// Auto-select tyre based on VIN and wheel size (multi-run + auto-close safe)
// -------------------------
async function autoSelectTyreAndGenerate() {
  console.log("[Tyre Quote] Starting auto-select process...");
  window.tyreQuoteAutoFlow = true;
  clearPositionFlash();

  try {
  // Helper: wait for element to exist
  async function waitForElement(selector, timeout = 3000) {
    const el = document.querySelector(selector);
    if (el) return el; // immediate return if exists
    const start = Date.now();
    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 25)); // faster poll
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  // 1️⃣ Detect VIN
  const vin = await detectVinFromPage();
  if (!vin) {
    console.warn("[Tyre Quote] No VIN detected.");
    return;
  }
  console.log("[Tyre Quote] Detected VIN:", vin);

  // 2️⃣ Derive model
  const modelCode = vin.charAt(3).toUpperCase();
  const modelMap = { "3": "Model 3", "Y": "Model Y", "S": "Model S", "X": "Model X" };
  const modelName = modelMap[modelCode];
  if (!modelName) {
    console.warn("[Tyre Quote] Unknown model code:", modelCode);
    return;
  }
  console.log("[Tyre Quote] Auto-selecting model:", modelName);

  // 3️⃣ Select model in popup
  const modelDropdown = await waitForElement("#modelSelect", 5000);
  if (!modelDropdown) {
    console.warn("[Tyre Quote] Model dropdown not found.");
    return;
  }

  // Wait until options populated
  await new Promise(resolve => {
    const interval = setInterval(() => {
      if (modelDropdown.options.length > 1) {
        clearInterval(interval);
        resolve();
      }
    }, 25); // faster poll
  });

  modelDropdown.value = modelName;
  modelDropdown.dispatchEvent(new Event("change"));
  console.log("[Tyre Quote] Model selected in popup");

  await waitForBrandSizeButtons();

  // 5️⃣ Detect wheel size from page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const wheelResult = await chrome.scripting.executeScript({
    target: getTyreQuoteScriptTarget(tab.id, tab.url),
    func: async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const click = el => el?.click();

      const hasTccContext = () => {
        const text = document.body?.innerText || "";
        return location.hostname.includes("customerconnect.tesla.com") ||
          document.getElementById("tcc-asset-panel-detail-icon") ||
          document.querySelector('img[mattooltip="Vehicle Details"]') ||
          /WHEELS/i.test(text) ||
          /Model\s*Y/i.test(text);
      };

      if (!hasTccContext()) {
        return { wheel: null, drawerOpenedBy: null, isModelYL: false };
      }

      const detectWheelSizeFromText = (text) => {
        if (!text) return null;
        const inch = `(?:\\u2033|\\u201D|\\u201C|"|'|\\u2019){1,3}`;
        const patterns = [
          new RegExp(`WHEELS\\s*[\\r\\n]+(\\d{2})\\s*${inch}`, "i"),
          new RegExp(`WHEELS[\\s\\S]{0,160}?(\\d{2})\\s*${inch}`, "i"),
          new RegExp(`(\\d{2})\\s*${inch}\\s*(?:Gemini|Sports\\s+Apollo|Apollo)[\\w\\s()$]*Wheels`, "i"),
          new RegExp(`(\\d{2})\\s*${inch}\\s+[\\w\\s()$]+Wheels`, "i"),
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const wheel = parseInt(match[1], 10);
            if (wheel >= 18 && wheel <= 23) return wheel;
          }
        }
        return null;
      };

      const isModelYLFromText = (text) => {
        if (!text) return false;
        return /Model\s*YL\b/i.test(text);
      };

      const collectPageText = () => {
        const chunks = [document.body?.innerText || ""];
        document.querySelectorAll(
          "mat-expansion-panel, .mat-expansion-panel-content, .mat-expansion-panel-body, mat-drawer, .mat-drawer-inner-container"
        ).forEach(el => {
          const text = el.innerText?.trim();
          if (text) chunks.push(text);
        });
        return chunks.join("\n");
      };

      let drawerOpenedBy = null;
      let clickedVehicle = false;
      let clickedInfo = false;

      for (let attempt = 1; attempt <= 12; attempt++) {
        console.log(`[Page] Wheel detect attempt ${attempt}`);

        // Open Details panel if closed
        const detailsHeader = [...document.querySelectorAll("mat-expansion-panel-header")]
          .find(h => h.innerText.trim().toLowerCase() === "details");
        if (detailsHeader && detailsHeader.getAttribute("aria-expanded") !== "true") {
          click(detailsHeader);
          await sleep(300);
        }

        // Click Info / Vehicle icons only once
        const infoIcon = document.getElementById("tcc-asset-panel-detail-icon");
        const vehicleIcon = document.querySelector('img[mattooltip="Vehicle Details"]');

        if (!clickedInfo && infoIcon && !infoIcon.classList.contains("tcc-sms-disabled")) {
          click(infoIcon);
          drawerOpenedBy = "info";
          clickedInfo = true;
        } else if (!clickedVehicle && vehicleIcon) {
          click(vehicleIcon);
          drawerOpenedBy = "vehicle";
          clickedVehicle = true;
        }

        await sleep(400);

        const pageText = collectPageText();
        const wheel = detectWheelSizeFromText(pageText);
        const isModelYL = isModelYLFromText(pageText);
        if (wheel) {
          console.log("[Page] Wheel size detected:", wheel, "| Model YL:", isModelYL);
          return { wheel, drawerOpenedBy, isModelYL };
        }

        await sleep(500);
      }

      console.warn("[Page] Failed to detect wheel size after 12 attempts");
      const pageText = collectPageText();
      const isModelYL = isModelYLFromText(pageText);
      return { wheel: null, drawerOpenedBy, isModelYL };
    }
  });

  // ✅ Extract wheel from result safely (prefer frame that found a wheel)
  const frameResults = (wheelResult || []).map(r => r.result).filter(Boolean);
  const bestWheelResult = frameResults.find(r => r.wheel) || frameResults[0];
  const wheel = bestWheelResult?.wheel;
  const drawerOpenedBy = bestWheelResult?.drawerOpenedBy;
  const isModelYL = bestWheelResult?.isModelYL;

  if (!wheel) {
    console.warn("[Tyre Quote] Wheel size not detected.");
    return;
  }
  console.log("[Tyre Quote] Detected wheel:", wheel);
  console.log("[Tyre Quote] Vehicle type:", isModelYL ? "Model YL" : "Model Y");

  // 6️⃣ Map wheel → tyre size using CSV
  if (!window.tyreData || !Array.isArray(window.tyreData)) {
    console.warn("[Tyre Quote] tyreData not loaded");
    return;
  }

  let modelTyres = window.tyreData.filter(t => tyreMatchesSelectedModel(t.Model, modelName));
  if (modelName === "Model Y") {
    // Scrape-based: "Model YL" on page → Continental YL tyres, otherwise standard Model Y
    modelTyres = isModelYL
      ? modelTyres.filter(t => t.Model === "Model YL")
      : modelTyres.filter(t => t.Model !== "Model YL");
  }
  const matchingTyres = modelTyres.filter(t => {
    const match = t.Size.match(/R(\d{2})/);
    return match && parseInt(match[1], 10) === wheel;
  });

  if (matchingTyres.length === 0) {
    console.warn("[Tyre Quote] No tyre size matches model and wheel", modelName, wheel);
    return;
  }

  const uniqueSizes = [...new Set(matchingTyres.map(t => t.Size))];
  const isAmbiguous = uniqueSizes.length >= 2;

  if (isAmbiguous) {
    window.detectedWheelRim = wheel;
    updatePositionRowVisibility();
    console.log("[Tyre Quote] Front/rear selection required for rim size:", wheel);
  } else {
    window.detectedWheelRim = null;
    const tyreSize = matchingTyres[0].Size;
    console.log("[Tyre Quote] Selecting tyre size from CSV:", tyreSize);

    const sizeButtons = document.querySelectorAll("#sizeButtons .btn-option");
    sizeButtons.forEach(btn => {
      if (btn.dataset.size === tyreSize) btn.click();
    });
    await new Promise(r => setTimeout(r, 200));
  }

  // 8️⃣ Auto-select brand — Continental for YL, otherwise the only matching brand for this wheel
  const matchingBrands = [...new Set(matchingTyres.map(t => t.Brand))];
  const brandButtons = [...document.querySelectorAll("#brandButtons .btn-option")]
    .filter(b => !b.classList.contains("disabled"));

  if (isModelYL && modelName === "Model Y") {
    const continentalBtn = brandButtons.find(b => b.dataset.brand === "Continental");
    if (continentalBtn) {
      continentalBtn.click();
      console.log("[Tyre Quote] Auto-selected Continental for Model YL");
      await new Promise(r => setTimeout(r, 200));
      updatePositionRowVisibility();
    }
  } else if (matchingBrands.length === 1) {
    const brandBtn = brandButtons.find(b => b.dataset.brand === matchingBrands[0]);
    if (brandBtn) {
      brandBtn.click();
      console.log("[Tyre Quote] Auto-selected brand:", matchingBrands[0]);
      await new Promise(r => setTimeout(r, 200));
      updatePositionRowVisibility();
    }
  } else if (brandButtons.length === 1) {
    brandButtons[0].click();
    console.log("[Tyre Quote] Auto-selected brand:", brandButtons[0].dataset.brand);
  }

  // 9️⃣ Generate quote (skip if front/rear selection still required)
  const generateBtn = await waitForElement("#generateQuote", 3000);
  if (!isAmbiguous && generateBtn && !generateBtn.disabled) {
    generateBtn.click();
    console.log("[Tyre Quote] Generate button clicked");
  } else if (isAmbiguous) {
    console.warn("[Tyre Quote] Generate skipped — select front or rear tyre first");
  } else {
    console.warn("[Tyre Quote] Generate button disabled or not found");
  }

  // 🔟 Close drawer if we opened it
  if (drawerOpenedBy) {
    await chrome.scripting.executeScript({
      target: getTyreQuoteScriptTarget(tab.id, tab.url),
      func: (openedBy) => {
        const click = el => el?.click();
        if (openedBy === "info") {
          const closeBtn = document.querySelector('img[mattooltip="Close"]');
          if (closeBtn) click(closeBtn);
        } else if (openedBy === "vehicle") {
          const closeBtn = document.getElementById("tcc-log-communication-close");
          if (closeBtn) click(closeBtn);
        }
      },
      args: [drawerOpenedBy]
    });
    console.log("[Tyre Quote] Drawer closed for:", drawerOpenedBy);
  }

  console.log("[Tyre Quote] Auto-select process completed.");
  scrollToQuoteControlsIfNeeded();
  updatePositionRowVisibility();
  if (hasAmbiguousRimSizes() && !selectedPosition) {
    schedulePositionFlash(750);
  }
  } finally {
    window.tyreQuoteAutoFlow = false;
  }
}

// -------------------------
// CSV PARSING
// -------------------------
function parseCsvData(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, i) => obj[header] = values[i] || '');
    return obj;
  });
}

// -------------------------
// UI SETUP
// -------------------------
function setupEventListeners() {
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.addEventListener('change', onModelChange);

  document.getElementById('generateQuote').addEventListener('click', generateQuote);

  document.querySelectorAll('#positionButtons .btn-option').forEach(btn => {
    btn.addEventListener('click', () => togglePosition(btn));
  });

  document.getElementById('copyQuote').addEventListener('click', () => 
    copyTextToClipboard('customerSupportText', 'copyNotificationCustomer', 'Customer quote copied!')
  );

  document.getElementById('copyCustomerQuote').addEventListener('click', () => 
    copyTextToClipboard('quoteText', 'copyNotificationService', 'Service quote copied!')
  );

  if (!document.querySelector('#stepBrandSize img.tyre-diagram')) {
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('TyreQuoteGenerator/tyre_size.png');
    img.alt = 'How to read tyre size';
    img.className = 'tyre-diagram';
    stepBrandSize.prepend(img);
  }

  const regionToggle = document.getElementById('regionToggle');
  chrome.storage.local.get({ region: 'AU' }, (data) => {
    regionToggle.checked = data.region === 'NZ';
  });
  regionToggle.addEventListener('change', () => {
    const selectedRegion = regionToggle.checked ? 'NZ' : 'AU';
    chrome.storage.local.set({ region: selectedRegion });
    console.log('[Tyre Quote] Region set to:', selectedRegion);
    const customerQuote = document.getElementById('customerSupportQuote');
    const serviceQuote = document.getElementById('serviceQuoteSection');
    if ((customerQuote && customerQuote.style.display === 'block') ||
        (serviceQuote && serviceQuote.style.display === 'block')) {
      generateQuote();
    }
  });
}

function populateModels() {
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.innerHTML = '<option value="">Select Model</option>';

  const desiredOrder = ["Model S", "Model 3", "Model X", "Model Y"];
  const csvModels = [...new Set(window.tyreData.map(item => item.Model))];

  desiredOrder.forEach(model => {
    if (csvHasModel(csvModels, model)) {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = MODEL_DISPLAY_NAMES[model] || model;
      modelSelect.appendChild(option);
    }
  });
}

function enableInterface() {
  document.getElementById('modelSelect').disabled = false;
}

// -------------------------
// BUTTON LOGIC (Brand & Size)
// -------------------------
let selectedBrand = null;
let selectedSize = null;
let selectedPosition = null;
let filteredData = [];

function getRimDiameter(size) {
  const match = size.match(/R(\d{2})/i);
  return match ? parseInt(match[1], 10) : null;
}

function getTyreWidth(size) {
  const match = size.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function getRelevantTyreData() {
  if (selectedBrand) {
    return filteredData.filter(t => t.Brand === selectedBrand);
  }
  return filteredData;
}

function getAmbiguousRimGroups(data = getRelevantTyreData()) {
  const byRim = {};
  data.forEach(t => {
    const rim = getRimDiameter(t.Size);
    if (rim == null) return;
    if (!byRim[rim]) byRim[rim] = new Set();
    byRim[rim].add(t.Size);
  });
  return Object.entries(byRim)
    .filter(([, sizes]) => sizes.size >= 2)
    .map(([rim, sizes]) => ({ rim: parseInt(rim, 10), sizes: [...sizes] }));
}

function hasAmbiguousRimSizes() {
  if (!selectedBrand) return false;
  return getAmbiguousRimGroups().length > 0;
}

function resolveSizeForPosition(position, data = getRelevantTyreData(), targetRim = window.detectedWheelRim ?? null) {
  const groups = getAmbiguousRimGroups(data);
  if (groups.length === 0) return null;

  let group;
  if (groups.length === 1) {
    // Only one front/rear pair for this brand — use it regardless of stale auto-detect rim
    group = groups[0];
  } else if (targetRim != null) {
    group = groups.find(g => g.rim === targetRim);
  } else {
    group = groups[0];
  }

  if (!group || group.sizes.length < 2) return null;

  const sizesWithWidth = group.sizes
    .map(size => ({ size, width: getTyreWidth(size) }))
    .sort((a, b) => a.width - b.width);

  return position === "front"
    ? sizesWithWidth[0].size
    : sizesWithWidth[sizesWithWidth.length - 1].size;
}

function selectSizeProgrammatically(size) {
  selectedSize = size;
  document.querySelectorAll('#sizeButtons .btn-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.size === size);
  });
}

function clearPositionSelection() {
  selectedPosition = null;
  document.querySelectorAll('#positionButtons .btn-option').forEach(btn => btn.classList.remove('selected'));
}

function updatePositionRowVisibility() {
  const row = document.getElementById('positionRow');
  if (!row) return;

  const show = hasAmbiguousRimSizes();
  row.style.display = show ? 'block' : 'none';

  if (!show) {
    clearPositionSelection();
    row.classList.remove('needs-selection');
    clearPositionFlash();
    return;
  }

  const needsInput = !selectedPosition;
  row.classList.toggle('needs-selection', needsInput);

  if (needsInput && !window.tyreQuoteAutoFlow) {
    schedulePositionFlash(0);
  } else if (!needsInput) {
    clearPositionFlash();
  }

  if (selectedPosition) {
    const size = resolveSizeForPosition(selectedPosition);
    if (size) {
      selectSizeProgrammatically(size);
    } else {
      clearPositionSelection();
      selectedSize = null;
      document.querySelectorAll('#sizeButtons .btn-option').forEach(btn => btn.classList.remove('selected'));
    }
  }
}

function syncPositionFromSize(size) {
  if (!hasAmbiguousRimSizes()) return;

  const rim = getRimDiameter(size);
  const group = getAmbiguousRimGroups().find(g => g.rim === rim && g.sizes.includes(size));
  if (!group) return;

  const frontSize = resolveSizeForPosition('front', getRelevantTyreData(), rim);
  const rearSize = resolveSizeForPosition('rear', getRelevantTyreData(), rim);

  let position = null;
  if (size === frontSize) position = 'front';
  else if (size === rearSize) position = 'rear';

  selectedPosition = position;
  document.querySelectorAll('#positionButtons .btn-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.position === position);
  });
}

function togglePosition(btn) {
  const position = btn.dataset.position;

  if (selectedPosition === position) {
    clearPositionSelection();
    selectedSize = null;
    document.querySelectorAll('#sizeButtons .btn-option').forEach(s => s.classList.remove('selected'));
  } else {
    selectedPosition = position;
    document.querySelectorAll('#positionButtons .btn-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const size = resolveSizeForPosition(position);
    if (size) selectSizeProgrammatically(size);
  }

  updateSizeCompatibility();
  updateBrandCompatibility();
  updatePositionRowVisibility();
  updateGenerateButton();
}

function onModelChange() {
  const model = document.getElementById('modelSelect').value;
  filteredData = model ? window.tyreData.filter(t => tyreMatchesSelectedModel(t.Model, model)) : [];
  resetButtonGroups();
  populateBrandButtons();
  populateSizeButtons();
  updateBrandCompatibility();
  updatePositionRowVisibility();

  const stepBrandSize = document.getElementById('stepBrandSize');

  if (model) {
    if (stepBrandSize.style.display === 'none') {
      // First time showing: slide down
      stepBrandSize.style.display = 'block';
      stepBrandSize.style.opacity = 0;
      stepBrandSize.style.maxHeight = '0px';

      // trigger reflow for transition
      stepBrandSize.offsetHeight;

      stepBrandSize.style.opacity = 1;
      stepBrandSize.style.maxHeight = '600px'; // large enough to fit content
    }
  } else {
    // Hide with slide-up
    stepBrandSize.style.opacity = 0;
    stepBrandSize.style.maxHeight = '0';
    setTimeout(() => stepBrandSize.style.display = 'none', 400);
  }
}


function resetButtonGroups() {
  document.getElementById('brandButtons').querySelectorAll('.btn-option').forEach(b => b.remove());
  document.getElementById('sizeButtons').querySelectorAll('.btn-option').forEach(s => s.remove());
  selectedBrand = null;
  selectedSize = null;
  clearPositionSelection();
  window.detectedWheelRim = null;
  updatePositionRowVisibility();
  updateGenerateButton();
}

function populateBrandButtons() {
  const container = document.getElementById('brandButtons');
  const brandSet = new Set();

  filteredData.forEach(t => {
    // Split multiple brands in the same field by comma, slash, or semicolon
    const brands = t.Brand.split(/[,/;]/).map(b => b.trim()).filter(Boolean);
    brands.forEach(b => brandSet.add(b));
  });

  brandSet.forEach(brand => {
    const btn = document.createElement('div');
    btn.textContent = BRAND_DISPLAY_NAMES[brand] || brand;
    btn.className = 'btn-option';
    btn.dataset.brand = brand;
    btn.addEventListener('click', () => toggleBrand(btn));
    container.appendChild(btn);
  });
}

function populateSizeButtons() {
  const container = document.getElementById('sizeButtons');
  const sizes = [...new Set(filteredData.map(t => t.Size))];
  sizes.forEach(size => {
    const btn = document.createElement('div');
    btn.textContent = size;
    btn.className = 'btn-option';
    btn.dataset.size = size;
    btn.addEventListener('click', () => toggleSize(btn));
    container.appendChild(btn);
  });
}

// --- Toggle Brand ---
function toggleBrand(btn) {
  if (btn.classList.contains('disabled')) return;

  if (selectedBrand === btn.dataset.brand) {
    selectedBrand = null;
    btn.classList.remove('selected');
    clearPositionSelection();
    updateSizeCompatibility();
    updateBrandCompatibility();
    updatePositionRowVisibility();
    updateGenerateButton();
    return;
  }

  selectedBrand = btn.dataset.brand;
  document.querySelectorAll('#brandButtons .btn-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  const previousSize = selectedSize;
  clearPositionSelection();
  window.detectedWheelRim = null;

  updateSizeCompatibility();

  if (previousSize && filteredData.some(t => t.Brand === selectedBrand && t.Size === previousSize)) {
    selectedSize = previousSize;
    document.querySelectorAll('#sizeButtons .btn-option').forEach(s => {
      s.classList.toggle('selected', s.dataset.size === previousSize);
    });
    syncPositionFromSize(previousSize);
  } else {
    selectedSize = null;
    document.querySelectorAll('#sizeButtons .btn-option').forEach(s => s.classList.remove('selected'));
  }

  updateBrandCompatibility();
  updatePositionRowVisibility();
  updateGenerateButton();
}
function toggleSize(btn) {
  if (btn.classList.contains('disabled')) return;

  if (selectedSize === btn.dataset.size) {
    // unselect if clicked again
    selectedSize = null;
    btn.classList.remove('selected');
    clearPositionSelection();
  } else {
    selectedSize = btn.dataset.size;
    document.querySelectorAll('#sizeButtons .btn-option').forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
    syncPositionFromSize(selectedSize);
  }

  updateSizeCompatibility();
  updateBrandCompatibility();
  updatePositionRowVisibility();
  updateGenerateButton();
}

function updateBrandCompatibility() {
  document.querySelectorAll('#brandButtons .btn-option').forEach(brandBtn => {
    // Size-first only: once a brand is chosen, keep all brands switchable
    if (selectedBrand || !selectedSize) {
      brandBtn.classList.remove('disabled');
      return;
    }
    const match = filteredData.find(t => t.Size === selectedSize && t.Brand === brandBtn.dataset.brand);
    brandBtn.classList.toggle('disabled', !match);
  });
}

function updateSizeCompatibility() {
  document.querySelectorAll('#sizeButtons .btn-option').forEach(sizeBtn => {
    const match = selectedBrand ? filteredData.find(t => t.Brand === selectedBrand && t.Size === sizeBtn.dataset.size) : true;
    if (!match) {
      sizeBtn.classList.add('disabled');
      if (selectedSize === sizeBtn.dataset.size) selectedSize = null;
    } else {
      sizeBtn.classList.remove('disabled');
    }
  });
}

// --- Generate Quote Button ---
function updateGenerateButton() {
  const generateBtn = document.getElementById('generateQuote');
  const positionRequired = hasAmbiguousRimSizes();
  const positionValid = !positionRequired || selectedPosition;
  const validSelection = selectedBrand && selectedSize && positionValid &&
    filteredData.some(t => t.Brand === selectedBrand && t.Size === selectedSize);
  
  generateBtn.disabled = !validSelection;
  
  // Green styling
  if (validSelection) {
    generateBtn.style.background = '#27ae60'; // green
    generateBtn.style.color = '#fff';
  } else {
    generateBtn.style.background = '#bdc3c7'; // greyed out
    generateBtn.style.color = '#666';
  }

  updatePositionRowVisibility();
}

// -------------------------
// QUOTE GENERATION
// -------------------------
function generateQuote() {
  const model = document.getElementById("modelSelect").value;
  if (!model || !selectedBrand || !selectedSize) {
    alert("Please select Model, Brand, and Size.");
    return;
  }

  if (hasAmbiguousRimSizes() && !selectedPosition) {
    alert("Please select Front or Rear tyre.");
    return;
  }

  const matchingTyre = window.tyreData.find(item =>
    tyreMatchesSelectedModel(item.Model, model) &&
    item.Brand === selectedBrand &&
    item.Size === selectedSize
  );

  if (!matchingTyre) {
    alert("No matching tyre found in database.");
    return;
  }

  chrome.storage.local.get({ region: 'AU' }, (data) => {
    const isNZ = data.region === 'NZ';
    const currencyLabel = isNZ ? 'NZD' : '$';

    const tyrePrice = parseFloat(matchingTyre["SCA Price"] || 0);
    const labourCost = parseFloat(matchingTyre["Labour Cost"] || 0);
    const disposalCost = parseFloat(matchingTyre["Disposal Cost"] || 0);
    const preGstSubtotal = tyrePrice + labourCost + disposalCost;
    let singleTyreReplacement;
    if (isNZ) {
      singleTyreReplacement = preGstSubtotal;
    } else {
      const gst = preGstSubtotal * 0.1;
      singleTyreReplacement = preGstSubtotal + gst;
    }

    const tyreRepairPrice = 95;
    const repairDisplay = isNZ ? 'NZD' : `${currencyLabel}${tyreRepairPrice.toFixed(2)}`;
    const replacementDisplay = isNZ ? 'NZD' : `${currencyLabel}${singleTyreReplacement.toFixed(2)}`;

    const customerSupport = document.getElementById("customerSupportQuote");
    const customerSupportText = document.getElementById("customerSupportText");

    customerSupportText.textContent = `    
Tyre Information:
  • Model: Tesla ${model}
  • Brand: ${selectedBrand}
  • Size: ${selectedSize}
  • Part Number: ${matchingTyre["Part Number"]}

Pricing:
  • Tyre Repair: ${repairDisplay}
  • Tyre Replacement: ${replacementDisplay}
  `;
    customerSupport.style.display = "block";
    setTimeout(() => customerSupport.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const serviceQuote = document.getElementById("serviceQuoteSection");
    const quoteText = document.getElementById("quoteText");

    quoteText.textContent = `
Tyre Repair Approval Confirmation and Next Steps

You have accepted the quote for Tesla's tyre repair cost which is ${repairDisplay}.

Once your wheel arrives at Tesla, our technicians will assess the tyre to confirm the cause of the leak. If the leak is unrepairable, the tyre will require replacement.

You can speed up your service by pre-approving your tyre replacement quote, if required, by approving the cost estimate when it becomes visible in your app.

Cost of Tyre Replacement: ${replacementDisplay}

Tyre Information:
  • Model: Tesla ${model}
  • Brand: ${selectedBrand}
  • Size: ${selectedSize}
  • Part Number: ${matchingTyre["Part Number"]}

Once your tyre has been repaired, your local service centre will contact you to schedule a convenient time to reinstall your wheel.

You can monitor your service status in real-time and reply with any questions through the Tesla App.

Thank you,
Tesla Service
    `;
    serviceQuote.style.display = "block";
  });
}

// -------------------------
// COPY QUOTE
// -------------------------
function copyTextToClipboard(elementId, notificationId = 'copyNotification', notificationMsg = "Copied to Clipboard") {
  const text = document.getElementById(elementId)?.innerText || "";
  const notification = document.getElementById(notificationId);

  if (!text.trim()) return showNotification("Error: Nothing to Copy", notification);

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showNotification(notificationMsg, notification))
      .catch(() => showNotification("Failed to copy.", notification));
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const success = document.execCommand('copy');
      showNotification(success ? notificationMsg : "Failed to copy.", notification);
    } catch {
      showNotification("Failed to copy.", notification);
    }
    document.body.removeChild(textArea);
  }
}

function showNotification(msg, notification) {
  if (!notification) return;
  notification.textContent = msg;
  notification.classList.add('show');

  setTimeout(() => notification.classList.remove('show'), 1500);
}