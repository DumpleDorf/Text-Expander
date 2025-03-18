// Listen for messages sent from background.js (e.g., after extracting the data)
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'extractedData') {
      const rowDictionary = message.data;
      displayEntries(rowDictionary);  // Call function to display the extracted dictionary
    }
  });

  function displayEntries(rowDictionary) {
    const entriesContainer = document.getElementById('entries-container');
    if (!entriesContainer) {
      console.error('entries-container not found!');
      return;
    }
  
    entriesContainer.innerHTML = '';  // Clear any existing entries
  
    if (!rowDictionary || Object.keys(rowDictionary).length === 0) {
      console.log('No entries to display');
      return;
    }
  
    // Loop through the extracted dictionary and create HTML for each entry
    for (const [callNumber, entry] of Object.entries(rowDictionary)) {
      const entryDiv = document.createElement('div');
      entryDiv.classList.add('entry');
  
      const callNumberDiv = document.createElement('div');
      callNumberDiv.classList.add('call-number');
      callNumberDiv.innerText = `Call Number: ${callNumber}`;
  
      const vinDiv = document.createElement('div');
      vinDiv.innerText = `VIN: ${entry.vin}`;
  
      const driverDiv = document.createElement('div');
      driverDiv.innerText = `Driver: ${entry.driver}`;
  
      entryDiv.appendChild(callNumberDiv);
      entryDiv.appendChild(vinDiv);
      entryDiv.appendChild(driverDiv);
  
      entriesContainer.appendChild(entryDiv);
    }
  }
  
  