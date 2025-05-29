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

// Function to show the popup with placeholders and inputs
function showPlaceholderPopup(expandedText, shortcut, targetElement, onConfirm) {
    // Create background overlay
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "9999";

    // Create popup container
    const popup = document.createElement("div");
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.background = "white";
    popup.style.borderRadius = "12px";
    popup.style.padding = "20px";
    popup.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.2)";
    popup.style.zIndex = "10000";
    popup.style.fontFamily = "Arial, sans-serif";
    popup.style.display = "flex";
    popup.style.flexDirection = "column";
    popup.style.gap = "15px";
    popup.style.width = "500px";

    // Build content with placeholders replaced by input fields
    const previewContainer = document.createElement("div");
    previewContainer.style.fontSize = "16px";
    previewContainer.style.lineHeight = "1.5";

    const inputs = [];
    let focusFirstInput = true;

    const textParts = expandedText.split(/(\{.*?\})/g);
    textParts.forEach((part) => {
        if (part.startsWith("{") && part.endsWith("}")) {
            const placeholder = part.slice(1, -1);

            // Create input field for the placeholder
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = placeholder;
            input.style.border = "1px solid #ccc";
            input.style.borderRadius = "8px";
            input.style.padding = "5px 10px";
            input.style.fontSize = "14px";
            input.style.minWidth = "100px"; // Set a minimum width
            input.style.width = "auto"; // Automatically adjust width based on input

            // Adjust width dynamically as user types
            input.addEventListener("input", () => {
                input.style.width = `${Math.max(100, input.value.length * 10)}px`; // Dynamically adjust the width based on input length
            });

            // Automatically focus the first input field
            if (focusFirstInput) {
                setTimeout(() => input.focus(), 0);
                focusFirstInput = false;
            }

            previewContainer.appendChild(input);
            inputs.push(input);
        } else {
            // Add plain text part
            const span = document.createElement("span");
            span.textContent = stripHTML(part);
            previewContainer.appendChild(span);
        }
    });

    popup.appendChild(previewContainer);

    // Add Confirm and Cancel buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "flex-end";

    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Confirm";
    confirmButton.style.background = "#4caf50";
    confirmButton.style.color = "white";
    confirmButton.style.border = "none";
    confirmButton.style.padding = "8px 16px";
    confirmButton.style.borderRadius = "8px";
    confirmButton.style.cursor = "pointer";
    confirmButton.style.transition = "background 0.3s ease"; // Add smooth transition effect

    // Add hover effect for Confirm button
    confirmButton.addEventListener("mouseover", () => {
        confirmButton.style.background = "#45a049"; // Slightly darker green
    });
    confirmButton.addEventListener("mouseout", () => {
        confirmButton.style.background = "#4caf50"; // Original green
    });

    // Confirm button logic
    confirmButton.addEventListener("click", () => {
        const values = inputs.map((input) =>
            input.value.trim() === "" ? "" : input.value
        );

        let updatedText = expandedText;
        values.forEach((value, index) => {
            const placeholder = inputs[index].placeholder;
            const placeholderPattern = new RegExp(`\\{${placeholder}\\}`, "g");
            updatedText = updatedText.replace(placeholderPattern, value);
        });

        onConfirm(updatedText);

        // Always ensure cleanup happens after confirm, regardless of input type
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }, 50);
    });


    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.style.background = "#f44336";
    cancelButton.style.color = "white";
    cancelButton.style.border = "none";
    cancelButton.style.padding = "8px 16px";
    cancelButton.style.borderRadius = "8px";
    cancelButton.style.cursor = "pointer";
    cancelButton.style.transition = "background 0.3s ease"; // Add smooth transition effect

    // Add hover effect for Cancel button
    cancelButton.addEventListener("mouseover", () => {
        cancelButton.style.background = "#d73833"; // Slightly darker red
    });
    cancelButton.addEventListener("mouseout", () => {
        cancelButton.style.background = "#f44336"; // Original red
    });

    cancelButton.addEventListener("click", () => {
        document.body.removeChild(overlay); // Remove the popup and overlay
    });

    buttonContainer.appendChild(confirmButton);
    buttonContainer.appendChild(cancelButton);

    popup.appendChild(buttonContainer);

    // Add popup and overlay to the document
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close the popup if clicked outside of it
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            document.body.removeChild(overlay); // Remove the popup and overlay
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
