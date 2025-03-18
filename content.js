// Function to extract all <li class="entryRow"> elements from <ul class="entriesTable">
function extractEntryRows() {
    // Select the <ul class="entriesTable">
    const entriesTable = document.querySelector('.entriesTable');
    
    // Check if the entriesTable exists on the page
    if (entriesTable) {
      console.log('Found entriesTable:', entriesTable);
      
      // Now extract all the <li class="entryRow"> inside it
      const entryRows = entriesTable.querySelectorAll('li.entryRow');
      
      console.log('Found entry rows:', entryRows.length);  // Log the number of entry rows
      
      // Loop through each entry row and log it
      entryRows.forEach((row, index) => {
        console.log(`Entry Row ${index + 1}:`, row);  // Log each <li class="entryRow">
      });
    } else {
      console.log('No entriesTable found on the page');
    }
  }
  
  // Run the function when the content script is executed
  extractEntryRows();
  