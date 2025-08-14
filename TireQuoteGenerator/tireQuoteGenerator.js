  console.log("popup.js loaded");

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch(chrome.runtime.getURL("../TireQuoteGenerator/tire_prices.csv"));
      if (!response.ok) throw new Error('Failed to fetch CSV');

      const csvText = await response.text();
      console.log('CSV text:', csvText.slice(0, 200)); 

      const data = parseCsvData(csvText);
      console.log('Parsed CSV data:', data);

      if (data.length === 0) {
        throw new Error('No data found in CSV');
      }

      window.tireData = data; 

      setupEventListeners();

      populateModels();
      enableInterface();
    } catch (error) {
      console.error('Error loading local CSV:', error);
      alert('Error loading tire data. See console.');
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const landingPage = document.getElementById('landingPage');
    const tireQuoteSection = document.getElementById('tireQuoteSection');
    const backBtn = document.getElementById('backBtn');

    document.getElementById('tireQuoteBtn').addEventListener('click', () => {
      landingPage.style.display = 'none';
      tireQuoteSection.style.display = 'block';
    });

    backBtn.addEventListener('click', () => {
      tireQuoteSection.style.display = 'none';
      landingPage.style.display = 'flex';
    });
  });


  function setupEventListeners() {
    const modelSelect = document.getElementById('modelSelect');
    // const yearSelect = document.getElementById('yearSelect');
    const brandSelect = document.getElementById('brandSelect');
    const sizeSelect = document.getElementById('sizeSelect');

    modelSelect.addEventListener('change', onModelChange);
    // yearSelect.addEventListener('change', onYearChange);
    brandSelect.addEventListener('change', onBrandChange);
    sizeSelect.addEventListener('change', onSizeChange);
  }

  function parseCsvData(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  function populateModels() {
    const models = [...new Set(window.tireData.map(item => item.Model))].sort();
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = '<option value="">Select Model</option>';
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
  }

  function enableInterface() {
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.disabled = false;
  }

  let filteredData = [];

  // function onModelChange() {
  //   const modelSelect = document.getElementById('modelSelect');
  //   const yearSelect = document.getElementById('yearSelect');

  //   const selectedModel = modelSelect.value;
  //   console.log('Model changed:', selectedModel);

  //   resetDownstreamSelects(['year', 'brand', 'size']);

  //   if (selectedModel) {
  //     filteredData = window.tireData.filter(item => item.Model === selectedModel);
  //     console.log('Filtered data length:', filteredData.length);
  //     console.log('Sample filtered data:', filteredData[0]);

  //     populateYears();
  //     yearSelect.disabled = false;
  //   } else {
  //     yearSelect.disabled = true;
  //   }
  // }

  function onModelChange() {
    const modelSelect = document.getElementById('modelSelect');

    const selectedModel = modelSelect.value;
    console.log('Model changed:', selectedModel);

    resetDownstreamSelects(['brand', 'size']);

    if (selectedModel) {
      filteredData = window.tireData.filter(item => item.Model === selectedModel);
      console.log('Filtered data length:', filteredData.length);
      console.log('Sample filtered data:', filteredData[0]);

      populateBrands();
      document.getElementById('brandSelect').disabled = false;
    } else {
      document.getElementById('brandSelect').disabled = true;
    }
  }

  // Commenting out as Year is no longer Required

  // function populateYears() {
  //   const yearSelect = document.getElementById('yearSelect');
  //   const years = [...new Set(filteredData.map(item => item.Year))].sort((a, b) => b - a);
  //   console.log('Available years:', years);

  //   yearSelect.innerHTML = '<option value="">Select Year</option>';
  //   years.forEach(year => {
  //     const option = document.createElement('option');
  //     option.value = year;
  //     option.textContent = year;
  //     yearSelect.appendChild(option);
  //   });
  // }

  // function onYearChange() {
  //   const yearSelect = document.getElementById('yearSelect');
  //   const brandSelect = document.getElementById('brandSelect');

  //   const selectedYear = yearSelect.value;
  //   console.log('Year changed:', selectedYear);

  //   resetDownstreamSelects(['brand', 'size']);

  //   if (selectedYear) {
  //     filteredData = filteredData.filter(item => item.Year === selectedYear);
  //     console.log('Filtered data length after year:', filteredData.length);
  //     populateBrands();
  //     brandSelect.disabled = false;
  //   } else {
  //     brandSelect.disabled = true;
  //     // Reset filteredData back to model level when year is unselected
  //     const modelSelect = document.getElementById('modelSelect');
  //     filteredData = window.tireData.filter(item => item.Model === modelSelect.value);
  //   }
  // }

  function populateBrands() {
    const brandSelect = document.getElementById('brandSelect');
    const brands = [...new Set(filteredData.map(item => item.Brand))].sort();
    console.log('Available brands:', brands);

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
      console.log('Filtered data length after brand:', currentFiltered.length);
      populateSizes(currentFiltered);
      sizeSelect.disabled = false;
    } else {
      sizeSelect.disabled = true;
    }
  }

  function populateSizes(data) {
    const sizeSelect = document.getElementById('sizeSelect');
    const sizes = [...new Set(data.map(item => item.Size))].sort();
    console.log('Available sizes:', sizes);

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
    const generateBtn = document.getElementById('generateQuote');

    const selectedSize = sizeSelect.value;
    console.log('Size changed:', selectedSize);

    generateBtn.disabled = !selectedSize;
  }

  function resetDownstreamSelects(types) {
    // const yearSelect = document.getElementById('yearSelect');
    const brandSelect = document.getElementById('brandSelect');
    const sizeSelect = document.getElementById('sizeSelect');
    const generateBtn = document.getElementById('generateQuote');
    const quoteSection = document.getElementById('quoteSection');

    // Year no longer Required

    // if (types.includes('year')) {
    //   yearSelect.innerHTML = '<option value="">Select Year</option>';
    //   yearSelect.disabled = true;
    // }
    if (types.includes('brand')) {
      brandSelect.innerHTML = '<option value="">Select Brand</option>';
      brandSelect.disabled = true;
    }
    if (types.includes('size')) {
      sizeSelect.innerHTML = '<option value="">Select Size</option>';
      sizeSelect.disabled = true;
    }

    generateBtn.disabled = true;
    quoteSection.style.display = 'none';
  }

  document.getElementById('generateQuote').addEventListener('click', generateQuote);

  function generateQuote() {
    const modelSelect = document.getElementById('modelSelect');
    const brandSelect = document.getElementById('brandSelect');
    const sizeSelect = document.getElementById('sizeSelect');
    const quoteSection = document.getElementById('quoteSection');
    const quoteText = document.getElementById('quoteText');

    const selections = {
      model: modelSelect.value,
      brand: brandSelect.value,
      size: sizeSelect.value
    };

    console.log('Generate Quote with selections:', selections);

    const matchingTire = window.tireData.find(item =>
      item.Model === selections.model &&
      item.Brand === selections.brand &&
      item.Size === selections.size
    );

    if (!matchingTire) {
      alert('No matching tire found for your selections.');
      return;
    }

    const currentDate = new Date().toLocaleDateString();
    const tyrePrice = parseFloat(matchingTire.Price) || 0;
    const labourPrice = 48; // before GST
    const gstRate = 0.10;

    // Prices excl GST
    const oneTyreExclGst = tyrePrice + labourPrice;
    const fourTyresExclGst = (tyrePrice * 4) + (labourPrice * 4);

    // Prices incl GST
    const oneTyreInclGst = oneTyreExclGst * (1 + gstRate);
    const fourTyresInclGst = fourTyresExclGst * (1 + gstRate);

    const quote = `
  TESLA TIRE QUOTE
  Date: ${currentDate}

  Tyre Information:
  • Model: Tesla ${selections.model}
  • Brand: ${selections.brand}
  • Size: ${selections.size}

  Pricing (Excl. GST, includes fitment):
  • Price for ONE tyre: $${oneTyreExclGst.toFixed(2)}
  • Price for FOUR tyres: $${fourTyresExclGst.toFixed(2)}

  Final Pricing (Incl. GST):
  • Price for ONE tyre: $${oneTyreInclGst.toFixed(2)}
  • Price for FOUR tyres: $${fourTyresInclGst.toFixed(2)}

  Additional Information:
  • Installation: Included in fitment
  • Quote valid for 30 days

  Thank you for helping to accelerate the world's transition to sustainable energy,
  Tesla Support
    `;

    quoteText.textContent = quote;
    quoteSection.style.display = 'block';
    quoteSection.scrollIntoView({ behavior: 'smooth' });
  }

  const copyBtn = document.getElementById('copyQuote');
  const quoteTextEl = document.getElementById('quoteText');
  const notification = document.getElementById('copyNotification');

  copyBtn.addEventListener('click', () => {
    const quoteText = quoteTextEl.innerText || "";
    if (!quoteText) {
      showNotification("No quote to copy!");
      return;
    }

    function showNotification(message) {
      notification.textContent = message;
      notification.classList.add('show');
      setTimeout(() => {
        notification.classList.remove('show');
      }, 2000); // visible for 2 seconds, then fade out
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(quoteText).then(() => {
        showNotification("Quote copied to clipboard!");
      }).catch(() => {
        showNotification("Failed to copy quote.");
      });
    } else {
      // fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = quoteText;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        showNotification(successful ? "Quote copied to clipboard!" : "Failed to copy quote.");
      } catch {
        showNotification("Failed to copy quote.");
      }

      document.body.removeChild(textArea);
    }
  });
