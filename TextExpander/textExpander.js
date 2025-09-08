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

    // Replace <br> tags with newlines
    div.innerHTML = div.innerHTML.replace(/<br\s*\/?>/gi, "\n");

    // Replace <p> tags with double newlines
    div.innerHTML = div.innerHTML.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");

    // Remove <span> and other inline tags while preserving their content
    div.innerHTML = div.innerHTML.replace(/<\/?span[^>]*>/gi, "");

    // Strip any remaining HTML tags
    return div.textContent || div.innerText || "";
}

// Utility to escape RegExp special characters (for placeholder replacement)
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wrap all {placeholder} occurrences with <placeholder> tags for easier parsing
function preprocessPlaceholders(text) {
  // Escape HTML entities if needed? (depends on your input)
  // Basic approach: replace {placeholder} with <placeholder>placeholder</placeholder>
  // Use a global regex to capture {word} patterns (no nested {})
  return text.replace(/\{([^{}]+)\}/g, (match, p1) => `<placeholder>${p1}</placeholder>`);
}

// Recursively replaces <placeholder> elements with <input> fields in the container
// nodes can be text nodes or elements
function replacePlaceholdersWithInputs(node, container, inputs, focusFirstInputRef) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    const parts = text.split(/(\{[^}]+\})/g); // split text by {placeholder}
    parts.forEach(part => {
      const match = part.match(/^\{([^}]+)\}$/);
      if (match) {
        // It's a placeholder
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

        // Focus first input automatically
        if (focusFirstInputRef.value) {
          setTimeout(() => {
            input.focus();
            const length = input.value.length;
            input.setSelectionRange(length, length);
          }, 0);
          focusFirstInputRef.value = false;
        }
      } else if (part) {
        // Normal text
        container.appendChild(document.createTextNode(part));
      }
    });
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.tagName.toLowerCase() === 'placeholder') {
      // In case you already have <placeholder> nodes
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
      // Clone element
      const elClone = document.createElement(node.tagName);
      for (const attr of node.attributes) elClone.setAttribute(attr.name, attr.value);
      container.appendChild(elClone);

      node.childNodes.forEach(child => {
        replacePlaceholdersWithInputs(child, elClone, inputs, focusFirstInputRef);
      });
    }
  }
}



