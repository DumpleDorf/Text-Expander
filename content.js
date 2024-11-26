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
                if (inputText.endsWith(shortcut)) {
                    const stripHTML = (html) => {
                        const div = document.createElement("div");
                        div.innerHTML = html;

                        div.innerHTML = div.innerHTML.replace(/<br\s*\/?>/gi, "\n");
                        div.innerHTML = div.innerHTML
                            .replace(/<\/p>/gi, "\n\n")
                            .replace(/<p[^>]*>/gi, "");
                        return div.textContent || div.innerText || "";
                    };

                    if (expanded.includes("{")) {
                        showPlaceholderPopup(expanded, shortcut, target, (finalText) => {
                            replaceShortcut(target, shortcut, finalText);
                        });
                    } else {
                        const plainText = stripHTML(expanded);

                        if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
                            const replacementText = inputText.slice(0, -shortcut.length) + plainText;
                            target.value = replacementText;

                            const newCaretPosition = replacementText.length;
                            setTimeout(() => {
                                target.setSelectionRange(newCaretPosition, newCaretPosition);
                            }, 0);
                        } else if (target.isContentEditable) {
                            const selection = window.getSelection();
                            const range = selection.getRangeAt(0);
                            const node = range.startContainer;

                            if (node.nodeType === Node.TEXT_NODE) {
                                const precedingText = node.nodeValue.slice(0, -shortcut.length);
                                node.nodeValue = precedingText;

                                const fragment = document.createDocumentFragment();
                                const tempDiv = document.createElement("div");
                                tempDiv.innerHTML = expanded;

                                Array.from(tempDiv.childNodes).forEach((child) =>
                                    fragment.appendChild(child)
                                );

                                range.setStart(node, precedingText.length);
                                range.deleteContents();
                                range.insertNode(fragment);

                                const lastNode = fragment.lastChild;
                                if (lastNode) {
                                    const newRange = document.createRange();
                                    newRange.setStart(lastNode, lastNode.textContent?.length || 0);
                                    newRange.setEnd(lastNode, lastNode.textContent?.length || 0);

                                    const newSelection = window.getSelection();
                                    newSelection.removeAllRanges();
                                    newSelection.addRange(newRange);
                                }
                            }
                        }
                    }
                    break;
                }
            }
        });
    }
});

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
        // Handle plain text inputs
        console.log("Handling as plain text input...");
        const inputText = target.value;
        const plainText = stripHTML(replacementText); // Ensure no HTML for plain-text fields
        console.log("inputText:", inputText, "plainText:", plainText);

        target.value = inputText.slice(0, -shortcut.length) + plainText;
        console.log("Updated input value:", target.value);

        // Set caret position at the end of the new text
        const newCaretPosition = target.value.length;
        setTimeout(() => {
            target.setSelectionRange(newCaretPosition, newCaretPosition);
            console.log("Caret set at position:", newCaretPosition);
        }, 0);
    } else if (target.isContentEditable) {
        // Handle contentEditable elements
        console.log("Handling contentEditable element...");
        const selection = window.getSelection();
        console.log("Current selection:", selection);

        if (!selection.rangeCount) {
            console.log("No selection available.");
            return;
        }

        const range = selection.getRangeAt(0);
        console.log("Selection range:", range);

        let selectedText = range.toString();
        console.log("Selected text:", selectedText);

        // If selection is empty, check the selected node type
        if (!selectedText) {
            const startNode = range.startContainer;
            console.log("Selection start node:", startNode);

            // Traverse to find a text node if the selection is within an element
            if (startNode.nodeType !== Node.TEXT_NODE) {
                console.log("Traversing to find a text node...");
                let textNode = startNode;
                while (textNode && textNode.nodeType !== Node.TEXT_NODE) {
                    textNode = textNode.firstChild;
                }

                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    selectedText = textNode.nodeValue;
                    console.log("Found text node:", selectedText);
                }
            }
        }

        // Trim any extra whitespace or line breaks from the selected text before comparison
        selectedText = selectedText.trim();
        console.log("Trimmed selected text:", selectedText);

        // Check if the shortcut is in the entire contenteditable area, not just the selected text
        const fullText = target.innerText.trim();
        console.log("Full content of contentEditable:", fullText);

        // If the selected text doesn't match exactly, try finding the shortcut in the full text
        if (fullText.endsWith(shortcut)) {
            console.log("Shortcut found in the full text!");
            const precedingText = fullText.slice(0, fullText.length - shortcut.length);
            console.log("Preceding text:", precedingText);

            // Handle line breaks and insert as <br> tags for each new line
            let formattedText = replacementText.replace(/\n/g, '<br>'); // Replace newlines with <br> tags

            console.log("Formatted HTML with line breaks:", formattedText);

            // Create a temporary div to store the formatted replacement content
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = formattedText;

            console.log("Replacement HTML with formatting:", tempDiv.innerHTML);

            // Replace the content in the contentEditable area with the new HTML
            target.innerHTML = precedingText + tempDiv.innerHTML;

            // Re-select the contentEditable area and place the caret at the end of the inserted content
            const newRange = document.createRange();
            const newSelection = window.getSelection();

            // Move the range to the end of the inserted content
            newRange.selectNodeContents(target); // Select all the contents of the element
            newRange.collapse(false); // Collapse to the end of the content

            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
            console.log("Caret moved to the end of the inserted content");
        } else {
            console.log("Shortcut not found at the end of the selected text.");
        }
    } else {
        console.log("Target is neither a TEXTAREA, INPUT, nor contentEditable.");
    }
}
