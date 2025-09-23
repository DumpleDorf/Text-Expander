console.log("tyreQuoteGenerator.js loaded");

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

    // Auto-detect VIN and select model
    await handleVinAutoSelect();
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
    if (!tab.url.startsWith("https://")) return null;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const allText = document.body.innerText;
        const vinMatch = allText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
        return vinMatch ? vinMatch[0] : null;
      }
    });

    return results[0]?.result || null;
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
  document.getElementById('copyQuote').addEventListener('click', copyQuoteToClipboard);

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
    if (csvModels.includes(model)) {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
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
let filteredData = [];

function onModelChange() {
  const model = document.getElementById('modelSelect').value;
  filteredData = model ? window.tyreData.filter(t => t.Model === model) : [];
  resetButtonGroups();
  populateBrandButtons();
  populateSizeButtons();

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
      stepBrandSize.style.maxHeight = '500px'; // large enough to fit content
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
    btn.textContent = brand;
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
    // unselect if clicked again
    selectedBrand = null;
    btn.classList.remove('selected');
  } else {
    selectedBrand = btn.dataset.brand;
    document.querySelectorAll('#brandButtons .btn-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  updateSizeCompatibility();
  updateGenerateButton();
}

// --- Toggle Size ---
function toggleSize(btn) {
  if (btn.classList.contains('disabled')) return;

  if (selectedSize === btn.dataset.size) {
    // unselect if clicked again
    selectedSize = null;
    btn.classList.remove('selected');
  } else {
    selectedSize = btn.dataset.size;
    document.querySelectorAll('#sizeButtons .btn-option').forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
  }

  updateBrandCompatibility();
  updateGenerateButton();
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

function updateBrandCompatibility() {
  document.querySelectorAll('#brandButtons .btn-option').forEach(brandBtn => {
    const match = selectedSize ? filteredData.find(t => t.Size === selectedSize && t.Brand === brandBtn.dataset.brand) : true;
    if (!match) {
      brandBtn.classList.add('disabled');
      if (selectedBrand === brandBtn.dataset.brand) selectedBrand = null;
    } else {
      brandBtn.classList.remove('disabled');
    }
  });
}

// --- Generate Quote Button ---
function updateGenerateButton() {
  const generateBtn = document.getElementById('generateQuote');
  const validSelection = selectedBrand && selectedSize &&
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

  const matchingTyre = window.tyreData.find(item =>
    item.Model === model &&
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

    const basePrice = parseFloat(matchingTyre["SCA Price"] || 0);
    const singleLabour = parseFloat(matchingTyre["Single Tyre Labour + Disposal"] || 0);
    let singleTyreReplacement = basePrice + singleLabour;
    if (!isNZ) singleTyreReplacement *= 1.1;

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

This message is to confirm your pre-approval of Tesla's tyre repair cost which is ${repairDisplay}.

Once your wheel arrives at Tesla, our technicians will assess the tyre to confirm the cause of the leak. If the leak is unrepairable, the tyre will require replacement.

Cost of Tyre Replacement: ${replacementDisplay}

Tyre Information:
  • Model: Tesla ${model}
  • Brand: ${selectedBrand}
  • Size: ${selectedSize}
  • Part Number: ${matchingTyre["Part Number"]}

To pre-approve the tyre replacement (if required), reply "YES".

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
function copyQuoteToClipboard() {
  const quoteText = document.getElementById('quoteText').innerText || "";
  const notification = document.getElementById('copyNotification');

  if (!quoteText) {
    showNotification("No quote to copy!");
    return;
  }

  function showNotification(msg) {
    notification.textContent = msg;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 2000);
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(quoteText)
      .then(() => showNotification("Quote copied!"))
      .catch(() => showNotification("Failed to copy quote."));
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = quoteText;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const success = document.execCommand('copy');
      showNotification(success ? "Quote copied!" : "Failed to copy.");
    } catch {
      showNotification("Failed to copy quote.");
    }
    document.body.removeChild(textArea);
  }
}
