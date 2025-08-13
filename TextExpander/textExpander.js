document.addEventListener("input", (event) => {
    const target = event.target;

    if (
        target &&
        (target.tagName === "TEXTAREA" ||
            target.tagName === "INPUT" ||
            target.isContentEditable)
    ) {
        const inputText =
            target.tagName === "TEXTAREA" || target.tagName === "INPUT"
                ? target.value
                : target.innerText;

        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};

            for (const [shortcut, expanded] of Object.entries(shortcuts)) {
                if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
                    const caretPos = target.selectionStart;
                    const textBeforeCaret = inputText.slice(0, caretPos);
                    const shortcutIndex = textBeforeCaret.lastIndexOf(shortcut);

                    if (shortcutIndex !== -1) {
                        if (expanded.includes("{")) {
                            showPlaceholderPopup(expanded, shortcut, target, (finalText) => {
                                replaceShortcutAtIndex(target, shortcut, finalText, shortcutIndex);
                            });
                        } else {
                            const plainText = stripHTML(expanded);
                            const beforeShortcut = inputText.slice(0, shortcutIndex);
                            const afterShortcut = inputText.slice(shortcutIndex + shortcut.length);
                            const replacementText = beforeShortcut + plainText + afterShortcut;

                            target.value = replacementText;

                            setTimeout(() => {
                                const newCaretPosition = replacementText.length;
                                target.setSelectionRange(newCaretPosition, newCaretPosition);
                            }, 0);

                            target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
                        }
                        break;
                    }
                } else if (target.isContentEditable) {
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;

                    const range = selection.getRangeAt(0);
                    const node = range.startContainer;

                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.nodeValue;
                        const shortcutIndex = text.lastIndexOf(shortcut);

                        if (shortcutIndex !== -1) {
                            if (expanded.includes("{")) {
                                showPlaceholderPopup(expanded, shortcut, target, (finalText) => {
                                    replaceShortcut(target, shortcut, finalText);
                                });
                            } else {
                                const beforeShortcut = text.slice(0, shortcutIndex);
                                const afterShortcut = text.slice(shortcutIndex + shortcut.length);

                                // Replace current text node with text before shortcut
                                node.nodeValue = beforeShortcut;

                                // Insert expanded HTML + caret marker span
                                const tempDiv = document.createElement("div");
                                const MARKER_ID = "__caret_marker";
                                tempDiv.innerHTML = expanded + `<span id="${MARKER_ID}" style="display:none;"></span>`;

                                const fragment = document.createDocumentFragment();
                                while (tempDiv.firstChild) {
                                    fragment.appendChild(tempDiv.firstChild);
                                }

                                const nextSibling = node.nextSibling;
                                if (node.parentNode) {
                                    node.parentNode.insertBefore(fragment, nextSibling);
                                }

                                // Insert leftover text after inserted content
                                if (afterShortcut.length > 0 && node.parentNode) {
                                    const afterNode = document.createTextNode(afterShortcut);
                                    node.parentNode.appendChild(afterNode);
                                }

                                console.log("[Shortcut Expander] Attempting to move caret after inserted content");

                                setTimeout(() => {
                                    const marker = document.getElementById(MARKER_ID);
                                    if (marker && marker.parentNode) {
                                        const range = document.createRange();
                                        const selection = window.getSelection();

                                        range.setStartAfter(marker);
                                        range.collapse(true);

                                        selection.removeAllRanges();
                                        selection.addRange(range);

                                        // Remove the marker from the DOM
                                        marker.remove();

                                        console.log("[Shortcut Expander] Caret moved after marker.");
                                    } else {
                                        console.warn("[Shortcut Expander] Marker not found, placing caret at end of contenteditable.");
                                        const range = document.createRange();
                                        range.selectNodeContents(target);
                                        range.collapse(false);
                                        const selection = window.getSelection();
                                        selection.removeAllRanges();
                                        selection.addRange(range);
                                    }

                                    target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
                                }, 0);
                            }
                            break;
                        }
                    }
                }
            }
        });
    }
});

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
    // Just append text nodes as is
    container.appendChild(document.createTextNode(node.textContent));
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.tagName.toLowerCase() === 'placeholder') {
      // Create an input for this placeholder
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

    // Focus first input automatically
    if (focusFirstInputRef.value) {
    setTimeout(() => {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
    }, 0);
    focusFirstInputRef.value = false;
    }
    } else {
      // For other elements, clone without children then recurse on children
      const elClone = document.createElement(node.tagName);
      // Copy attributes if needed (optional)
      for (const attr of node.attributes) {
        elClone.setAttribute(attr.name, attr.value);
      }
      container.appendChild(elClone);

      // Recurse on children
      node.childNodes.forEach(child => {
        replacePlaceholdersWithInputs(child, elClone, inputs, focusFirstInputRef);
      });
    }
  }
}

