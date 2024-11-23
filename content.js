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

                    // If the expanded text contains an image URL, replace with an actual <img> element
                    if (expanded.includes("http") && (expanded.includes(".jpg") || expanded.includes(".png") || expanded.includes(".gif"))) {
                        // Create an image element
                        const img = new Image();
                        img.src = expanded;

                        // Wait for the image to load before inserting
                        img.onload = function() {
                            // If it's a content-editable area
                            if (target.isContentEditable) {
                                const selection = window.getSelection();
                                const range = selection.getRangeAt(0);
                                const node = range.startContainer;

                                // Replace the shortcut with the image element
                                const newText = node.nodeValue.replace(
                                    new RegExp(`${shortcut}$`),
                                    ""
                                );
                                node.nodeValue = newText;

                                // Insert the image at the cursor position
                                const imgNode = document.createElement('img');
                                imgNode.src = img.src;

                                // Insert the image element into the contenteditable div
                                range.insertNode(imgNode);

                                // Move the cursor after the image
                                range.setStartAfter(imgNode);
                                range.setEndAfter(imgNode);
                                selection.removeAllRanges();
                                selection.addRange(range);
                            }
                        };
                    } else {
                        // If no image, just replace the shortcut with expanded text
                        if (
                            target.tagName === "TEXTAREA" ||
                            target.tagName === "INPUT"
                        ) {
                            target.value = replacementText;
                        } else if (target.isContentEditable) {
                            const selection = window.getSelection();
                            const range = selection.getRangeAt(0);
                            const node = range.startContainer;

                            // Replace the shortcut text with expanded text (HTML or plain text)
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

                    // Optionally copy the expanded text with image URL to clipboard
                    navigator.clipboard.writeText(expanded).then(() => {
                        console.log("Text with image URL copied to clipboard.");
                    }).catch((err) => {
                        console.error("Failed to copy text to clipboard: ", err);
                    });
                }
            }
        });
    }
});
