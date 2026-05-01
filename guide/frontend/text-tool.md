# Unified Toolbar — `toolbar.js` + `text-tool.js`

`toolbar.js` manages the formatting toolbar and is the single code path for reading and writing typography properties on any `UnifiedTextBox`. There is no branching on `box.type` — embedded, redaction, and harfbuzz boxes are all handled identically.

`text-tool.js` is the lifecycle/bootstrap layer: it fetches text spans after document load and exposes the tools (`addEmbeddedTextSpan`, `handleManualAddBox`) for placing new boxes.

---

## Toolbar Controls

| Control ID | Property | Notes |
|------------|----------|-------|
| `#fabric-font-family` | `box.fontFamily` | CSS family name (e.g. `"Times New Roman"`) |
| `#fabric-font-size` | `box.fontSize` | Displayed and entered in **pt**; stored internally in px |
| `#fabric-bold` | `box.bold` | Toggle button (`.active` class = on) |
| `#fabric-italic` | `box.italic` | Toggle button |
| `#fabric-underline` | `box.underline` | Toggle button |
| `#fabric-strikethrough` | `box.strikethrough` | Toggle button |
| `#fabric-letter-spacing` | `box.letterSpacing` | em units |
| `#fabric-color` | `box.color` | Hex color; `null` = per-type default |
| `#fabric-justified` | `box.justify` | Checkbox; triggers HarfBuzz space-width fetch when enabled |
| `#fabric-space-width` | `box.spaceWidth` | Slider; active only when `box.justify` is false |

---

## Font Size Units

Font sizes are stored internally in CSS pixels but the toolbar displays and accepts values in points:

```
display pt = box.fontSize × 0.75
stored px  = input pt ÷ 0.75
```

`syncToolbarToBox` converts px → pt when populating the input. `persistFromToolbar` converts the pt input back to px before writing to the box.

---

## `syncToolbarToBox(box)`

Reads from the `UnifiedTextBox` and pushes values into the toolbar UI. Called whenever a box is selected (from `drag-resize.js`) or when the selection changes.

```js
fsInput.value = Math.round(box.fontSize * 0.75 * 100) / 100;  // px → pt
```

Also sets font family, bold/italic/underline/strikethrough active states, letter spacing, color, justify checkbox, and space-width slider.

---

## `persistFromToolbar(box)`

Reads the current toolbar state and writes it directly to the box, then calls `renderBox(box)`.

```js
const inputSize = parseFloat(el('fabric-font-size').value);
box.fontSize = !isNaN(inputSize) ? inputSize / 0.75 : box.fontSize;  // pt → px
```

If `box.justify` was just enabled and the box has text and a width, `fetchJustifiedSpaceWidth(box)` is called to auto-compute `box.spaceWidth` via HarfBuzz.

If `box.type === 'redaction'` and font or size changed, `calculateWidthsForRedaction(box.id)` is called to recalculate the candidate-word width map.

---

## HarfBuzz Justified Space Width

When the Justify checkbox is enabled:

```js
POST /widths
{
  mode: 'justified',
  strings: [box.text],
  block_w: box.w,
  font: 'times.ttf',        // derived from box.fontFamily
  size: box.sizePt || box.fontSize,
  scale: state.pageWidth / 816 * (4/3) * 100,
  kerning: box.kerning,
  ligatures: box.ligatures,
}
→ { space_width: float }    // per-space pixel width
```

The result is written to `box.spaceWidth`. The space-width slider is then disabled (because justify mode controls spacing automatically).

---

## Event Wiring

| Event | Element | Action |
|-------|---------|--------|
| `change` | `#fabric-font-family` | `persistFromToolbar` |
| `input` | `#fabric-font-size` | Live `renderBox` only (no candidate recalc) |
| `change` | `#fabric-font-size` | Full `persistFromToolbar` (with candidate recalc) |
| `click` | bold/italic/underline/strikethrough buttons | Toggle `.active`, `persistFromToolbar` |
| `change` | `#fabric-letter-spacing` | `persistFromToolbar` |
| `input` | `#fabric-color` | `box.color = value`, `renderBox` |
| `change` | `#fabric-justified` | `persistFromToolbar` + HarfBuzz space-width fetch |
| `input` | `#fabric-space-width` | Live `box.spaceWidth = value`, `renderBox`, update display label |

---

## Lifecycle: `text-tool.js`

### Span fetching

`utbFetchSpans(file)` is called after `loadDocument` completes:

1. POST `/embedded-text-viewer/api/extract-spans` → `{ spans: [...] }`
2. Normalizes font sizes (median-pt snap, ±1pt tolerance) on both spans and existing redaction boxes.
3. Removes all existing `type='embedded'` boxes from `utbState` (clean slate for re-fetch).
4. Adds each span as a `UnifiedTextBox` via `spanToUnified(span)`.
5. Calls `renderAllTextLayers()`.
6. Calls `utbConnectRedactionsToLines()` to snap redaction boxes to their overlapping text lines.
7. Calls `calculateAllWidths()` to recalculate redaction candidate widths after normalization.

### `loadDocument` wrapping

`text-tool.js` wraps `window.loadDocument` to reset `utbState` and clear SVG layers before each new document, then triggers span fetching after the original `loadDocument` resolves.

### Placing new boxes

- `window.addEmbeddedTextSpan(pageNum, x, y)`: creates a new `type='embedded'` box, snaps to the nearest text line within `2×` line height, selects it, and opens the toolbar.
- `window.handleManualAddBox(pageNum, x, y)`: delegates to `createNewRedaction()` if available (from `redaction_matching`), otherwise creates a `type='redaction'` box directly.
