document.addEventListener("DOMContentLoaded", () => {
    const searchWrapper = document.getElementById("shortcutSearchWrapper");
    const searchInput = document.getElementById("shortcutSearch");
    const form = document.getElementById("shortcutForm");
    const addShortcutBtn = document.getElementById("addShortcutBtn");
    const cancelShortcutBtn = document.getElementById("cancelShortcutBtn");

    // Show add shortcut form
    document.getElementById("showAddShortcutBtn").addEventListener("click", () => {
        form.style.display = "block";
        searchWrapper.style.display = "none";
        clearInputs();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Cancel add/edit shortcut
    cancelShortcutBtn.addEventListener("click", () => {
        form.style.display = "none";
        searchWrapper.style.removeProperty("display");
        clearInputs();
    });

    // Add/Edit shortcut
    addShortcutBtn.addEventListener("click", () => {
        const shortcut = document.getElementById("shortcutInput").value.trim();
        const expandedText = document.getElementById("expandedTextInput").innerHTML.trim();

        if (!shortcut || !expandedText) {
            alert("Please fill in both fields.");
            return;
        }

        chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
            shortcuts[shortcut] = expandedText;
            chrome.storage.local.set({ shortcuts }, () => {
                displayShortcuts();
                clearInputs();
                form.style.display = "none";
                searchWrapper.style.removeProperty("display");
            });
        });
    });

    // Download / Save Shortcuts
    document.getElementById("saveShortcutsBtn").addEventListener("click", saveShortcuts);

    // Upload Shortcuts
    document.getElementById("uploadShortcutsBtn").addEventListener("click", uploadShortcuts);

    // Toolbar formatting
    [
        { id: "boldBtn", command: "bold" },
        { id: "italicBtn", command: "italic" },
        { id: "underlineBtn", command: "underline" },
        { id: "numberedListBtn", command: "insertOrderedList" },
        { id: "bulletListBtn", command: "insertUnorderedList" }
    ].forEach(({ id, command }) => {
        const btn = document.getElementById(id);
        btn.addEventListener("click", () => document.execCommand(command));
    });

    document.getElementById("insertPlaceholderBtn").addEventListener("click", insertPlaceholder);
    document.getElementById("linkBtn").addEventListener("click", insertLink);
    document.getElementById("clearTextBtn").addEventListener("click", () => {
        document.getElementById("expandedTextInput").innerHTML = "";
    });

    // Filter shortcuts
    searchInput.addEventListener("input", filterShortcuts);

    // Display existing shortcuts
    displayShortcuts();
});

function displayShortcuts() {
    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
        const list = document.getElementById("shortcutList");
        list.innerHTML = "";

        if (!Object.keys(shortcuts).length) {
            list.innerHTML = '<p class="empty-list">No shortcuts saved.</p>';
            return;
        }

        // Add Select All / Deselect All button
        let selectAllBtn = document.getElementById("selectAllBtn");
        if (!selectAllBtn) {
            selectAllBtn = document.createElement("button");
            selectAllBtn.id = "selectAllBtn";
            selectAllBtn.textContent = "Select All";
            selectAllBtn.style.marginBottom = "10px";
            selectAllBtn.addEventListener("click", () => {
                const checkboxes = list.querySelectorAll("input[type='checkbox']");
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
                updateDownloadButtonLabel();
            });
            list.parentNode.insertBefore(selectAllBtn, list);
        }

        for (const [shortcut, expanded] of Object.entries(shortcuts)) {
            const li = document.createElement("li");
            li.classList.add("shortcut-item");
            li.dataset.key = shortcut;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.key = shortcut;
            checkbox.style.marginRight = "10px";
            checkbox.addEventListener("change", updateDownloadButtonLabel);

            const trigger = document.createElement("div");
            trigger.classList.add("trigger");
            trigger.textContent = shortcut;

            const expandedDiv = document.createElement("div");
            expandedDiv.classList.add("expanded-text");
            expandedDiv.innerHTML = expanded;

            const deleteBtn = document.createElement("button");
            deleteBtn.classList.add("deleteBtn");
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", e => {
                e.stopPropagation();
                if (confirm(`Delete "${shortcut}"?`)) deleteShortcut(shortcut);
            });

            li.append(checkbox, trigger, expandedDiv, deleteBtn);

            // Only open edit when clicking outside the checkbox
            li.addEventListener("click", (e) => {
                if (e.target.tagName.toLowerCase() === "input" && e.target.type === "checkbox") return;
                editShortcut(shortcut, expanded);
            });

            list.appendChild(li);
        }

        updateDownloadButtonLabel();
    });
}