// Main popup function:
function showPlaceholderPopup(expandedText, shortcut, targetElement, onConfirm) {
  // Remove any existing overlay first
  const existingOverlay = document.querySelector(".placeholder-popup-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Fix placeholders broken by HTML tags inside {...}
  function fixBrokenPlaceholders(html) {
    // Remove tags inside {...} placeholders so they become clean
    return html.replace(/\{([^}]*)\}/g, (match) => {
      // Remove any HTML tags inside the matched placeholder
      const cleaned = match.replace(/<\/?[^>]+>/g, '');
      return cleaned;
    });
  }

  // Apply fix before processing further
  expandedText = fixBrokenPlaceholders(expandedText);

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "placeholder-popup-overlay"; // Add a class for easier management
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: "9999"
  });

  // Create popup container
  const popup = document.createElement("div");
  Object.assign(popup.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
    zIndex: "10000",
    fontFamily: "Arial, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    width: "700px",
    whiteSpace: "pre-wrap"
  });

  // Container to hold the preview content
  const previewContainer = document.createElement("div");
  previewContainer.style.fontSize = "16px";
  previewContainer.style.lineHeight = "1.5";

  const inputs = [];
  const focusFirstInputRef = { value: true };

  // Strip HTML first, detect raw placeholders
  const plainText = stripHTML(expandedText);

  // Extract unique placeholder names like `{tire}`, `{eta}`
  const placeholders = [...new Set([...plainText.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]))];

  if (placeholders.length === 0) {
    return; // nothing to replace
  }

  // Rebuild HTML with placeholder tags on clean versions
  const sanitized = expandedText.replace(/\{([^{}]*)\}/g, (match, inner) => {
    const stripped = stripHTML(inner);
    return `{${stripped}}`;
  });

  const processedHTML = preprocessPlaceholders(sanitized);

  console.log("[Popup] Raw expandedText:", expandedText);
  console.log("[Popup] Sanitized text:", sanitized);
  console.log("[Popup] Processed HTML:", processedHTML);

  // Parse processed HTML and replace <placeholder> with inputs
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = processedHTML;

  Array.from(tempDiv.childNodes).forEach(child => {
    replacePlaceholdersWithInputs(child, previewContainer, inputs, focusFirstInputRef);
  });

  popup.appendChild(previewContainer);

  // Buttons container
  const buttonContainer = document.createElement("div");
  Object.assign(buttonContainer.style, {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end"
  });

  const confirmButton = document.createElement("button");
  confirmButton.textContent = "Confirm";
  Object.assign(confirmButton.style, {
    background: "#4caf50",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.3s ease"
  });

  confirmButton.addEventListener("mouseover", () => {
    confirmButton.style.background = "#45a049";
  });
  confirmButton.addEventListener("mouseout", () => {
    confirmButton.style.background = "#4caf50";
  });

  confirmButton.addEventListener("click", () => {
    confirmButton.disabled = true; // prevent multiple clicks

    const values = inputs.map(input => input.value.trim());

    let updatedText = expandedText;
    values.forEach((value, index) => {
      const placeholder = inputs[index].placeholder;
      const placeholderPattern = new RegExp(`\\{${escapeRegExp(placeholder)}\\}`, "g");
      updatedText = updatedText.replace(placeholderPattern, value);
    });

    onConfirm(updatedText);

    // Immediately remove overlay and popup
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  });

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  Object.assign(cancelButton.style, {
    background: "#f44336",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.3s ease"
  });

  cancelButton.addEventListener("mouseover", () => {
    cancelButton.style.background = "#d73833";
  });
  cancelButton.addEventListener("mouseout", () => {
    cancelButton.style.background = "#f44336";
  });

  cancelButton.addEventListener("click", () => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  });

  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);

  popup.appendChild(buttonContainer);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Click outside popup closes overlay
  overlay.addEventListener("click", e => {
    if (e.target === overlay) {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }
  });
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