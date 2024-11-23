document.addEventListener("DOMContentLoaded", () => {
    displayShortcuts();

    // Add or update shortcut
    document.getElementById("addShortcutBtn").addEventListener("click", () => {
        const shortcut = document.getElementById("shortcutInput").value.trim();
        const expandedText = document.getElementById("expandedTextInput").innerHTML.trim();

        if (shortcut && expandedText) {
            chrome.storage.local.get("shortcuts", (data) => {
                const shortcuts = data.shortcuts || {};

                if (shortcuts[shortcut] && !confirm(`Shortcut "${shortcut}" already exists. Overwrite?`)) {
                    return;
                }

                // If a shortcut is being edited, we replace the existing shortcut
                shortcuts[shortcut] = expandedText;

                chrome.storage.local.set({ shortcuts }, () => {
                    displayShortcuts();
                    clearInputs();
                    setCaretToEnd();
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

    // Save changes to a JSON file
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

    // Rich text formatting buttons
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
            document.getElementById("expandedTextInput").innerHTML += imgTag;
        }
    });

    // Numbered List button
    document.getElementById("numberedListBtn").addEventListener("click", () => {
        document.execCommand("insertOrderedList");
    });

    // Bullet List button
    document.getElementById("bulletListBtn").addEventListener("click", () => {
        document.execCommand("insertUnorderedList");
    });

    // Link button
    document.getElementById("linkBtn").addEventListener("click", () => {
        const url = prompt("Enter URL:", "https://");
        if (url) {
            document.execCommand("createLink", false, url);
        }
    });

    // Clear the content of the expanded text input
    document.getElementById("clearTextBtn").addEventListener("click", () => {
        document.getElementById("expandedTextInput").innerHTML = "";
    });
});

// Display saved shortcuts
function displayShortcuts() {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        const shortcutList = document.getElementById("shortcutList");
        shortcutList.innerHTML = "";

        if (Object.keys(shortcuts).length === 0) {
            shortcutList.innerHTML = '<p class="empty-list">No shortcuts saved. Add one above.</p>';
        } else {
            for (const [shortcut, expanded] of Object.entries(shortcuts)) {
                const listItem = document.createElement("li");
                listItem.classList.add("shortcut-item");

                const trigger = document.createElement("div");
                trigger.classList.add("trigger");
                trigger.textContent = shortcut;
                listItem.appendChild(trigger);

                const hr = document.createElement("hr");
                hr.classList.add("shortcut-divider");
                listItem.appendChild(hr);

                const expandedTextDiv = document.createElement("div");
                expandedTextDiv.classList.add("expanded-text");
                expandedTextDiv.innerHTML = expanded;
                listItem.appendChild(expandedTextDiv);

                const deleteBtn = document.createElement("button");
                deleteBtn.classList.add("deleteBtn");
                deleteBtn.textContent = "Delete";
                deleteBtn.addEventListener("click", () => {
                    deleteShortcut(shortcut);
                });
                listItem.appendChild(deleteBtn);

                // Allow clicking to edit the shortcut
                listItem.addEventListener("click", () => {
                    editShortcut(shortcut, expanded);
                });

                shortcutList.appendChild(listItem);
            }
        }
    });
}

// Edit a shortcut
function editShortcut(shortcut, expandedText) {
    // Populate the input fields with the current shortcut data
    document.getElementById("shortcutInput").value = shortcut;
    document.getElementById("expandedTextInput").innerHTML = expandedText;

    // Change the button text to "Update Shortcut"
    document.getElementById("addShortcutBtn").textContent = "Update Shortcut";

    // Store the shortcut being edited, so we can identify it when saving
    document.getElementById("addShortcutBtn").dataset.editing = shortcut;

    // Scroll to the top of the page
    window.scrollTo(0, 0);
}

// Delete a shortcut
function deleteShortcut(shortcut) {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        delete shortcuts[shortcut];
        chrome.storage.local.set({ shortcuts }, displayShortcuts);
    });
}

// Clear input fields
function clearInputs() {
    document.getElementById("shortcutInput").value = "";
    document.getElementById("expandedTextInput").innerHTML = "";
}

// Set caret at the end of the expanded text input
function setCaretToEnd() {
    const expandedTextInput = document.getElementById("expandedTextInput");
    expandedTextInput.focus();

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(expandedTextInput);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}
