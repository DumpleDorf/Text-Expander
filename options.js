document.addEventListener("DOMContentLoaded", () => {
    // Display shortcuts when the options page loads
    displayShortcuts();

    // Add a new shortcut
    document.getElementById("addShortcutBtn").addEventListener("click", () => {
        const shortcut = document.getElementById("shortcutInput").value.trim();
        const expandedText = document.getElementById("expandedTextInput").innerHTML.trim();

        if (shortcut && expandedText) {
            // Save the shortcut to chrome.storage.local
            chrome.storage.local.get("shortcuts", (data) => {
                const shortcuts = data.shortcuts || {};
                shortcuts[shortcut] = expandedText;

                // Save updated shortcuts back to storage
                chrome.storage.local.set({ shortcuts }, () => {
                    displayShortcuts();
                    clearInputs();
                });
            });
        } else {
            alert("Please fill in both fields (Shortcut and Expanded Text).");
        }
    });

    // Save changes to a file
    document.getElementById("saveShortcutsBtn").addEventListener("click", () => {
        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};
            if (Object.keys(shortcuts).length > 0) {
                const blob = new Blob([JSON.stringify(shortcuts, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "shortcuts.json";
                a.click();
            } else {
                alert("No shortcuts to save.");
            }
        });
    });

    // Text formatting functions
    document.getElementById("boldBtn").addEventListener("click", () => document.execCommand('bold'));
    document.getElementById("italicBtn").addEventListener("click", () => document.execCommand('italic'));
    document.getElementById("underlineBtn").addEventListener("click", () => document.execCommand('underline'));
    document.getElementById("numberedListBtn").addEventListener("click", () => document.execCommand('insertOrderedList'));
    document.getElementById("bulletListBtn").addEventListener("click", () => document.execCommand('insertUnorderedList'));
    document.getElementById("linkBtn").addEventListener("click", () => {
        const url = prompt("Enter the link URL:");
        if (url) {
            document.execCommand('createLink', false, url);
        }
    });
    document.getElementById("clearFormattingBtn").addEventListener("click", () => document.execCommand('removeFormat'));
});

// Display the list of shortcuts
function displayShortcuts() {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        const listDiv = document.getElementById("shortcutList");
        listDiv.innerHTML = ""; // Clear current list

        // Display shortcuts
        if (Object.keys(shortcuts).length > 0) {
            for (const [shortcut, expandedText] of Object.entries(shortcuts)) {
                const div = document.createElement("div");
                div.classList.add("shortcut-item");
                div.innerHTML = `
                    <strong>${shortcut}</strong>: <span class="expanded-text">${expandedText}</span>
                    <button class="deleteBtn" data-shortcut="${shortcut}">Delete</button>
                `;
                listDiv.appendChild(div);
            }

            // Attach delete button functionality
            const deleteButtons = document.querySelectorAll(".deleteBtn");
            deleteButtons.forEach(button => {
                button.addEventListener("click", (event) => {
                    const shortcutToDelete = event.target.getAttribute("data-shortcut");
                    deleteShortcut(shortcutToDelete);
                });
            });
        } else {
            listDiv.innerHTML = "<p>No shortcuts saved yet.</p>";
        }
    });
}

// Delete a shortcut
function deleteShortcut(shortcut) {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        if (shortcuts[shortcut]) {
            delete shortcuts[shortcut];
            chrome.storage.local.set({ shortcuts }, () => {
                displayShortcuts(); // Refresh the list
            });
        }
    });
}

// Clear the input fields after adding a shortcut
function clearInputs() {
    document.getElementById("shortcutInput").value = "";
    document.getElementById("expandedTextInput").innerHTML = "";
}
