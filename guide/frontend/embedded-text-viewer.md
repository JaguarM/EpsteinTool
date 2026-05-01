# SVG Text Layer — `svg-renderer.js` + `unified-text-box.js`

The SVG text layer replaces the old DOM-span system. All text on the page — extracted PDF text, redaction labels, and HarfBuzz recreations — is rendered as SVG `<text>` elements in a per-page `<svg class="text-layer">` that sits directly over the page image.

---

## Data Model: `UnifiedTextBox`

Every piece of text is stored as a `UnifiedTextBox` instance inside the global `utbState.boxes` array. There are no separate state objects for spans, redactions, or HarfBuzz text.

```js
{
  id: string,           // stable, e.g. "utb-42"
  type: 'embedded' | 'redaction' | 'harfbuzz',
  page: number,
  text: string,
  lineId: string|null,  // groups spans on the same horizontal text line

  // Spatial — document pixel space (816×1056 base)
  x, y, w, h: float,

  // Typography
  fontFamily: string,
  fontSize: float,      // stored in CSS px (= pt / 0.75)
  sizePt: float|null,   // PDF points, used for HarfBuzz calls
  bold, italic, underline, strikethrough: bool,
  letterSpacing: float,
  color: string|null,   // null = per-type default color

  // Justification
  kerning, ligatures, justify: bool,
  spaceWidth: float|null,  // null = HarfBuzz auto-computed

  // Per-character positioning (from PDF extraction or HarfBuzz)
  baseCharPositions: [{c, x, w}]|null,

  // Micro-typography overrides (index → delta px)
  charAdvances: {},

  // Redaction-only
  widths: {},           // candidate word → pixel width map
  labelText: string,
  tolerance: float,
  manualLabel: bool,
  uppercase: bool,
}
```

### Global state

```js
utbState = {
  boxes: [],           // UnifiedTextBox[]
  selectedId: null,
  microTypoId: null,
  microTypoCharIdx: null,
  // addBox / getBox / removeBox / updateBox / getPageBoxes / reset
}
```

---

## SVG Layer Architecture

### Coordinate system

Each page gets one `<svg class="text-layer" data-page="N" viewBox="0 0 816 1056">` absolutely positioned over the page image. The `viewBox` is fixed — it never changes. Zoom is applied solely through CSS `width`/`height` on the SVG element itself.

This means **all box coordinates are always in document pixel space** — no zoom division or scale math anywhere in the rendering code.

### DOM structure per page

```
.page-container
  img#pageN                  ← PDF page image
  svg.text-layer[data-page]  ← text overlay (same dimensions, absolute)
    g.utb-group[data-id][data-type]
      rect.utb-bbox          ← bounding box outline (visible when selected)
      text.utb-text          ← the actual SVG text element
      rect.utb-edge-l        ← left resize handle (4px, transparent)
      rect.utb-edge-r        ← right resize handle (4px, transparent)
```

### Type colors

| Type | Text fill | Bbox stroke |
|------|-----------|-------------|
| `embedded` | `rgba(0, 100, 255, 0.82)` — blue | blue |
| `redaction` | `rgba(129, 201, 149, 0.90)` — green | green |
| `harfbuzz` | `rgba(255, 140, 0, 0.80)` — orange | orange |

Fill is applied as `text.style.fill` (inline style) so it takes priority over the CSS stylesheet. A custom `box.color` value overrides the type default.

---

## Rendering Pipeline

### `renderBox(box)`

The core function. Creates or updates the `<g>` group and its children for a single box. Call this whenever any box property changes (position, text, font, `charAdvances`, etc.).

1. Finds or creates `<svg class="text-layer">` for the page.
2. Finds or creates `<g data-id="...">`.
3. Updates the bbox rect (`x`, `y`, `width`, `height`, `stroke`).
4. Updates the `<text>` element (see below).
5. Recreates the two edge handle rects.

### `<text>` attribute layout

