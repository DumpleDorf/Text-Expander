# Text Expander Options

This project provides a user interface to manage and store text expansion shortcuts. You can add new shortcuts, edit existing ones, and import/export shortcuts from/to a JSON file.

## Features

- **Add/Edit Shortcuts:** Create new shortcuts and their expanded text, or update existing ones.
- **Rich Text Formatting:** Apply bold, italic, underline, numbered, and bullet lists, as well as links, to the expanded text.
- **Save Shortcuts:** Download your shortcuts as a JSON file.
- **Upload Shortcuts:** Import shortcuts from a JSON file and automatically handle duplicates.
- **Dynamic Text Expansion:** The input field will automatically replace shortcuts with their expanded text in real-time.

## How to Use

1. **Add a Shortcut:**
   - Enter a shortcut and its expanded text in the respective fields.
   - Use the rich text toolbar to format the expanded text.
   - Click "Add Shortcut" to save it.

2. **Edit a Shortcut:**
   - Click on a saved shortcut to edit it. The fields will populate with the current shortcut and expanded text, allowing you to modify them.

3. **Download Shortcuts:**
   - Click "Download Shortcuts" to save your current list of shortcuts as a `shortcuts.json` file.

4. **Upload Shortcuts:**
   - Click "Upload Shortcuts" to load a `shortcuts.json` file. Any new shortcuts from the file will be added, and duplicates will be renamed.

## Files

- **HTML:** `index.html` - Contains the UI for managing shortcuts.
- **CSS:** `styles.css` - Styles for the text expander options page.
- **JavaScript:** `options.js` - Contains the logic for adding, editing, saving, and uploading shortcuts.

## Requirements

- Google Chrome or any Chromium-based browser.
- The extension requires Chrome's local storage API for saving shortcuts.

## License

This project is open-source and free to use.
