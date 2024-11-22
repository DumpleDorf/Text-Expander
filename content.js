// Listen for user input and replace shortcuts with expanded text
document.addEventListener("input", (event) => {
    // Check if the event is triggered in a content-editable or text area element
    const target = event.target;
    if (target && (target.isContentEditable || target.tagName === "TEXTAREA")) {
        chrome.storage.local.get("shortcuts", (data) => {
            const shortcuts = data.shortcuts || {};
            for (const shortcut in shortcuts) {
                // Use a regular expression to find the shortcut and replace it
                const regex = new RegExp(`\\b${shortcut}\\b`, "g");
                target.innerHTML = target.innerHTML.replace(regex, shortcuts[shortcut]);
            }
        });
    }
});
