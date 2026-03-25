# PDF Viewer — `pdf-viewer.js`

[pdf-viewer.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/pdf-viewer.js) handles file uploads, page rendering, and redaction overlay injection. It does **not** use PDF.js — pages are rendered from server-extracted base64 PNG images.

## Functions

### `handleFileUpload()`

Triggered when a file is selected or dropped. Sends the file to `POST /analyze-pdf`, then:

1. Parses the response into `state.pageImages`, `state.numPages`, `state.pageWidth`, `state.pageHeight`
2. Navigates to page 1
3. Renders thumbnails
4. Auto-detects font size and sets `suggested_scale`
5. Initializes each redaction with per-redaction `settings` from the DOM controls
6. Calculates widths for all candidates via `calculateAllWidths()`
7. Injects redaction overlays and selects the first one

### `goToPage(pageNum)`

Switches the viewer to display a specific page:

1. Disposes the Fabric.js canvas for the previous page
2. Clears existing WebGL contexts
3. Creates a new `page-container` div with CSS custom properties for dimensions
4. Inserts an `<img>` element with the base64 page image
5. Creates a WebGL overlay `<canvas>` (visible only if WebGL toggle is active)
6. Calls `setupWebGLOverlay()` and `createPageOverlay()` for the new page
7. Re-injects redaction overlays

### `injectRedactionOverlays()`

Creates interactive overlay divs positioned over each redaction box on the currently visible page:

**Overlay structure:**
```
div.redaction-overlay (id="redaction-idx-{idx}")
  ├── div.resizer.resizer-l     (left edge drag handle)
  ├── div.resizer.resizer-r     (right edge drag handle)
  ├── div.resizer.resizer-t     (top edge drag handle)
  ├── div.resizer.resizer-b     (bottom edge drag handle)
  └── div.redaction-label       (editable text label)
```

**Positioning:** Uses CSS custom properties (`--px-x`, `--px-y`, `--px-width`, `--px-height`) multiplied by `--scale-factor` for zoom-independent positioning.

**Interactions:**
- **Click** → select redaction (`selectRedaction(idx)`)
- **Drag** → move redaction (`initDragRedaction`)
- **Edge drag** → resize redaction (`initResize`)
- **Double-click label** → make label editable (`contentEditable`)
- **Label edit** → sets `manualLabel: true` to prevent auto-override
