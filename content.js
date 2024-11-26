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
                    if (expanded.includes("{")) {
                        showPlaceholderPopup(expanded, (finalText) => {
                            replaceShortcut(target, shortcut, finalText);
                        });
                    } else {
                        replaceShortcut(target, shortcut, expanded);
                    }
                    break;
                }
            }
        });
    }
});

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

// Function to show the placeholder popup
function showPlaceholderPopup(template, callback) {
    const placeholderRegex = /{(.*?)}/g;
    const placeholders = Array.from(template.matchAll(placeholderRegex)).map(match => match[1]);

    // Create the popup HTML dynamically
    const popup = document.createElement("div");
    popup.id = "placeholder-popup";
    popup.style = `
        position: fixed; top: 20%; left: 50%; transform: translate(-50%, -20%);
        background: white; border: 1px solid #ccc; padding: 20px; z-index: 10000;
    `;

    const form = document.createElement("form");

    placeholders.forEach((placeholder) => {
        const label = document.createElement("label");
        label.textContent = `${placeholder}: `;
        const input = document.createElement("input");
        input.type = "text";
        input.name = placeholder;
        input.required = true;
        label.appendChild(input);
        form.appendChild(label);
        form.appendChild(document.createElement("br"));
    });

    const confirmButton = document.createElement("button");
    confirmButton.type = "submit";
    confirmButton.textContent = "Confirm";
    confirmButton.style = "margin-right: 10px;";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    form.appendChild(confirmButton);
    form.appendChild(cancelButton);
    popup.appendChild(form);
    document.body.appendChild(popup);

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        let finalText = template;

        placeholders.forEach((placeholder) => {
            finalText = finalText.replace(`{${placeholder}}`, formData.get(placeholder));
        });

        document.body.removeChild(popup);
        callback(finalText);
    });

    cancelButton.addEventListener("click", () => {
        document.body.removeChild(popup);
    });
}
