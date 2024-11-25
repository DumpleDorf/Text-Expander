document.addEventListener("input", (event) => {
    const target = event.target;

    // Process text areas, input fields, or content-editable elements
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
                // Check if input ends with the shortcut
                if (inputText.endsWith(shortcut)) {
                    console.log(`Shortcut matched: ${shortcut}`); // Debugging: log matched shortcut

                    // Utility function to strip HTML tags
                    const stripHTML = (html) => {
                        const div = document.createElement("div");
                        div.innerHTML = html;

                        // Replace <br> tags with newlines
                        div.innerHTML = div.innerHTML.replace(/<br\s*\/?>/gi, "\n");

                        // Replace <p> tags with double newlines
                        div.innerHTML = div.innerHTML.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");

                        // Remove any remaining HTML tags
                        return div.textContent || div.innerText || "";
                    };

                    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
                        // Replace shortcut with plain text
                        const plainText = stripHTML(expanded);
                        const replacementText = inputText.slice(0, -shortcut.length) + plainText;

                        target.value = replacementText;

                        // Trigger input and change events to ensure the website registers the change
                        const inputEvent = new Event("input", { bubbles: true });
                        const changeEvent = new Event("change", { bubbles: true });
                        target.dispatchEvent(inputEvent);
                        target.dispatchEvent(changeEvent);

                        // Move caret to the end of the expanded text
                        const newCaretPosition = replacementText.length;
                        setTimeout(() => {
                            target.setSelectionRange(newCaretPosition, newCaretPosition);
                        }, 0);
                    } else if (target.isContentEditable) {
                        const selection = window.getSelection();
                        const range = selection.getRangeAt(0);
                        const node = range.startContainer;

                        if (node.nodeType === Node.TEXT_NODE) {
                            const fullText = node.nodeValue;
                            const precedingText = fullText.slice(0, -shortcut.length);

                            // Decide what to insert: plain text for non-rich text fields or expanded HTML for content-editable
                            const fragment = document.createDocumentFragment();
                            const tempDiv = document.createElement("div");
                            tempDiv.innerHTML = expanded;

                            // Append child nodes (HTML content) to the fragment
                            while (tempDiv.firstChild) {
                                fragment.appendChild(tempDiv.firstChild);
                            }

                            // Update the text node to remove the shortcut
                            node.nodeValue = precedingText;

                            // Adjust the range to delete the shortcut and insert the fragment
                            range.setStart(node, precedingText.length);
                            range.deleteContents(); // Remove shortcut text
                            range.insertNode(fragment); // Insert the expanded content

                            // Move the caret to the end of the inserted content
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

                        // Trigger input and change events for content-editable areas
                        const inputEvent = new Event("input", { bubbles: true });
                        const changeEvent = new Event("change", { bubbles: true });
                        target.dispatchEvent(inputEvent);
                        target.dispatchEvent(changeEvent);
                    }
                    break;
                }
            }
        });
    }
});
