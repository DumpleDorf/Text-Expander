document.addEventListener("DOMContentLoaded", () => {
    displayShortcuts();

    // Add new shortcut
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

    document.getElementById("clearAllBtn").addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all shortcuts?")) {
            chrome.storage.local.set({ shortcuts: {} }, displayShortcuts);
        }
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
});

// Display saved shortcuts
function displayShortcuts() {
    chrome.storage.local.get("shortcuts", (data) => {
        const shortcuts = data.shortcuts || {};
        const shortcutList = document.getElementById("shortcutList");
        shortcutList.innerHTML = "";

        for (const [shortcut, expanded] of Object.entries(shortcuts)) {
            const listItem = document.createElement("li");
            listItem.classList.add('shortcut-item');

            const trigger = document.createElement('div');
            trigger.classList.add('trigger');
            trigger.textContent = shortcut;
            listItem.appendChild(trigger);

            const hr = document.createElement("hr");
            hr.classList.add('shortcut-divider');
            listItem.appendChild(hr);

            const expandedTextDiv = document.createElement('div');
            expandedTextDiv.classList.add('expanded-text');
            expandedTextDiv.innerHTML = expanded;
            listItem.appendChild(expandedTextDiv);

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('deleteBtn');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                deleteShortcut(shortcut);
            });
            listItem.appendChild(deleteBtn);

            shortcutList.appendChild(listItem);
        }
    });
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
