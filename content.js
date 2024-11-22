document.addEventListener("input", (event) => {
    const target = event.target;

    // Only process inputs in text areas, input fields, or content-editable elements
    if (
        target &&
        (target.tagName === "TEXTAREA" ||
            target.tagName === "INPUT" ||
            target.isContentEditable)
    ) {
        // Get the value of the field (or inner text for content-editable elements)
        const inputText =
            target.tagName === "TEXTAREA" || target.tagName === "INPUT"
                ? target.value
                : target.innerText;

        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};

            // Loop through shortcuts to find matches
            for (const [shortcut, expanded] of Object.entries(shortcuts)) {
                // Check if the input ends with the shortcut
                if (inputText.endsWith(shortcut)) {
                    const replacementText = inputText.slice(
                        0,
                        inputText.length - shortcut.length
                    ) + expanded;

                    // Replace the shortcut with expanded text
                    if (
                        target.tagName === "TEXTAREA" ||
                        target.tagName === "INPUT"
                    ) {
                        target.value = replacementText;
                    } else if (target.isContentEditable) {
                        const selection = window.getSelection();
                        const range = selection.getRangeAt(0);
                        const node = range.startContainer;

                        // Replace the shortcut text with expanded text
                        const newText = node.nodeValue.replace(
                            new RegExp(`${shortcut}$`),
                            expanded
                        );
                        node.nodeValue = newText;

                        // Move the cursor to the end of the replacement
                        range.setStart(node, newText.length);
                        range.setEnd(node, newText.length);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
            }
        });
    }
});
