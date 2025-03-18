chrome.action.onClicked.addListener(async () => {
  // Look for a tab with the Towbook URL
  const tabs = await chrome.tabs.query({ url: "https://app.towbook.com/DS4/" });

  console.log('Found Towbook tabs:', tabs.length);  // Log the number of Towbook tabs found

  if (tabs.length === 0) {
    // If no Towbook tab is found, open the options page
    console.log('No Towbook tab found, opening options.html');
    await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  } else {
    // If Towbook tab is found, extract data from rows
    const towbookTab = tabs[0];  // Assuming there's only one Towbook tab open

    // Inject a script into the Towbook tab to extract job data
    chrome.scripting.executeScript({
      target: { tabId: towbookTab.id },
      func: extractRowData
    }, (injectedResult) => {
      const rowDictionary = injectedResult[0].result;
      console.log('Extracted Row Dictionary:', rowDictionary);  // Print the dictionary of call-number to row title

      // Now send extracted data to options.html after ensuring it is fully loaded
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }, (tab) => {
        // Send extracted data to options.html once the tab is created
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            // Now send the data
            chrome.tabs.sendMessage(tab.id, {
              type: 'extractedData',
              data: rowDictionary
            });
          }
        });
      });
    });
  }
});

// Function to extract the titles and call-numbers from rows in the table
function extractRowData() {
  const rowDictionary = {};

  // Select all li elements with the class "entryRow"
  const rows = document.querySelectorAll('li.entryRow');

  // Loop through the rows to extract call-number, title, vin, and driver
  rows.forEach(row => {
    // Extract the title from the span with columnid="10"
    const span = row.querySelector('div.content div.content-top div.header.col-x-wide div span[columnid="10"]');
    if (span) {
      const vin = span.getAttribute('title');  // Get the row title (job ID)
      
      // Extract the driver from the same row (adjust this selector based on where driver info is located)
      const driverElement = row.querySelector('div.content div.content-top ul.details1 div[columnid="5"]');
      const driver = driverElement ? driverElement.innerText.trim() : 'Unknown';  // Extract driver name or 'Unknown'

      // Extract the call-number from the li with class "call-number"
      const callNumberElement = row.querySelector('div.left-bar li.call-number');
      if (callNumberElement) {
        const callNumber = callNumberElement.innerText.trim();  // Get the call number text

        // Add the call number, vin, and driver to the row dictionary
        rowDictionary[callNumber] = {
          vin: vin,
          driver: driver,  // Store the driver information
        };
      }
    }
  });

  return rowDictionary;
}
