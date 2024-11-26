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
                // Check if input text ends with a shortcut
                if (inputText.endsWith(shortcut)) {
                    // If expanded text contains placeholders, show popup
                    if (expanded.includes("{")) {
                        showPlaceholderPopup(expanded, shortcut, target, (finalText) => {
                            replaceShortcut(target, shortcut, finalText); // Replace the shortcut with final text
                        });
                    } else {
                        // If no placeholders, directly replace the shortcut
                        replaceShortcut(target, shortcut, expanded);
                    }
                    break;
                }
            }
        });
    }
});

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
    popup.style.width = "600px"; // Set width to 600px

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
            span.textContent = part;
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

// Function to replace the shortcut text
function replaceShortcut(target, shortcut, replacementText) {
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
        const inputText = target.value;
        target.value = inputText.slice(0, -shortcut.length) + replacementText;
    } else if (target.isContentEditable) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        if (node.nodeType === Node.TEXT_NODE) {
            const fullText = node.nodeValue;
            const precedingText = fullText.slice(0, -shortcut.length);
            node.nodeValue = precedingText + replacementText;

            // Move caret to the end of the inserted content
            const newRange = document.createRange();
            newRange.selectNodeContents(node);
            newRange.collapse(false);

            const newSelection = window.getSelection();
            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
        }
    }
}
