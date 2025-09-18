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

    // Skip pages that cannot be scripted
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

  // Optional: auto-select brand/size if only one option
  setTimeout(() => {
    const brandSelect = document.getElementById('brandSelect');
    if (brandSelect && brandSelect.options.length === 2) {
      brandSelect.selectedIndex = 1;
      brandSelect.dispatchEvent(new Event("change"));
    }

    const sizeSelect = document.getElementById('sizeSelect');
    if (sizeSelect && sizeSelect.options.length === 2) {
      sizeSelect.selectedIndex = 1;
      sizeSelect.dispatchEvent(new Event("change"));
    }
  }, 50);
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
  const brandSelect = document.getElementById('brandSelect');
  const sizeSelect = document.getElementById('sizeSelect');

  modelSelect.addEventListener('change', onModelChange);
  brandSelect.addEventListener('change', onBrandChange);
  sizeSelect.addEventListener('change', onSizeChange);

  document.getElementById('generateQuote').addEventListener('click', generateQuote);
  document.getElementById('copyQuote').addEventListener('click', copyQuoteToClipboard);
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
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.disabled = false;
}

// -------------------------
// SELECT CHANGE HANDLERS
// -------------------------
let filteredData = [];

function onModelChange() {
  const modelSelect = document.getElementById('modelSelect');
  const selectedModel = modelSelect.value;

  resetDownstreamSelects(['brand','size']); 
  if (selectedModel) {
    filteredData = window.tyreData.filter(item => item.Model === selectedModel);
    populateBrands();
    document.getElementById('brandSelect').disabled = false; 
  } else {
    document.getElementById('brandSelect').disabled = true;
  }
}


function populateBrands() {
  const brandSelect = document.getElementById('brandSelect');
  const brands = [...new Set(filteredData.map(item => item.Brand))].sort();

  brandSelect.innerHTML = '<option value="">Select Brand</option>';
  brands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    brandSelect.appendChild(option);
  });
}

function onBrandChange() {
  const brandSelect = document.getElementById('brandSelect');
  const sizeSelect = document.getElementById('sizeSelect');

  const selectedBrand = brandSelect.value;
  console.log('Brand changed:', selectedBrand);

  resetDownstreamSelects(['size']);
  if (selectedBrand) {
    const currentFiltered = filteredData.filter(item => item.Brand === selectedBrand);
    populateSizes(currentFiltered);
    sizeSelect.disabled = false;
  } else sizeSelect.disabled = true;
}

function populateSizes(data) {
  const sizeSelect = document.getElementById('sizeSelect');
  const sizes = [...new Set(data.map(item => item.Size))].sort();

  sizeSelect.innerHTML = '<option value="">Select Size</option>';
  sizes.forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    sizeSelect.appendChild(option);
  });
}

function onSizeChange() {
  const sizeSelect = document.getElementById('sizeSelect');
  document.getElementById('generateQuote').disabled = !sizeSelect.value;
}

function resetDownstreamSelects(types) {
  const brandSelect = document.getElementById('brandSelect');
  const sizeSelect = document.getElementById('sizeSelect');
  const generateBtn = document.getElementById('generateQuote');
  const customerQuote = document.getElementById('customerSupportQuote');

  if (types.includes('brand') && brandSelect) {
    brandSelect.innerHTML = '<option value="">Select Brand</option>';
    brandSelect.disabled = true;
  }
  if (types.includes('size') && sizeSelect) {
    sizeSelect.innerHTML = '<option value="">Select Size</option>';
    sizeSelect.disabled = true;
  }

  generateBtn.disabled = true;
  if (customerQuote) customerQuote.style.display = 'none';
}



// -------------------------
// QUOTE GENERATION
// -------------------------
function generateQuote() {
  const selections = {
    model: document.getElementById("modelSelect").value,
    brand: document.getElementById("brandSelect").value,
    size: document.getElementById("sizeSelect").value,
  };

  if (!selections.model || !selections.brand || !selections.size) {
    alert("Please select Model, Brand, and Size.");
    return;
  }

  const matchingTyre = window.tyreData.find(item =>
    item.Model === selections.model &&
    item.Brand === selections.brand &&
    item.Size === selections.size
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
    if (!isNZ) singleTyreReplacement *= 1.1; // GST for AU

    // FIX: Tyre Repair always 95
    const tyreRepairPrice = 95;

    // If NZ, override all prices to display as NZD text instead of numbers
    const repairDisplay = isNZ ? 'NZD' : `${currencyLabel}${tyreRepairPrice.toFixed(2)}`;
    const replacementDisplay = isNZ ? 'NZD' : `${currencyLabel}${singleTyreReplacement.toFixed(2)}`;

    // --- Customer Support Section ---
    const customerSupport = document.getElementById("customerSupportQuote");
    const customerSupportText = document.getElementById("customerSupportText");

    customerSupportText.textContent = `    
Tyre Information:
  • Model: Tesla ${selections.model}
  • Brand: ${selections.brand}
  • Size: ${selections.size}
  • Part Number: ${matchingTyre["Part Number"]}

Pricing:
  • Tyre Repair: ${repairDisplay}
  • Tyre Replacement: ${replacementDisplay}
  `;

    customerSupport.style.display = "block";

    setTimeout(() => {
      customerSupport.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    // --- Tesla Service Section ---
    const serviceQuote = document.getElementById("serviceQuoteSection");
    const quoteText = document.getElementById("quoteText");

    quoteText.textContent = `
Tyre Repair Approval Confirmation and Next Steps

This message is to confirm your pre-approval of Tesla's tyre repair cost which is ${repairDisplay}.

Once your wheel arrives at Tesla, our technicians will assess the tyre to confirm the cause of the leak. If the leak is unrepairable, the tyre will require replacement.

Cost of Tyre Replacement: ${replacementDisplay}

Tyre Information:
  • Model: Tesla ${selections.model}
  • Brand: ${selections.brand}
  • Size: ${selections.size}
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
    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
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


// -------------------------
// REGION TOGGLE (AU/NZ)
// -------------------------
document.addEventListener('DOMContentLoaded', () => {
  const regionToggle = document.getElementById('regionToggle');

  chrome.storage.local.get({ region: 'AU' }, (data) => {
    regionToggle.checked = data.region === 'NZ';
  });

  regionToggle.addEventListener('change', () => {
    const selectedRegion = regionToggle.checked ? 'NZ' : 'AU';
    chrome.storage.local.set({ region: selectedRegion });
    console.log('[Tyre Quote] Region set to:', selectedRegion);

    // Grab the quote sections
    const customerQuote = document.getElementById('customerSupportQuote');
    const serviceQuote = document.getElementById('serviceQuoteSection');

    // If a quote is currently displayed, regenerate it with the new region
    if ((customerQuote && customerQuote.style.display === 'block') ||
        (serviceQuote && serviceQuote.style.display === 'block')) {
      generateQuote();
    }
  });
});