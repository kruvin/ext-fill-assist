# Interview Fill Assistant

A Chrome extension (Manifest V3) that assists in documenting interviews and forms in real time with automatic timestamp functionality.

## Features

- **Automatic Timestamping**: After typing a line break, the next non-whitespace character is automatically prefixed with a timestamp
- **Configurable Timestamp Formats**: 
  - Absolute time (HH:mm:ss, HH:mm, or locale format)
  - Relative time from interview start (mm:ss or seconds only)
- **Interview Controls**: Start/stop interview sessions with configurable start times
- **Real-time Processing**: Works on any webpage with text inputs, textareas, and contenteditable elements

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

## Usage

1. **Start an Interview**: Click the extension icon and press "Start Interview"
2. **Configure Timestamps**: Choose between absolute or relative time formats
3. **Begin Typing**: Navigate to any webpage with text inputs and start typing
4. **Automatic Timestamps**: After pressing Enter, the next non-whitespace character will be prefixed with a timestamp

## Configuration Options

### Timestamp Types
- **Absolute Time**: Shows actual time (e.g., [14:30:25])
- **Relative Time**: Shows time elapsed since interview start (e.g., [+05:30])

### Time Formats
- **HH:mm:ss**: 24-hour format with seconds
- **HH:mm**: 24-hour format without seconds  
- **Locale Format**: Uses system locale time format
- **mm:ss**: Minutes and seconds for relative time
- **Seconds Only**: Just elapsed seconds for relative time

## How It Works

The extension monitors text input events across all webpages. When you:
1. Press Enter (line break)
2. Type the next non-whitespace character

The extension automatically inserts a timestamp at the beginning of that line.

## Supported Elements

- `<textarea>` elements
- `<input type="text">` elements  
- Contenteditable elements
- Any element with `contentEditable="true"`

## Privacy

This extension:
- Only processes text input events locally in your browser
- Does not send any data to external servers
- Stores configuration settings locally using Chrome's storage API
- Works entirely offline

## Development

The extension is built with:
- Manifest V3
- Vanilla JavaScript (no external dependencies)
- Chrome Extension APIs
- Modern CSS with responsive design

## File Structure

```
ext-fill-assist/
├── manifest.json          # Extension manifest
├── background.js          # Service worker for state management
├── content.js            # Content script for text processing
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── popup.css             # Popup styling
├── icons/                # Extension icons
└── README.md             # This file
```

## Troubleshooting

1. **Timestamps not appearing**: Make sure the extension is active (green dot in popup)
2. **Not working on specific sites**: Some sites may have security restrictions; try refreshing the page
3. **Configuration not saving**: Check that Chrome storage permissions are granted

## License

MIT License - feel free to modify and distribute.
