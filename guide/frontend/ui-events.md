# UI Events — `ui-events.js`

[ui-events.js](../../guesser_core/static/guesser_core/ui-events.js) handles zoom controls, redaction box resizing/dragging, and thumbnail rendering.

## Zoom

### `updateZoomLevelText()`
Syncs the zoom input display with `state.currentZoom`.

### `updateCSSZoom()`
Applies the current zoom by setting the `--scale-factor` CSS custom property on the viewer. Also calls `onZoomChange()` if defined (used by the text tool to update Fabric canvas dimensions).

### `processZoomFromText(newZoom, mouseX?, mouseY?)`
Constrains the zoom to `[minZoom, maxZoom]`, updates `state.currentZoom`, and applies. When mouse coordinates are provided (Ctrl+Wheel), preserves the document position under the cursor by adjusting scroll offsets.

**Zoom is CSS-only** — no canvas re-rendering is needed because pages are `<img>` elements that scale via CSS transforms.

## Redaction Resizing

### `initResize(e, idx, edge)`
Called when a user drags one of the four edge handles (`l`, `r`, `t`, `b`):

1. Captures start position and dimensions
2. On `mousemove`: updates `r.x` / `r.y` / `r.width` / `r.height` based on drag delta, scaled by `1/currentZoom`
3. Updates overlay CSS custom properties in real-time
4. Re-evaluates matches for the affected redaction (live)
5. Updates the match summary count
6. On `mouseup`: removes listeners

## Redaction Dragging

### `initDragRedaction(e, idx)`
Called on mousedown on a redaction overlay (not on a resizer or label):

1. Captures start position
2. On `mousemove`: updates `r.x` and `r.y` based on delta, scaled by `1/currentZoom`
3. Moves the overlay via CSS custom properties
4. On `mouseup`: removes listeners

## Thumbnails

### `renderThumbnails()`
Builds the sidebar thumbnail strip from `state.pageImages`. Each thumbnail is a 180px-wide `<img>` with a page number label. Clicking navigates to that page via `goToPage()`. The active page gets the `.active` class.
