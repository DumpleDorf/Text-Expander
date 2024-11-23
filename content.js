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

                    // Check if expanded text contains an image tag or any HTML
                    if (
                        target.tagName === "TEXTAREA" ||
                        target.tagName === "INPUT"
                    ) {
                        target.value = replacementText; // For input fields and textareas
                    } else if (target.isContentEditable) {
                        // Replace shortcut with expanded HTML (e.g., <img src="...">)
                        const selection = window.getSelection();
                        const range = selection.getRangeAt(0);
                        const node = range.startContainer;

                        // Insert expanded text as HTML (e.g., <img> tag will be rendered)
                        const tempDiv = document.createElement("div");
                        tempDiv.innerHTML = expanded; // Parse HTML

                        // Replace content with the parsed HTML
                        node.nodeValue = node.nodeValue.replace(
                            new RegExp(`${shortcut}$`),
                            ""
                        );
                        const fragment = document.createDocumentFragment();
                        while (tempDiv.firstChild) {
                            fragment.appendChild(tempDiv.firstChild);
                        }

                        range.deleteContents();
                        range.insertNode(fragment);

                        // Move the cursor to the end of the expanded content
                        range.setStartAfter(fragment);
                        range.setEndAfter(fragment);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
            }
        });
    }
});
