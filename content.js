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
                    
                    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
                        // Replace shortcut in text inputs
                        const replacementText = inputText.slice(0, -shortcut.length) + expanded;
                        target.value = replacementText;

                        // Move caret one position to the right
                        const currentCaretPosition = target.selectionStart;
                        const newCaretPosition = currentCaretPosition + 1;

                        setTimeout(() => {
                            target.setSelectionRange(newCaretPosition, newCaretPosition);
                        }, 0); // Delay to ensure the value update is complete before setting caret

                    } else if (target.isContentEditable) {
                        const selection = window.getSelection();
                        const range = selection.getRangeAt(0);
                        const node = range.startContainer;

                        if (node.nodeType === Node.TEXT_NODE) {
                            const fullText = node.nodeValue;
                            const precedingText = fullText.slice(0, -shortcut.length);

                            // Debugging: log expanded content before inserting it
                            console.log("Expanded content:", expanded);
                            if (!expanded) {
                                console.error("Expanded content is empty or invalid.");
                                return;
                            }

                            // Parse the expanded HTML if it's HTML
                            const tempDiv = document.createElement("div");
                            tempDiv.innerHTML = expanded;

                            const fragment = document.createDocumentFragment();

                            // Check if the content is plain text or HTML
                            if (tempDiv.firstChild && tempDiv.firstChild.nodeType === Node.TEXT_NODE) {
                                // If it's plain text, directly append it as text
                                fragment.appendChild(document.createTextNode(expanded));
                            } else {
                                // Otherwise, append the parsed HTML to the fragment
                                while (tempDiv.firstChild) {
                                    fragment.appendChild(tempDiv.firstChild);
                                }
                            }

                            // Debugging: log fragment content
                            console.log("Fragment content after insertion:", fragment);

                            // Check if fragment is empty
                            if (fragment.childNodes.length === 0) {
                                console.error("Fragment is empty after inserting expanded content.");
                                return;
                            }

                            // Update the text node to remove the shortcut
                            node.nodeValue = precedingText;

                            // Adjust the range to delete the shortcut and insert the fragment
                            range.setStart(node, precedingText.length);
                            range.deleteContents(); // Remove shortcut text
                            range.insertNode(fragment); // Insert the expanded content

                            // Calculate the new caret position
                            const newSelection = window.getSelection();
                            const newRange = document.createRange();
                            const newCaretPosition = precedingText.length + expanded.length;

                            const nodeLength = node.nodeValue.length;
                            if (newCaretPosition <= nodeLength) {
                                const newNode = node.splitText(newCaretPosition);
                                newRange.setStart(newNode, 0);
                                newRange.setEnd(newNode, 0);
                            } else {
                                const lastNode = fragment.lastChild;
                                if (lastNode && lastNode.textContent !== null) {
                                    newRange.setStart(lastNode, lastNode.textContent.length);
                                    newRange.setEnd(lastNode, lastNode.textContent.length);
                                } else {
                                    console.error("No valid lastNode found in the fragment.");
                                    newRange.setStart(node, nodeLength);
                                    newRange.setEnd(node, nodeLength);
                                }
                            }

                            // Set the new selection range (caret position)
                            newSelection.removeAllRanges();
                            newSelection.addRange(newRange);
                        }
                    }
                    break;
                }
            }
        });
    }
});
