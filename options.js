document.addEventListener("DOMContentLoaded", () => {
    // Display the list of shortcuts when the page loads
    displayShortcuts();

    // Event listener for the 'Add Shortcut' button
    document.getElementById("addShortcutBtn").addEventListener("click", () => {
        const shortcut = document.getElementById("shortcutInput").value.trim(); // Get the shortcut
        const expandedText = document.getElementById("expandedTextInput").innerHTML.trim(); // Get the expanded text

        // If both fields are filled
        if (shortcut && expandedText) {
            // Retrieve existing shortcuts from local storage
            chrome.storage.local.get("shortcuts", (data) => {
                if (chrome.runtime.lastError) {
                    console.error("Error retrieving shortcuts:", chrome.runtime.lastError);
                    return;
                }

                const shortcuts = data.shortcuts || {};

                // Check if the shortcut already exists, if so prompt for overwriting
                if (shortcuts[shortcut] && !confirm(`Shortcut "${shortcut}" already exists. Overwrite?`)) {
                    return;
                }

                // Add or update the shortcut in the shortcuts object
                shortcuts[shortcut] = expandedText;

                // Save the updated shortcuts back to local storage
                chrome.storage.local.set({ shortcuts }, () => {
                    displayShortcuts(); // Refresh the shortcut list
                    clearInputs(); // Clear the input fields
                });
            });
        } else {
            alert("Please fill in both fields (Shortcut and Expanded Text).");
        }
    });

    // Event listener for saving shortcuts to a file
    document.getElementById("saveShortcutsBtn").addEventListener("click", () => {
        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};
            if (Object.keys(shortcuts).length > 0) {
                // Create a Blob for saving the shortcuts as a JSON file
                const blob = new Blob([JSON.stringify(shortcuts, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "shortcuts.json"; // File name for download
                a.click();
    
                // Copy the entire shortcuts JSON to clipboard
                const shortcutsJSON = JSON.stringify(shortcuts, null, 2);
                navigator.clipboard.writeText(shortcutsJSON).then(() => {
                    console.log("Shortcuts copied to clipboard.");
                }).catch((err) => {
                    console.error("Failed to copy shortcuts to clipboard: ", err);
                });
            } else {
                alert("No shortcuts to save.");
            }
        });
    });

    // Event listeners for text formatting buttons (Bold, Italic, Underline, etc.)
    document.getElementById("boldBtn").addEventListener("click", () => document.execCommand('bold'));
    document.getElementById("italicBtn").addEventListener("click", () => document.execCommand('italic'));
    document.getElementById("underlineBtn").addEventListener("click", () => document.execCommand('underline'));
    document.getElementById("numberedListBtn").addEventListener("click", () => document.execCommand('insertOrderedList'));
    document.getElementById("bulletListBtn").addEventListener("click", () => document.execCommand('insertUnorderedList'));

    // Event listener for inserting a link
    document.getElementById("linkBtn").addEventListener("click", () => {
        const url = prompt("Enter the link URL:");
        if (url) {
            document.execCommand('createLink', false, url);
        }
    });

    // Event listener to clear text formatting
    document.getElementById("clearFormattingBtn").addEventListener("click", () => document.execCommand('removeFormat'));
});

function displayShortcuts() {
    chrome.storage.local.get("shortcuts", (data) => {
        if (chrome.runtime.lastError) {
            console.error("Error retrieving shortcuts:", chrome.runtime.lastError);
            return;
        }

        const shortcuts = data.shortcuts || {};
        const listDiv = document.getElementById("shortcutList");
        listDiv.innerHTML = ""; // Clear the current list

        // If there are shortcuts saved, display them
        if (Object.keys(shortcuts).length > 0) {
            for (const [shortcut, expandedText] of Object.entries(shortcuts)) {
                const div = document.createElement("div");
                div.classList.add("shortcut-item");
                div.innerHTML = `
                    <strong>${shortcut}</strong>: <span class="expanded-text">${expandedText}</span>
                    <button class="deleteBtn" data-shortcut="${shortcut}">Delete</button>
                `;
                listDiv.appendChild(div);

                // Event listeners for delete buttons next to each shortcut
                document.querySelectorAll(".deleteBtn").forEach(button => {
                    button.addEventListener("click", (event) => {
                        const shortcutToDelete = event.target.getAttribute("data-shortcut");
                        // Confirm before deleting
                        if (confirm(`Are you sure you want to delete the shortcut "${shortcutToDelete}"?`)) {
                            deleteShortcut(shortcutToDelete);
                        }
                    });
                });
            }
        } else {
            listDiv.innerHTML = "<p class='empty-list'>No shortcuts saved yet.</p>";
        }
    });
}

function deleteShortcut(shortcut) {
    chrome.storage.local.get("shortcuts", (data) => {
        if (chrome.runtime.lastError) {
            console.error("Error deleting shortcut:", chrome.runtime.lastError);
            return;
        }

        const shortcuts = data.shortcuts || {};
        if (shortcuts[shortcut]) {
            delete shortcuts[shortcut]; // Remove the shortcut from the object
            chrome.storage.local.set({ shortcuts }, displayShortcuts); // Save the updated shortcuts and refresh the list
        }
    });
}

function clearInputs() {
    document.getElementById("shortcutInput").value = ""; // Clear the shortcut input
    document.getElementById("expandedTextInput").innerHTML = ""; // Clear the expanded text input
}
