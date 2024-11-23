document.addEventListener("DOMContentLoaded", () => {
    displayShortcuts();

    document.getElementById("addShortcutBtn").addEventListener("click", () => {
        const shortcut = document.getElementById("shortcutInput").value.trim(); // Get the shortcut
        const expandedText = document.getElementById("expandedTextInput").innerHTML.trim(); // Get the expanded text

        if (shortcut && expandedText) {
            chrome.storage.local.get("shortcuts", (data) => {
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

    document.getElementById("clearAllBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all shortcuts?")) {
            chrome.storage.local.set({ shortcuts: {} }, displayShortcuts);
        }
    });

    // Handle rich text formatting buttons (bold, italic, etc.)
    document.getElementById("boldBtn").addEventListener("click", () => {
        document.execCommand("bold");
    });

    document.getElementById("italicBtn").addEventListener("click", () => {
        document.execCommand("italic");
    });

    document.getElementById("underlineBtn").addEventListener("click", () => {
        document.execCommand("underline");
    });

    document.getElementById("imageBtn").addEventListener("click", () => {
        const imageUrl = prompt("Enter image URL:");
        if (imageUrl) {
            const imgTag = `<img src="${imageUrl}" alt="Image">`;
            document.getElementById("expandedTextInput").innerHTML += imgTag; // Insert image in the editor
        }
    });
});

// Function to display the list of saved shortcuts
function displayShortcuts() {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        const shortcutList = document.getElementById("shortcutList");
        shortcutList.innerHTML = ""; // Clear the current list

        for (const [shortcut, expanded] of Object.entries(shortcuts)) {
            const listItem = document.createElement("li");
            listItem.innerHTML = `<strong>${shortcut}</strong>: <span class="expanded-text">${expanded}</span>`;
            shortcutList.appendChild(listItem);
        }
    });
}

// Function to clear the input fields
function clearInputs() {
    document.getElementById("shortcutInput").value = "";
    document.getElementById("expandedTextInput").innerHTML = "";
}
