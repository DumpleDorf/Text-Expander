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
    document.getElementById("addShortcutBtn").addEventListener("click", () => {
        const editor = document.getElementById("expandedTextInput");

        // Remove selection class from all images immediately
        editor.querySelectorAll("img.__selectedImage").forEach(img => {
            img.classList.remove("__selectedImage");
        });

        // Hide resize handles
        document.querySelectorAll("div").forEach(div => {
            if (div.style && div.style.cursor && div.style.cursor.includes("resize")) {
                div.style.display = "none";
            }
        });

        // Now get the HTML safely
        const shortcut = document.getElementById("shortcutInput").value.trim();
        const expandedText = editor.innerHTML.trim();

        if (!shortcut || !expandedText) {
            alert("Please fill in both fields.");
            return;
        }

        chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
            shortcuts[shortcut] = expandedText;
            chrome.storage.local.set({ shortcuts }, () => {
                displayShortcuts();
                // Clear inputs and hide form
                document.getElementById("shortcutInput").value = "";
                editor.innerHTML = "";
                document.getElementById("shortcutForm").style.display = "none";
                document.getElementById("shortcutSearchWrapper").style.removeProperty("display");
            });
        });
    });


    // Download / Save Shortcuts
    document.getElementById("saveShortcutsBtn").addEventListener("click", saveShortcuts);

    // Upload Shortcuts
    document.getElementById("uploadShortcutsBtn").addEventListener("click", uploadShortcuts);

    // Toolbar formatting buttons
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

// Display shortcuts list
function displayShortcuts() {
    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
        const list = document.getElementById("shortcutList");
        list.innerHTML = "";

        if (!Object.keys(shortcuts).length) {
            list.innerHTML = '<p class="empty-list">No shortcuts saved.</p>';
            return;
        }

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

            li.addEventListener("click", (e) => {
                if (e.target.tagName.toLowerCase() === "input" && e.target.type === "checkbox") return;
                editShortcut(shortcut, expanded);
            });

            list.appendChild(li);
        }

        updateDownloadButtonLabel();
    });
}

// Update download button label
function updateDownloadButtonLabel() {
    const downloadBtn = document.getElementById("saveShortcutsBtn");
    const anyChecked = document.querySelectorAll(".shortcut-item input[type='checkbox']:checked").length > 0;
    downloadBtn.textContent = anyChecked ? "Download Selected Shortcuts" : "Download Shortcuts";
}

// Edit a shortcut
function editShortcut(shortcut, expandedText) {
    const searchWrapper = document.getElementById("shortcutSearchWrapper");
    const form = document.getElementById("shortcutForm");

    searchWrapper.style.display = "none";
    form.style.display = "block";

    document.getElementById("shortcutInput").value = shortcut;

    // Normalize spacing/line breaks
    document.getElementById("expandedTextInput").innerHTML = expandedText
        .replace(/\r\n|\r|\n/g, "<br>")
        .replace(/[ \t]{2,}/g, " ");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Delete a shortcut
function deleteShortcut(shortcut) {
    chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
        delete shortcuts[shortcut];
        chrome.storage.local.set({ shortcuts }, displayShortcuts);
    });
}

// Clear inputs
function clearInputs() {
    document.getElementById("shortcutInput").value = "";
    document.getElementById("expandedTextInput").innerHTML = "";
}