```js
text.setAttribute('y', computeBaseline(box));       // box.y + box.h * 0.85
text.setAttribute('font-size',   box.fontSize);     // stored in px
text.setAttribute('font-family', '"Times New Roman"');
text.setAttribute('x', xs.join(' '));               // one value per character
text.textContent = box.text;
```

**Per-character x positions** come from `computeXPositions(box)`:

```js
// When baseCharPositions is available:
cumulativeDelta = 0
xs[i] = box.x + baseCharPositions[i].x + cumulativeDelta
cumulativeDelta += charAdvances[i] || 0

// Fallback (no per-char data):
xs = [box.x]
```

The cumulative delta means nudging character `i` shifts characters `i+1`, `i+2`, … by the same amount — which is the correct typographic behavior (shifting a glyph also shifts everything to its right).

### `renderTextLayer(pageContainer, pageNum)`

Clears all existing `<g>` groups in the SVG layer and re-renders every box on that page. Called by `pdf-viewer.js` via `window.renderTextLayer` hook in `goToPage`.

### `renderAllTextLayers()`

Calls `renderTextLayer` for every currently-rendered page. Called after span fetching completes and after font normalization.

---

## Selection

```js
selectBoxInSVG(id)    // adds .selected to matching .utb-group(s), removes from others
deselectAllInSVG()    // clears all .selected
```

The `.selected` class on `.utb-group` makes `.utb-bbox` visible (CSS `visibility: visible`) and changes stroke style. Edge handles are always present but only styled to show a resize cursor on hover.

---

## Embedded Text Ingestion

Text spans are fetched from the backend by `utbFetchSpans(file)` in `text-tool.js` after `loadDocument` completes.

1. POST `/embedded-text-viewer/api/extract-spans` → `{ spans: [...] }`
2. **Font size normalization**: all span `fontSize` values are converted to pt (`px * 0.75`), the median pt is computed, and any span within ±1pt of the median is snapped to that value. This prevents floating-point rounding in the PDF from creating many slightly-different sizes for the same body text.
3. Same normalization is applied retroactively to existing redaction boxes.
4. Old embedded boxes are removed from `utbState.boxes` (avoiding double-render on re-fetch).
5. Each span is converted via `spanToUnified(span)` and added with `utbState.addBox(...)`.
6. `renderAllTextLayers()` is called.
7. `utbConnectRedactionsToLines()` links redaction boxes to their overlapping text lines.

---

## Line Grouping (`lineId`)

The `lineId` field groups all boxes that belong to the same horizontal line of text. It drives two behaviors:

- **Grouped vertical drag** (`drag-resize.js`): dragging any box vertically moves all boxes sharing its `lineId` and `page` by the same `dy`. Linked redaction boxes also follow.
- **Redaction snapping** (`utbConnectRedactionsToLines`): when a redaction's bounding box overlaps an embedded span by ≥30% of the redaction's height, the redaction inherits that span's `lineId`, `y`, and `h`.

---

## Micro-Typography Mode

Double-clicking any `<text class="utb-text">` element enters micro-typography mode for that box (requires `baseCharPositions`).

1. `enterMicroTypo(box)`:
   - Adds `.micro-typo` class to the `<g>` group.
   - Creates one invisible `<rect class="utb-char-hit" data-char-idx="N">` per character, sized to that character's advance width.
2. Clicking a hit rect opens a nudge popover with a slider (−20 to +20 px, step 0.1).
3. `applyNudge(box, charIdx, delta)`:
   - Writes `box.charAdvances[charIdx] = delta`.
   - Recomputes x positions via `computeXPositions(box)`.
   - Updates the SVG `<text>` element with a single `setAttribute('x', ...)` call — no DOM reflow.
   - Repositions all hit rects to match.
4. **Escape** closes the popover (first press) or exits micro-typo mode (second press).
5. Double-clicking outside any text element also exits the mode.

The nudge popover is an absolutely-positioned `<div class="utb-nudge-popover">` placed relative to the `.page-container` element.
