document.addEventListener("DOMContentLoaded", () => {
  // Initial display of shortcuts
  displayShortcuts();

  // Add or update shortcut
  document.getElementById("addShortcutBtn").addEventListener("click", () => {
    const shortcut = document.getElementById("shortcutInput").value.trim();
    const expandedText = document.getElementById("expandedTextInput").innerHTML.trim();

    if (!shortcut || !expandedText) {
      alert("Please fill in both fields (Shortcut and Expanded Text).");
      return;
    }

    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
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
  });

  // Save shortcuts to JSON file
  document.getElementById("saveShortcutsBtn").addEventListener("click", () => {
    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
      if (Object.keys(shortcuts).length === 0) {
        alert("No shortcuts to save.");
        return;
      }
      const blob = new Blob([JSON.stringify(shortcuts, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shortcuts.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Upload shortcuts from JSON file
  document.getElementById("uploadShortcutsBtn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const uploadedShortcuts = JSON.parse(reader.result);
          if (typeof uploadedShortcuts !== "object" || Array.isArray(uploadedShortcuts)) {
            alert("Invalid file format. Please upload a valid JSON file.");
            return;
          }

          chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
            const updatedShortcuts = { ...shortcuts };
            for (const [shortcut, expanded] of Object.entries(uploadedShortcuts)) {
              let newShortcut = shortcut;
              let count = 1;
              while (updatedShortcuts[newShortcut]) {
                newShortcut = `${shortcut}${count++}`;
              }
              updatedShortcuts[newShortcut] = expanded;
            }
            chrome.storage.local.set({ shortcuts: updatedShortcuts }, () => {
              displayShortcuts();
              alert("Shortcuts uploaded successfully!");
            });
          });
        } catch {
          alert("Failed to upload shortcuts. Please ensure the file is a valid JSON.");
        }
      };
      reader.readAsText(file);
    });

    input.click();
  });

  // Rich text formatting buttons
  [
    { id: "boldBtn", command: "bold" },
    { id: "italicBtn", command: "italic" },
    { id: "underlineBtn", command: "underline" },
    { id: "numberedListBtn", command: "insertOrderedList" },
    { id: "bulletListBtn", command: "insertUnorderedList" },
  ].forEach(({ id, command }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", () => document.execCommand(command));
    }
  });

  // Insert Placeholder button
  document.getElementById("insertPlaceholderBtn").addEventListener("click", () => {
    const placeholderName = prompt("Enter the placeholder name:");
    if (!placeholderName) return;

    const input = document.getElementById("expandedTextInput");
    const selection = window.getSelection();
    const caretPosition = selection.anchorOffset;

    const textBefore = input.innerHTML.substring(0, caretPosition);
    const textAfter = input.innerHTML.substring(caretPosition);
    const placeholder = `{${placeholderName}} `;

    input.innerHTML = textBefore + placeholder + textAfter;

    // Set caret position after inserted placeholder
    const range = document.createRange();
    range.setStart(input.firstChild, textBefore.length + placeholder.length);
    range.setEnd(input.firstChild, textBefore.length + placeholder.length);

    selection.removeAllRanges();
    selection.addRange(range);
    input.focus();
  });

  // Link button
  document.getElementById("linkBtn").addEventListener("click", () => {
    const url = prompt("Enter URL:", "https://");
    if (!url) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const link = document.createElement("a");
    link.href = url;
    link.textContent = url;
    range.deleteContents();
    range.insertNode(link);
  });

  // Clear text button
  document.getElementById("clearTextBtn").addEventListener("click", () => {
    document.getElementById("expandedTextInput").innerHTML = "";
  });

  // --- Settings UI and persistence ---
  const towbookAudioCheckbox = document.getElementById("towbook-audio-notifier");
  const teamsFilterCheckbox = document.getElementById("teams-filter");
  const settingsIcon = document.querySelector(".settings-icon");
  const popup = document.getElementById("settings-popup");
  const saveButton = document.getElementById("save");
  const restoreButton = document.getElementById("restore");

  chrome.storage.sync.get({ teamsFilter: false, towbookAudioNotifier: false }, (items) => {
    if (teamsFilterCheckbox) teamsFilterCheckbox.checked = items.teamsFilter;
    if (towbookAudioCheckbox) towbookAudioCheckbox.checked = items.towbookAudioNotifier;
  });

  const saveOptions = () => {
    chrome.storage.sync.set({
      teamsFilter: teamsFilterCheckbox?.checked || false,
      towbookAudioNotifier: towbookAudioCheckbox?.checked || false,
    }, () => console.log("Settings saved."));
  };

  const restoreOptions = () => {
    chrome.storage.sync.clear(() => {
      if (teamsFilterCheckbox) teamsFilterCheckbox.checked = false;
      if (towbookAudioCheckbox) towbookAudioCheckbox.checked = false;
      console.log("Settings restored to defaults.");
    });
  };

  if (towbookAudioCheckbox) {
    towbookAudioCheckbox.addEventListener("change", () => {
      if (towbookAudioCheckbox.checked) {
        console.log("Towbook Audio Notifier enabled.");
        loadTowbookNotifierScript();
      } else {
        console.log("Towbook Audio Notifier disabled.");
      }
      saveOptions();
    });
  }

  if (teamsFilterCheckbox) {
    teamsFilterCheckbox.addEventListener("change", () => {
      if (teamsFilterCheckbox.checked) {
        if (window.location.href.startsWith("https://customerconnect.tesla.com/")) {
          loadTeamsFilterScript();
        } else {
          console.warn("Teams Filter enabled but not on supported domain.");
        }
      } else {
        console.log("Teams Filter disabled.");
      }
      saveOptions();
    });
  }

  if (settingsIcon && popup) {
    settingsIcon.addEventListener("click", () => {
      popup.style.display = popup.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (event) => {
      if (!popup.contains(event.target) && event.target !== settingsIcon) {
        popup.style.display = "none";
      }
    });
  }

  if (saveButton) saveButton.addEventListener("click", saveOptions);
  if (restoreButton) restoreButton.addEventListener("click", restoreOptions);

  function loadTeamsFilterScript() {
    if (!document.querySelector('script[src="teamsfilter.js"]')) {
      const script = document.createElement("script");
      script.src = "teamsfilter.js";
      script.type = "text/javascript";
      script.onload = () => console.log("Teams Filter script loaded.");
      document.body.appendChild(script);
    }
  }

  function loadTowbookNotifierScript() {
    if (!document.querySelector('script[src="TowbookAudioNotifier/towbookAudioNotification.js"]')) {
      const script = document.createElement("script");
      script.src = "TowbookAudioNotifier/towbookAudioNotification.js";
      script.type = "text/javascript";
      script.onload = () => console.log("Towbook Notifier script loaded.");
      document.body.appendChild(script);
    }
  }
});

