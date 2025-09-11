// -----------------------------
// 1️⃣ Attach input listener to editors (textarea, input, contentEditable)
// -----------------------------
function attachExpander(el) {
    if (!el || el.dataset.expanderAttached) return;
    el.dataset.expanderAttached = "true";

    el.addEventListener("input", (event) => {
        const target = event.target;
        if (!target) return;

        const inputText =
            target.tagName === "TEXTAREA" || target.tagName === "INPUT"
                ? target.value
                : target.innerText;

        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};

            for (const [shortcut, expanded] of Object.entries(shortcuts)) {
                if (inputText.includes(shortcut)) {
                    if (expanded.includes("{")) {
                        showPlaceholderPopup(expanded, shortcut, target, (finalText) => {
                            if (target.isContentEditable) {
                                replaceShortcut(target, shortcut, finalText);
                            } else {
                                const index = target.value.lastIndexOf(shortcut);
                                replaceShortcutAtIndex(target, shortcut, finalText, index);
                            }
                        });
                    } else {
                        if (target.isContentEditable) {
                            replaceShortcut(target, shortcut, expanded);
                        } else {
                            const index = target.value.lastIndexOf(shortcut);
                            replaceShortcutAtIndex(target, shortcut, expanded, index);
                        }
                    }
                    break;
                }
            }
        });
    });
}

// -----------------------------
// 2️⃣ Find all editors recursively (including shadow DOM)
// -----------------------------
function findAllEditors(root) {
    const editors = [];
    function traverse(node) {
        if (!node) return;
        if (node.shadowRoot) traverse(node.shadowRoot);
        if (node.matches?.("[contenteditable='true'], textarea, input")) editors.push(node);
        node.querySelectorAll?.("[contenteditable='true'], textarea, input").forEach(traverse);
    }
    traverse(root);
    return editors;
}

// -----------------------------
// 3️⃣ Attach to all existing editors
// -----------------------------
findAllEditors(document).forEach(attachExpander);

// -----------------------------
// 4️⃣ Observe DOM for new editors (dynamic content)
// -----------------------------
const observer = new MutationObserver(() => {
    findAllEditors(document).forEach(attachExpander);
});
observer.observe(document, { childList: true, subtree: true });

function replaceShortcutAtIndex(target, shortcut, replacementText, index) {
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
        const inputText = target.value;
        const plainText = stripHTML(replacementText);

        const beforeShortcut = inputText.slice(0, index);
        const afterShortcut = inputText.slice(index + shortcut.length);

        target.value = beforeShortcut + plainText + afterShortcut;

        const newCaretPosition = beforeShortcut.length + plainText.length;
        setTimeout(() => {
            target.setSelectionRange(newCaretPosition, newCaretPosition);
        }, 0);

        target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }
}

// Utility: decode HTML entities (to handle &quot; etc.)
function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Utility function to strip HTML tags
function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html;

    div.innerHTML = div.innerHTML.replace(/<br\s*\/?>/gi, "\n");
    div.innerHTML = div.innerHTML.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");
    div.innerHTML = div.innerHTML.replace(/<\/?span[^>]*>/gi, "");

    return div.textContent || div.innerText || "";
}

// Utility to escape RegExp special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wrap all {placeholder} occurrences with <placeholder> tags
function preprocessPlaceholders(text) {
    return text.replace(/\{([^{}]+)\}/g, (match, p1) => `<placeholder>${p1}</placeholder>`);
}

// Recursively replaces <placeholder> elements with <input> fields
function replacePlaceholdersWithInputs(node, container, inputs, focusFirstInputRef) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const parts = text.split(/(\{[^}]+\})/g);
        parts.forEach(part => {
            const match = part.match(/^\{([^}]+)\}$/);
            if (match) {
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = match[1];
                input.style.margin = '0 3px';
                input.style.padding = '3px 6px';
                input.style.fontSize = '14px';
                input.style.borderRadius = '4px';
                input.style.border = '1px solid #ccc';
                input.style.minWidth = '80px';
                container.appendChild(input);
                inputs.push(input);

                if (focusFirstInputRef.value) {
                    setTimeout(() => {
                        input.focus();
                        const length = input.value.length;
                        input.setSelectionRange(length, length);
                    }, 0);
                    focusFirstInputRef.value = false;
                }
            } else if (part) {
                container.appendChild(document.createTextNode(part));
            }
        });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName.toLowerCase() === 'placeholder') {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = node.textContent;
            input.style.margin = '0 3px';
            input.style.padding = '3px 6px';
            input.style.fontSize = '14px';
            input.style.borderRadius = '4px';
            input.style.border = '1px solid #ccc';
            input.style.minWidth = '80px';
            container.appendChild(input);
            inputs.push(input);

            if (focusFirstInputRef.value) {
                setTimeout(() => {
                    input.focus();
                    const length = input.value.length;
                    input.setSelectionRange(length, length);
                }, 0);
                focusFirstInputRef.value = false;
            }
        } else {
            const elClone = document.createElement(node.tagName);
            for (const attr of node.attributes) elClone.setAttribute(attr.name, attr.value);
            container.appendChild(elClone);

            node.childNodes.forEach(child => {
                replacePlaceholdersWithInputs(child, elClone, inputs, focusFirstInputRef);
            });
        }
    }
}