// Save selected shortcuts
function saveShortcuts() {
    const checkedBoxes = document.querySelectorAll(".shortcut-item input[type='checkbox']:checked");
    const selectAllBtn = document.getElementById("selectAllBtn");

    if (checkedBoxes.length === 0) {
        alert("Select shortcuts to download first.");
        if (selectAllBtn) {
            selectAllBtn.classList.add("highlight-focus");
            setTimeout(() => selectAllBtn.classList.remove("highlight-focus"), 1000);
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

// Upload shortcuts
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
                        const modal = document.getElementById("duplicateModal");
                        const message = document.getElementById("duplicateMessage");
                        const formattedShortcuts = duplicates.map(s => `<span class="shortcut-name">${s}</span>`).join(", ");
                        message.innerHTML = `These shortcuts already exist: ${formattedShortcuts}. What do you want to do?`;
                        modal.style.display = "flex";

                        document.getElementById("overwriteBtn").onclick = () => {
                            Object.assign(shortcuts, uploaded);
                            chrome.storage.local.set({ shortcuts }, displayShortcuts);
                            modal.style.display = "none";
                        };

                        document.getElementById("skipBtn").onclick = () => {
                            Object.assign(shortcuts, newShortcuts);
                            chrome.storage.local.set({ shortcuts }, displayShortcuts);
                            modal.style.display = "none";
                        };
                    } else {
                        Object.assign(shortcuts, newShortcuts);
                        chrome.storage.local.set({ shortcuts }, displayShortcuts);
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
    insertNormalizedText(`{${placeholderName}}`);
}

function insertLink() {
    const url = prompt("Enter URL:", "https://");
    if (!url) return;
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim() || url;
    const linkHTML = `<a href="${url}" target="_blank">${selectedText}</a>`;
    insertNormalizedHTML(linkHTML);
}

// --- Normalized insertion helpers ---
function insertNormalizedText(text) {
    const html = text.replace(/\r\n|\r|\n/g, "<br>").replace(/[ \t]{2,}/g, " ");
    insertHTMLAtCursor(html);
}

function insertNormalizedHTML(html) {
    insertHTMLAtCursor(html);
}

function insertHTMLAtCursor(html) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const el = document.createElement("div");
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node, lastNode;
    while ((node = el.firstChild)) lastNode = frag.appendChild(node);

    range.insertNode(frag);

    if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// --- Search/filter shortcuts ---
function filterShortcuts() {
    const filter = document.getElementById("shortcutSearch").value.toLowerCase();
    document.querySelectorAll(".shortcut-item").forEach(item => {
        const text = item.querySelector(".trigger").textContent.toLowerCase();
        item.style.display = text.includes(filter) ? "" : "none";
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("expandedTextInput");
    if (!editor) return;

    let currentImage = null;
    let isResizing = false;
    const handles = [];
    const corners = ["nw", "ne", "sw", "se"];

    // Create corner handles
    for (let i = 0; i < 4; i++) {
        const h = document.createElement("div");
        h.style.width = "12px";
        h.style.height = "12px";
        h.style.background = "#f0f4f8"; // corner fill
        h.style.position = "absolute";
        h.style.zIndex = "9999";
        h.style.cursor = corners[i] + "-resize";
        h.style.display = "none";
        h.style.border = "2px solid #667eea"; // corner border
        h.style.borderRadius = "2px";
        document.body.appendChild(h);
        handles.push(h);
    }

    const hideSelection = () => {
        if (isResizing) return;
        if (currentImage) {
            currentImage.style.outline = "";
            currentImage = null;
        }
        handles.forEach(h => h.style.display = "none");
    };

    const positionHandles = (img) => {
        if (!img) return;
        const rect = img.getBoundingClientRect();
        const scrollX = window.scrollX || document.documentElement.scrollLeft;
        const scrollY = window.scrollY || document.documentElement.scrollTop;

        handles[0].style.left = rect.left + scrollX - 6 + "px"; // nw
        handles[0].style.top = rect.top + scrollY - 6 + "px";
        handles[1].style.left = rect.right + scrollX - 6 + "px"; // ne
        handles[1].style.top = rect.top + scrollY - 6 + "px";
        handles[2].style.left = rect.left + scrollX - 6 + "px"; // sw
        handles[2].style.top = rect.bottom + scrollY - 6 + "px";
        handles[3].style.left = rect.right + scrollX - 6 + "px"; // se
        handles[3].style.top = rect.bottom + scrollY - 6 + "px";
    };

    let startX, startY, startWidth, startHeight;

    handles.forEach((handle, idx) => {
        handle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            if (!currentImage) return;

            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = currentImage.offsetWidth;
            startHeight = currentImage.offsetHeight;
            const ratio = startWidth / startHeight;

            const onMouseMove = (e) => {
                const dx = e.clientX - startX;
                let newWidth = startWidth;
                let newHeight = startHeight;

                if (idx === 3) newWidth = startWidth + dx;
                else if (idx === 0) newWidth = startWidth - dx;
                else if (idx === 1) newWidth = startWidth + dx;
                else if (idx === 2) newWidth = startWidth - dx;

                newHeight = newWidth / ratio;

                if (newWidth > 10 && newHeight > 10) {
                    currentImage.style.width = newWidth + "px";
                    currentImage.style.height = newHeight + "px";
                    positionHandles(currentImage);
                }
            };

            const onMouseUp = () => {
                isResizing = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    });

    // Hover effect: show light outline on hover
    editor.addEventListener("mouseover", (e) => {
        if (e.target.tagName === "IMG" && e.target !== currentImage) {
            e.target.style.outline = "2px solid #667eea";
            e.target.style.outlineOffset = "2px";
        }
    });

    editor.addEventListener("mouseout", (e) => {
        if (e.target.tagName === "IMG" && e.target !== currentImage) {
            e.target.style.outline = "";
        }
    });

    // Click image → select it
    editor.addEventListener("click", (e) => {
        if (e.target.tagName === "IMG") {
            hideSelection();
            currentImage = e.target;
            currentImage.style.outline = "2px solid #667eea"; // same as hover
            currentImage.style.outlineOffset = "2px";
            handles.forEach(h => h.style.display = "block");
            positionHandles(currentImage);
        } else hideSelection();
    });

    // Delete selected image
    document.addEventListener("keydown", (e) => {
        if (currentImage && (e.key === "Delete" || e.key === "Backspace")) {
            e.preventDefault();
            currentImage.remove();
            hideSelection();
        }
    });

    // Hide selection on scroll
    window.addEventListener("scroll", () => !isResizing && hideSelection());
    editor.addEventListener("scroll", () => !isResizing && hideSelection());
    window.addEventListener("resize", () => { if (currentImage) positionHandles(currentImage); });

    // Strip selection before saving
    const addShortcutBtn = document.getElementById("addShortcutBtn");
    if (addShortcutBtn) {
        addShortcutBtn.addEventListener("click", () => {
            const editor = document.getElementById("expandedTextInput");

            // Remove any outline from all images
            editor.querySelectorAll("img").forEach(img => {
                img.style.outline = "";
                img.style.outlineOffset = "";
            });

            // Hide resize handles
            handles.forEach(h => h.style.display = "none");

            hideSelection(); // also clears currentImage

            // Now read innerHTML safely
            const shortcut = document.getElementById("shortcutInput").value.trim();
            const expandedText = editor.innerHTML.trim();

            if (!shortcut || !expandedText) {
                alert("Please fill in both fields.");
                return;
            }

            chrome.storage.local.get("shortcuts", ({ shortcuts = {} }) => {
                shortcuts[shortcut] = expandedText;
                chrome.storage.local.set({ shortcuts }, () => {
                    displayShortcuts();
                    // Clear inputs and hide form
                    document.getElementById("shortcutInput").value = "";
                    editor.innerHTML = "";
                    document.getElementById("shortcutForm").style.display = "none";
                    document.getElementById("shortcutSearchWrapper").style.removeProperty("display");
                });
            });
        });
    }
});