// Update download button label depending on selection
function updateDownloadButtonLabel() {
    const downloadBtn = document.getElementById("saveShortcutsBtn");
    const anyChecked = document.querySelectorAll(".shortcut-item input[type='checkbox']:checked").length > 0;
    downloadBtn.textContent = anyChecked ? "Download Selected Shortcuts" : "Download Shortcuts";
}

function editShortcut(shortcut, expandedText) {
    const searchWrapper = document.getElementById("shortcutSearchWrapper");
    const form = document.getElementById("shortcutForm");

    searchWrapper.style.display = "none";
    form.style.display = "block";

    document.getElementById("shortcutInput").value = shortcut;
    document.getElementById("expandedTextInput").innerHTML = expandedText;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteShortcut(shortcut) {
    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
        delete shortcuts[shortcut];
        chrome.storage.local.set({ shortcuts }, displayShortcuts);
    });
}

function clearInputs() {
    document.getElementById("shortcutInput").value = "";
    document.getElementById("expandedTextInput").innerHTML = "";
}

function saveShortcuts() {
    const checkedBoxes = document.querySelectorAll(".shortcut-item input[type='checkbox']:checked");
    const selectAllBtn = document.getElementById("selectAllBtn");

    if (checkedBoxes.length === 0) {
        alert("Select shortcuts to download first.");
        if (selectAllBtn) {
            // temporarily highlight the button
            selectAllBtn.classList.add("highlight-focus");
            // remove highlight after animation ends
            setTimeout(() => selectAllBtn.classList.remove("highlight-focus"), 1000);
            // optionally focus for accessibility
            selectAllBtn.focus({ preventScroll: true });
        }
        return;
    }

    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
        const dataToSave = {};
        checkedBoxes.forEach(cb => {
            const key = cb.dataset.key;
            if (shortcuts[key]) dataToSave[key] = shortcuts[key];
        });

        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "shortcuts.json";
        a.click();
        URL.revokeObjectURL(url);
    });
}


function uploadShortcuts() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";

  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const uploaded = JSON.parse(reader.result);
        if (typeof uploaded !== "object" || Array.isArray(uploaded)) throw new Error();

        chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
          const duplicates = [];
          const newShortcuts = {};

          for (const [key, value] of Object.entries(uploaded)) {
            if (shortcuts[key]) duplicates.push(key);
            else newShortcuts[key] = value;
          }

          if (duplicates.length) {
              // Show custom modal
              const modal = document.getElementById("duplicateModal");
              const message = document.getElementById("duplicateMessage");

              // Format duplicates with bold
              const formattedShortcuts = duplicates.map(s => `<span class="shortcut-name">${s}</span>`).join(", ");
              message.innerHTML = `These shortcuts already exist: ${formattedShortcuts}. What do you want to do?`;

              modal.style.display = "flex";

              document.getElementById("overwriteBtn").onclick = () => {
                  Object.assign(shortcuts, uploaded); // overwrite all
                  chrome.storage.local.set({ shortcuts }, () => displayShortcuts());
                  modal.style.display = "none";
              };

              document.getElementById("skipBtn").onclick = () => {
                  Object.assign(shortcuts, newShortcuts); // add only new
                  chrome.storage.local.set({ shortcuts }, () => displayShortcuts());
                  modal.style.display = "none";
              };
          } else {
              // No duplicates, just add
              Object.assign(shortcuts, newShortcuts);
              chrome.storage.local.set({ shortcuts }, () => displayShortcuts());
          }
        });

      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  });

  input.click();
}


// --- Toolbar / Placeholder / Link ---
function insertPlaceholder() {
    const placeholderName = prompt("Enter placeholder name:");
    if (!placeholderName) return;
    const input = document.getElementById("expandedTextInput");
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const placeholder = `{${placeholderName}}`;
    range.deleteContents();
    range.insertNode(document.createTextNode(placeholder));
}

function insertLink() {
    const url = prompt("Enter URL:", "https://");
    if (!url) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const a = document.createElement("a");
    a.href = url;
    a.textContent = url;
    range.deleteContents();
    range.insertNode(a);
}

// --- Search/filter shortcuts ---
function filterShortcuts() {
    const filter = document.getElementById("shortcutSearch").value.toLowerCase();
    document.querySelectorAll(".shortcut-item").forEach(item => {
        const text = item.querySelector(".trigger").textContent.toLowerCase();
        item.style.display = text.includes(filter) ? "" : "none";
    });
}
