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

                            const newCaretPosition = beforeShortcut.length + plainText.length;
                            setTimeout(() => {
                                target.setSelectionRange(newCaretPosition, newCaretPosition);
                            }, 0);

                            target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
                        }
                        break;
                    }
                } else if (target.isContentEditable) {
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const node = range.startContainer;

                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.nodeValue;
                        const shortcutIndex = text.lastIndexOf(shortcut);

                        if (shortcutIndex !== -1) {
                            if (expanded.includes("{")) {
                                showPlaceholderPopup(expanded, shortcut, target, (finalText) => {
                                    // Placeholder logic could be enhanced to target proper node/index
                                    // For now, fall back to full replacement
                                    replaceShortcut(target, shortcut, finalText);
                                });
                            } else {
                                const beforeShortcut = text.slice(0, shortcutIndex);
                                const afterShortcut = text.slice(shortcutIndex + shortcut.length);

                                node.nodeValue = beforeShortcut;

                                const fragment = document.createDocumentFragment();
                                const tempDiv = document.createElement("div");
                                tempDiv.innerHTML = expanded;

                                Array.from(tempDiv.childNodes).forEach((child) =>
                                    fragment.appendChild(child)
                                );

                                range.setStart(node, beforeShortcut.length);
                                range.deleteContents();
                                range.insertNode(fragment);

                                const lastNode = fragment.lastChild;
                                if (lastNode) {
                                    const newRange = document.createRange();
                                    const endOffset = lastNode.textContent?.length || 0;
                                    newRange.setStart(lastNode, endOffset);
                                    newRange.collapse(false); // ⬅️ This ensures no selection, just a cursor

                                    selection.removeAllRanges();
                                    selection.addRange(newRange);
                                }

                                target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
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
        // Get the values from the input fields and handle blank fields
        const values = inputs.map((input) => input.value.trim() === "" ? "" : input.value);

        // Replace the placeholders in the target element with the input values
        let updatedText = expandedText;
        values.forEach((value, index) => {
            const placeholder = inputs[index].placeholder; // Get the placeholder from the input
            const placeholderPattern = new RegExp(`\\{${placeholder}\\}`, 'g');
            updatedText = updatedText.replace(placeholderPattern, value);
        });

        // Call the onConfirm callback with the updated text
        onConfirm(updatedText);

        document.body.removeChild(overlay); // Remove the popup and overlay
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
    console.log("replaceShortcut called with target:", target, "shortcut:", shortcut, "replacementText:", replacementText);

    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
        const inputText = target.value;
        const plainText = stripHTML(replacementText);
        target.value = inputText.slice(0, -shortcut.length) + plainText;

        const newCaretPosition = target.value.length;
        setTimeout(() => {
            target.setSelectionRange(newCaretPosition, newCaretPosition);
        }, 0);

        target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } else if (target.isContentEditable) {
        const fullText = target.innerText.trim();
        if (fullText.endsWith(shortcut)) {
            const precedingText = fullText.slice(0, fullText.length - shortcut.length);
            const formattedText = replacementText.replace(/\n/g, "<br>");
            target.innerHTML = precedingText + formattedText;

            const newRange = document.createRange();
            newRange.selectNodeContents(target);
            newRange.collapse(false);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);

            target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        }
    } else {
        console.error("Target is neither a TEXTAREA, INPUT, nor contentEditable.");
    }
}