// Main popup function:
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

    // Strip any HTML for clean preview
    const cleanText = stripHTML(expandedText);

    // Split paragraphs by double newline
    const paragraphs = cleanText.split(/\n\s*\n/);

    paragraphs.forEach(paragraphText => {
        const pDiv = document.createElement("div");
        pDiv.style.display = "block";

        // Split by single newline for <br> line breaks
        const lines = paragraphText.split(/\n/);

        lines.forEach((lineText, lineIndex) => {
            const parts = lineText.split(/(\{[^}]+\})/g);
            parts.forEach(part => {
                const match = part.match(/^\{([^}]+)\}$/);
                if (match) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.placeholder = match[1];
                    input.style.cssText = `
                        display: inline-block;
                        margin: 0 3px 2px 3px; /* <-- add bottom margin for vertical spacing */
                        padding: 4px 8px;
                        font-size: 14px;
                        border-radius: 6px;
                        border: 1px solid #ccc;
                        outline: none;
                        transition: all 0.2s ease;
                        min-width: 70px;
                        box-sizing: border-box;
                    `;
                    input.addEventListener("focus", () => {
                        input.style.boxShadow = "0 0 6px rgba(128,191,255,0.25)";
                        input.style.borderColor = "#80bfff";
                    });
                    input.addEventListener("blur", () => {
                        input.style.boxShadow = "none";
                        input.style.borderColor = "#ccc";
                    });
                    pDiv.appendChild(input);
                    inputs.push(input);

                    if (focusFirstInputRef.value) {
                        setTimeout(() => input.focus(), 0);
                        focusFirstInputRef.value = false;
                    }
                } else if (part) {
                    pDiv.appendChild(document.createTextNode(part));
                }
            });

            // Add <br> if not last line in paragraph
            if (lineIndex < lines.length - 1) pDiv.appendChild(document.createElement("br"));
        });

        popup.appendChild(pDiv);
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
    cancelButton.addEventListener("mouseover", () => cancelButton.style.background = "#e74c3c");
    cancelButton.addEventListener("mouseover", () => cancelButton.style.color = "#fff");
    cancelButton.addEventListener("mouseout", () => {
        cancelButton.style.background = "transparent";
        cancelButton.style.color = "#e74c3c";
    });
    cancelButton.addEventListener("click", closePopup);

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
    confirmButton.addEventListener("mouseover", () => {
        confirmButton.style.background = "#2c7ac9";
        confirmButton.style.color = "#fff"; // text always readable on hover
    });
    confirmButton.addEventListener("mouseout", () => {
        confirmButton.style.background = "#3498db";
        confirmButton.style.color = "#fff";
    });
    confirmButton.addEventListener("click", () => {
        const values = inputs.map(input => input.value.trim());
        let updatedText = cleanText;
        values.forEach((val, idx) => {
            const ph = inputs[idx].placeholder;
            updatedText = updatedText.replace(new RegExp(`\\{${escapeRegExp(ph)}\\}`, "g"), val);
        });
        onConfirm(updatedText);
        closePopup();
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    popup.appendChild(buttonContainer);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Focus first input after added to DOM
    if (inputs.length > 0) setTimeout(() => inputs[0].focus(), 0);

    // Close on outside click
    overlay.addEventListener("click", e => { if (e.target === overlay) closePopup(); });

    function closePopup() {
        popup.style.animation = "popupOut 0.15s ease forwards";
        overlay.style.animation = "fadeOut 0.15s ease forwards";
        setTimeout(() => overlay.remove(), 150);
    }

    // Escape key closes
    document.addEventListener("keydown", function escHandler(e) {
        if (e.key === "Escape") { closePopup(); document.removeEventListener("keydown", escHandler); }
    });

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




function replaceShortcut(target, shortcut, replacementText) {
    console.log("[Shortcut Expander] Rich text replacement starting...");

    if (!target.isContentEditable) {
        console.error("Target is not contentEditable.");
        return;
    }

    // Find the Range that matches the shortcut text inside the contentEditable
    const range = findRangeForText(target, shortcut);

    if (!range) {
        console.warn("[Shortcut Expander] Shortcut not found in contentEditable.");
        return;
    }

    // Delete the contents of the shortcut text
    range.deleteContents();

    // Create replacement nodes from replacementText (replace newlines with <br>)
    const tempDiv = document.createElement("div");
    const MARKER_ID = "__caret_marker";
    tempDiv.innerHTML = replacementText.replace(/\n/g, "<br>") + `<span id="${MARKER_ID}" style="display:none;"></span>`;

    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }

    // Insert the replacement fragment at the range start
    range.insertNode(fragment);

    // Move the caret after the inserted content
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

function findRangeForText(node, textToFind) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    let currentNode;
    let accumulatedText = "";
    let startNode = null;
    let startOffset = 0;

    while ((currentNode = walker.nextNode())) {
        const nodeText = currentNode.nodeValue;
        const startIndex = accumulatedText.length;
        const endIndex = startIndex + nodeText.length;

        const shortcutIndex = textToFind ? accumulatedText.indexOf(textToFind) : -1;

        // Instead of accumulatedText, do this below:

        const fullText = accumulatedText + nodeText;
        const index = fullText.indexOf(textToFind);

        if (index !== -1) {
            // Found shortcut spanning potentially multiple nodes

            // Calculate start node and offset
            if (!startNode) {
                startNode = currentNode;
                startOffset = index - accumulatedText.length;
            }

            // Now find end node and offset (where the shortcut ends)
            const endPos = index + textToFind.length;

            // We now have start and end in full text, but we need nodes
            // To do this, we must continue walking nodes until accumulatedText >= endPos

            let endNode = currentNode;
            let endOffset;

            let tempNode = currentNode;
            let tempAccum = fullText.length;

            while (tempAccum < endPos) {
                tempNode = walker.nextNode();
                if (!tempNode) break;
                tempAccum += tempNode.nodeValue.length;
                endNode = tempNode;
            }

            endOffset = endPos - (tempAccum - endNode.nodeValue.length);

            // Create range
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            return range;
        }

        accumulatedText += nodeText;
    }

    return null; // not found
}