// -----------------------------
// 5️⃣ Main popup function
// -----------------------------
function showPlaceholderPopup(expandedText, shortcut, targetElement, onConfirm) {
    // Remove existing overlay
    const existingOverlay = document.querySelector(".placeholder-popup-overlay");
    if (existingOverlay) existingOverlay.remove();

    // Overlay
    const overlay = document.createElement("div");
    overlay.className = "placeholder-popup-overlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background-color: rgba(0,0,0,0.35);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.15s ease;
    `;

    // Popup
    const popup = document.createElement("div");
    popup.style.cssText = `
        background: rgba(255,255,255,0.98);
        border-radius: 15px;
        padding: 25px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(650px, 90%);
        max-height: 80vh;
        overflow-y: auto;
        border: 2px solid #a1c4fd;
        box-shadow: 0 0 0 2px rgba(128,191,255,0.1), 0 6px 18px rgba(0,0,0,0.2);
        font-size: 15px;
        line-height: 1.6;
        color: #333;
        transform: scale(0.95);
        opacity: 0;
        animation: popupIn 0.15s ease forwards;
    `;

    const inputs = [];
    const focusFirstInputRef = { value: true };

    // Strip any HTML for clean preview but keep formatting
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = expandedText;

    // Replace placeholders with inputs recursively
    replacePlaceholdersWithInputs(tempDiv, popup, inputs, focusFirstInputRef);

    // Fix bullet point rendering
    popup.querySelectorAll("ul, ol").forEach(list => {
        list.style.margin = "8px 0";
        list.style.paddingLeft = "25px";
        list.style.lineHeight = "1.6";
    });

    popup.querySelectorAll("li").forEach(li => {
        li.style.marginBottom = "4px";
    });

    // Buttons container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        width: 100%;
        margin-top: 15px;
    `;

    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Confirm";
    confirmButton.style.cssText = `
        background: #3498db;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        transition: all 0.25s ease;
    `;
    confirmButton.addEventListener("mouseover", () => { confirmButton.style.background = "#2c7ac9"; });
    confirmButton.addEventListener("mouseout", () => { confirmButton.style.background = "#3498db"; });
    confirmButton.addEventListener("click", () => {
        const values = inputs.map(input => input.value.trim());
        let updatedHTML = expandedText;
        values.forEach((val, idx) => {
            const ph = inputs[idx].placeholder;
            updatedHTML = updatedHTML.replace(new RegExp(`\\{${escapeRegExp(ph)}\\}`, "g"), val);
        });
        onConfirm(updatedHTML);
        closePopup();
    });
    
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.style.cssText = `
        background: transparent;
        color: #e74c3c;
        border: 2px solid #e74c3c;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        transition: all 0.25s ease;
    `;
    cancelButton.addEventListener("mouseover", () => { cancelButton.style.background = "#e74c3c"; cancelButton.style.color = "#fff"; });
    cancelButton.addEventListener("mouseout", () => { cancelButton.style.background = "transparent"; cancelButton.style.color = "#e74c3c"; });
    cancelButton.addEventListener("click", closePopup);

    buttonContainer.appendChild(confirmButton);
    buttonContainer.appendChild(cancelButton);
    popup.appendChild(buttonContainer);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    if (inputs.length > 0) setTimeout(() => inputs[0].focus(), 0);

    // Close on outside click
    overlay.addEventListener("click", e => { if (e.target === overlay) closePopup(); });

    // Close on Escape key
    overlay.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") closePopup();
    });
    overlay.tabIndex = -1;
    overlay.focus();

    function closePopup() {
        popup.style.animation = "popupOut 0.15s ease forwards";
        overlay.style.animation = "fadeOut 0.15s ease forwards";
        setTimeout(() => overlay.remove(), 150);
    }

    // Inject keyframes once
    if (!document.getElementById("popupKeyframes")) {
        const style = document.createElement("style");
        style.id = "popupKeyframes";
        style.innerHTML = `
            @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }
            @keyframes fadeOut { from {opacity:1;} to {opacity:0;} }
            @keyframes popupIn { from {transform:scale(0.95);opacity:0;} to {transform:scale(1);opacity:1;} }
            @keyframes popupOut { from {transform:scale(1);opacity:1;} to {transform:scale(0.9);opacity:0;} }
        `;
        document.head.appendChild(style);
    }
}


// -----------------------------
// 6️⃣ Rich text replacement
// -----------------------------
function replaceShortcut(target, shortcut, replacementText) {
    if (!target.isContentEditable) return;

    const range = findRangeForText(target, shortcut);
    if (!range) return;

    range.deleteContents();

    const tempDiv = document.createElement("div");
    const MARKER_ID = "__caret_marker";
    tempDiv.innerHTML = replacementText + `<span id="${MARKER_ID}" style="display:none;"></span>`;

    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) fragment.appendChild(tempDiv.firstChild);

    range.insertNode(fragment);

    setTimeout(() => {
        const marker = document.getElementById(MARKER_ID);
        if (marker) {
            const selection = window.getSelection();
            const newRange = document.createRange();
            newRange.setStartAfter(marker);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            marker.remove();
        }
        target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    }, 0);
}

function findRangeForText(container, textToFind) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let currentNode;
    let accumulatedText = '';
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;

    while ((currentNode = walker.nextNode())) {
        const nodeText = currentNode.nodeValue || '';
        const fullText = accumulatedText + nodeText;
        const index = fullText.indexOf(textToFind);

        if (index !== -1) {
            // Start position
            let remaining = index - accumulatedText.length;
            startNode = currentNode;
            startOffset = remaining >= 0 ? remaining : 0;

            // End position
            let endPosInFull = index + textToFind.length;
            let tempNode = currentNode;
            let tempOffset = startOffset + textToFind.length;

            while (tempOffset > (tempNode.nodeValue?.length || 0)) {
                tempOffset -= tempNode.nodeValue?.length || 0;
                tempNode = walker.nextNode();
                if (!tempNode) {
                    tempNode = currentNode;
                    tempOffset = tempNode.nodeValue?.length || 0;
                    break;
                }
            }
            endNode = tempNode;
            endOffset = tempOffset;

            // Create the range
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            return range;
        }

        accumulatedText += nodeText;
    }

    return null; // Not found
}