// --- Shortcut display and manipulation ---

function displayShortcuts() {
  chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
    const shortcutList = document.getElementById("shortcutList");
    shortcutList.innerHTML = "";

    if (Object.keys(shortcuts).length === 0) {
      shortcutList.innerHTML = '<p class="empty-list">No shortcuts saved. Add one above.</p>';
      return;
    }

    for (const [shortcut, expanded] of Object.entries(shortcuts)) {
      const listItem = document.createElement("li");
      listItem.classList.add("shortcut-item");

      const trigger = document.createElement("div");
      trigger.classList.add("trigger");
      trigger.textContent = shortcut;

      const hr = document.createElement("hr");
      hr.classList.add("shortcut-divider");

      const expandedTextDiv = document.createElement("div");
      expandedTextDiv.classList.add("expanded-text");
      expandedTextDiv.innerHTML = expanded;

      const deleteBtn = document.createElement("button");
      deleteBtn.classList.add("deleteBtn");
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the shortcut "${shortcut}"?`)) {
          deleteShortcut(shortcut);
        }
      });

      listItem.append(trigger, hr, expandedTextDiv, deleteBtn);

      listItem.addEventListener("click", () => editShortcut(shortcut, expanded));

      shortcutList.appendChild(listItem);
    }
  });
}

function editShortcut(shortcut, expandedText) {
  document.getElementById("shortcutInput").value = shortcut;
  document.getElementById("expandedTextInput").innerHTML = expandedText;
  document.getElementById("addShortcutBtn").dataset.editing = shortcut;
  window.scrollTo(0, 0);
}

function clearInputs() {
  document.getElementById("shortcutInput").value = "";
  document.getElementById("expandedTextInput").innerHTML = "";
}

function deleteShortcut(shortcut) {
  chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
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
