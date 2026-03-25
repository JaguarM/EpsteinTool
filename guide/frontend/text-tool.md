# Text Tool — `text-tool.js`

[text-tool.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/text-tool.js) provides a Fabric.js-based text overlay system for placing editable text on top of PDF pages. It is used to visually type text into redacted regions.

## Core Functions

### `createPageOverlay(pageContainer, pageNum)`
Creates a Fabric.js canvas overlay on top of a page container. The canvas matches the page dimensions and is positioned absolutely.

**Canvas setup:**
- Transparent background
- Selection disabled by default
- Mouse events wired for text insertion

### `resetFabricCanvases()`
Disposes all active Fabric.js canvas instances. Called when a new file is uploaded.

### `onZoomChange(newZoom)`
Called by `updateCSSZoom()` when the zoom level changes. Adjusts Fabric canvas dimensions to match the new zoom scale so that objects remain properly positioned.

## Text Placement

When the text tool is active (toggle button in toolbar):
- **Click on page** → creates a new `fabric.IText` object at the click position
- Text properties are read from the Fabric options bar: font family, font size, scale, bold/italic/underline/strikethrough, letter spacing, and color

## Fabric Options Bar

The `#fabric-options-bar` provides controls for:

| Control | ID | Description |
|---------|-----|-------------|
| Font family | `fabric-font-family` | Dropdown: Arial, Times New Roman, Courier New, Georgia, Verdana |
| Font size | `fabric-font-size` | Number input (px) |
| Horizontal scale | `fabric-font-scale` | Percentage (affects `scaleX`) |
| Bold | `fabric-bold` | Toggle button |
| Italic | `fabric-italic` | Toggle button |
| Underline | `fabric-underline` | Toggle button |
| Strikethrough | `fabric-strikethrough` | Toggle button |
| Letter spacing | `fabric-letter-spacing` | Number input (em units) |
| Text color | `fabric-color` | Color picker |

## Redaction Gap Controls

The `#redact-gap-controls` section appears when relevant:
- **Gap slider** (`redact-gap-slider`): adjusts the width of spaces between text elements to match the gap patterns in the source document
- Displayed as `{value} px` next to the slider
