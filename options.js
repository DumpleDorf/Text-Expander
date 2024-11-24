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

    // Save changes to a JSON file
    document.getElementById("saveShortcutsBtn").addEventListener("click", () => {
        console.log("Save Shortcuts button pressed.");

        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};
            if (Object.keys(shortcuts).length > 0) {
                console.log("Shortcuts retrieved from storage:", shortcuts);

                const blob = new Blob([JSON.stringify(shortcuts, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "shortcuts.json";
                a.click();

                console.log("Shortcuts file downloaded as 'shortcuts.json'.");
            } else {
                console.warn("No shortcuts to save.");
                alert("No shortcuts to save.");
            }
        });
    });

    document.getElementById("uploadShortcutsBtn").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
    
        input.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const uploadedShortcuts = JSON.parse(reader.result);
    
                        if (typeof uploadedShortcuts !== "object" || Array.isArray(uploadedShortcuts)) {
                            alert("Invalid file format. Please upload a valid JSON file.");
                            return;
                        }
    
                        chrome.storage.local.get("shortcuts", (data) => {
                            const currentShortcuts = data.shortcuts || {};
    
                            const updatedShortcuts = { ...currentShortcuts };
                            for (const [shortcut, expanded] of Object.entries(uploadedShortcuts)) {
                                let newShortcut = shortcut;
                                let count = 1;
    
                                // Handle duplicate shortcuts by renaming with incrementing numbers
                                while (updatedShortcuts[newShortcut]) {
                                    newShortcut = `${shortcut}${count}`;
                                    count++;
                                }
    
                                updatedShortcuts[newShortcut] = expanded;
                            }
    
                            chrome.storage.local.set({ shortcuts: updatedShortcuts }, () => {
                                displayShortcuts();
                                alert("Shortcuts uploaded successfully!");
                            });
                        });
                    } catch (error) {
                        alert("Failed to upload shortcuts. Please ensure the file is a valid JSON.");
                    }
                };
    
                reader.readAsText(file);
            }
        });
    
        input.click();
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
    
    document.getElementById("numberedListBtn").addEventListener("click", () => {
        document.execCommand("insertOrderedList");
    });
    
    document.getElementById("bulletListBtn").addEventListener("click", () => {
        document.execCommand("insertUnorderedList");
    });
    
    document.getElementById("linkBtn").addEventListener("click", () => {
        const url = prompt("Enter URL:", "https://");
        if (url) {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.textContent = url;
            range.deleteContents();
            range.insertNode(link);
        }
    });
    
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

function clearInputs() {
    document.getElementById("shortcutInput").value = "";
    document.getElementById("expandedTextInput").innerHTML = "";
}

function deleteShortcut(shortcut) {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        delete shortcuts[shortcut];
        chrome.storage.local.set({ shortcuts }, displayShortcuts);
    });
}

function setCaretToEnd() {
    const input = document.getElementById("expandedTextInput");
    input.focus();
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}
