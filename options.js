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

        // Insert Placeholder button
        document.getElementById("insertPlaceholderBtn").addEventListener("click", () => {
            const placeholderName = prompt("Enter the placeholder name:");
            if (placeholderName) {
                const input = document.getElementById("expandedTextInput");

                // If using a contenteditable div, use selectionStart/selectionEnd
                const selection = window.getSelection();
                const caretPosition = selection.anchorOffset;

                const textBefore = input.innerHTML.substring(0, caretPosition);
                const textAfter = input.innerHTML.substring(caretPosition);

                const placeholder = `{${placeholderName}} `;
                
                // Update the content inside the contenteditable div
                input.innerHTML = textBefore + placeholder + textAfter;

                // Set the caret position to the end of the inserted placeholder
                const range = document.createRange();
                range.setStart(input.firstChild, textBefore.length + placeholder.length);
                range.setEnd(input.firstChild, textBefore.length + placeholder.length);
                selection.removeAllRanges();
                selection.addRange(range);

                // Focus the input again to maintain the caret
                input.focus();
            }
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
                    deleteBtn.addEventListener("click", (event) => {
                        event.stopPropagation(); // Prevent the listItem click from triggering edit
                        if (confirm(`Are you sure you want to delete the shortcut "${shortcut}"?`)) {
                            deleteShortcut(shortcut);
                        }
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

        // Store the shortcut being edited, so we can identify it when saving
        document.getElementById("addShortcutBtn").dataset.editing = shortcut;

        // Scroll to the top of the page
        window.scrollTo(0, 0);
    }

    function clearInputs() {
        document.getElementById("shortcutInput").value = "";
        document.getElementById("expandedTextInput").innerHTML = "";
    }

    // Delete a shortcut
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
    
    document.addEventListener('DOMContentLoaded', () => {
        const towbookAudioCheckbox = document.getElementById('towbook-audio-notifier');  // HERE
        const settingsIcon = document.querySelector('.settings-icon');
        const popup = document.getElementById('settings-popup');
        const teamsFilterCheckbox = document.getElementById('teams-filter');
        const saveButton = document.getElementById('save');
        const restoreButton = document.getElementById('restore');
    
        // Restore options from Chrome storage on page load
        chrome.storage.sync.get({ teamsFilter: false, towbookAudioNotifier: false }, (items) => {
            if (teamsFilterCheckbox) {
                teamsFilterCheckbox.checked = items.teamsFilter;
            }
            if (towbookAudioCheckbox) {
                towbookAudioCheckbox.checked = items.towbookAudioNotifier;
            }
        });
    
        // Save options to Chrome storage
        const saveOptions = () => {
            const settings = {};
            if (teamsFilterCheckbox) {
                settings.teamsFilter = teamsFilterCheckbox.checked;
            }
            if (towbookAudioCheckbox) {
                settings.towbookAudioNotifier = towbookAudioCheckbox.checked;
            }
            chrome.storage.sync.set(settings, () => {
                console.log("Settings saved.");
            });
        };
    
        // Restore options to defaults
        const restoreOptions = () => {
            chrome.storage.sync.clear(() => {
                if (teamsFilterCheckbox) teamsFilterCheckbox.checked = false;
                if (towbookAudioCheckbox) towbookAudioCheckbox.checked = false;
                console.log("Settings restored to defaults.");
            });
        };

        if (towbookAudioCheckbox) {
            towbookAudioCheckbox.addEventListener('change', () => {
            if (towbookAudioCheckbox.checked) {
                console.log("Towbook Audio Notifier enabled.");
                loadTowbookNotifierScript();
            } else {
                console.log("Towbook Audio Notifier disabled.");
            }
            saveOptions();
            });
        }

        // Toggle settings popup visibility
        if (settingsIcon && popup) {
            settingsIcon.addEventListener('click', () => {
                popup.style.display = popup.style.display === 'none' || popup.style.display === '' ? 'block' : 'none';
            });
    
            // Close popup if clicked outside
            document.addEventListener('click', (event) => {
                if (!popup.contains(event.target) && event.target !== settingsIcon) {
                    popup.style.display = 'none';
                }
            });
        }
    
        // Handle Teams Filter checkbox toggle
        if (teamsFilterCheckbox) {
            teamsFilterCheckbox.addEventListener('change', () => {
                if (teamsFilterCheckbox.checked) {
                    if (window.location.href.startsWith('https://customerconnect.tesla.com/')) {
                        loadTeamsFilterScript();
                    } else {
                        console.warn("Teams Filter is enabled but not on a supported domain.");
                    }
                } else {
                    console.log("Teams Filter disabled.");
                }
                saveOptions(); // Save setting on toggle
            });
        }
    
        // Save button event
        if (saveButton) {
            saveButton.addEventListener('click', saveOptions);
        }
    
        // Restore button event
        if (restoreButton) {
            restoreButton.addEventListener('click', restoreOptions);
        }
    
        // Function to dynamically load the teamsfilter.js script
        const loadTeamsFilterScript = () => {
            const script = document.createElement('script');
            script.src = 'teamsfilter.js';
            script.type = 'text/javascript';
            script.onload = () => {
                console.log("Teams Filter script loaded successfully.");
            };
            document.body.appendChild(script);
        };

        const loadTowbookNotifierScript = () => {
        const existingScript = document.querySelector('script[src="towbooknotifier.js"]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = 'towbooknotifier.js';
            script.type = 'text/javascript';
            script.onload = () => {
            console.log("Towbook Notifier script loaded successfully.");
            };
            document.body.appendChild(script);
        }
        };

    });
    