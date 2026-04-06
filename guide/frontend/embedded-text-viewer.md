# Embedded Text Viewer — `embedded-text-viewer.js`

[embedded-text-viewer.js](https://github.com/JaguarM/EpsteinTool/blob/main/embedded_text_viewer/static/embedded_text_viewer/embedded-text-viewer.js) provides the **Automatic Text Extraction** layer. It renders the PDF's underlying text as interactive DOM elements (`.etv-span`) positioned over the page images.

---

## Interactive Text Spans

Unlike the core PDF viewer, which renders images, the ETV creates a transparent overlay of selectable and editable `<div>` elements.

### Metadata Schema
Each span in `etvState.spans` contains:
- `page`: Page number.
- `text`: The character content.
- `x`, `y`, `w`, `h`: Position and dimensions in 816x1056 pixel space.
- `lineId`: A unique string identifier for all spans belonging to the same horizontal line (e.g., `"1_438"`).
- `fontFile`, `fontSize`: Typography metadata used for the [Formatting Bridge](text-tool.md).

---

## Live Geometry Synchronization

The most powerful feature of the ETV is its bidirectional "Live Lock" with the Redaction Matching system.

### 1. Vertical Snapping (On Load)
During the backend processing (`ProcessRedactions.py`), detected redaction boxes are snapped to the nearest text span's vertical position and height. They are then assigned a `lineId` to established a permanent link.

### 2. Synced Dragging
When a user drags an ETV text line vertically (via `initDragETV`), the system identifies all connected redactions using `getConnectedRedactions()`.
- The redaction's `y` property is updated in real-time.
- The CSS variable `--px-y` is updated on the redaction overlay instantly.

### 3. Synced Resizing
When an ETV span is resized vertically (Top or Bottom edges):
- The connected redaction inherits the new `y` and `height`.
- This ensures that if you adjust the text line to match the document's baseline, your "guessed" redactions perfectly follow.

---

## Manual Redaction Snapping

The **Add Box Tool** (see [PDF Viewer](pdf-viewer.md)) uses the `findNearestETVLine()` utility:
1. It searches the current page for a text span within a `2.0x` line-height threshold of the click.
2. If found, it establishes a new `lineId` connection.
3. The new redaction inherits the text line's typography and vertical geometry.

---

## Robustness Features

### Empty Span Deletion
To help clean up noisy PDF extractions (like fragmented dots or artifacts), the ETV implements a **Delete on Empty** policy:
- If a user edits a span, clears all text, and blurs the element, the span is automatically removed from the DOM and the `etvState.spans` array.
- If this was the last span on a specific `lineId`, all connected redactions are automatically disconnected to prevent "ghost" movements.
