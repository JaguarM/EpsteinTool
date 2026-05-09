# Architecture Plan: Unified Text Box System

## Goal
To eliminate the fragmented, duplicate logic handling text in this project by creating **one universal text box architecture** that handles Embedded PDF text, Redaction labels, and HarfBuzz recreation text. 

This unified component will be based entirely on the existing Embedded Text View (ETV) architecture, acting as the single source of truth for rendering, formatting, and mathematical layout.

## 1. The Unified Text Box Data Model

Every piece of text on the page will use a standardized JSON structure stored in a single React-like state array:

```javascript
{
  id: "utb-42",
  type: "embedded", // 'embedded', 'redaction', or 'harfbuzz'
  page: 1,
  text: "Review of ESI on the Subject Devices",
  lineId: "1_12",       // groups spans on the same horizontal text line
  
  // Spatial Data (Bounding Box — document pixel space 816×1056)
  x: 105.2, y: 400.1, w: 350.5, h: 14.2,
  
  // Formatting & Typography
  fontFamily: "Times New Roman",
  fontSize: 16.0,       // stored in CSS px (= pt / 0.75)
  sizePt: 12.0,         // PDF points (for HarfBuzz calls)
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  letterSpacing: 0,
  color: null,           // null = per-type default color
  
  // Word Spacing
  kerning: false,
  ligatures: false,
  defaultSpaceWidth: true,   // true = use native font spacing
  spaceWidth: null,          // manual override (used when defaultSpaceWidth is false)
  nativeSpaceWidth: null,    // cached HarfBuzz natural space advance
  
  // Per-character positioning (from PDF extraction or HarfBuzz)
  baseCharPositions: [{c: 'R', x: 0, w: 8.5}, ...],
  
  // Micro-Typography (per-character nudge overrides)
  charAdvances: {
    // index → delta px
    5: +0.5, 
    12: -0.2
  },

  // Redaction-only fields
  widths: {},           // candidate word → pixel width map
  labelText: "",
  tolerance: 3,
  manualLabel: false,
  uppercase: false,
}
```

## 2. Basing it on the Embedded Text View (ETV)

The current ETV spans (`<span class="etv-span">`) are the perfect foundation because they already support absolute positioning and per-character HarfBuzz rendering.

### DOM Rendering Logic
*   **Container**: Every text element is rendered as an absolutely positioned `<div>` or `<span>` using CSS custom properties (`--x`, `--y`, `--w`, `--h`).
*   **Internal Layout**: 
    *   By default, the text is rendered as a string.
    *   If HarfBuzz character data is available (or if `charAdvances` are applied), the string is dynamically split into individual `<i>` elements for every single character.
    *   Spaces (` `) are given explicit pixel widths based on the `spaceWidth` property.

### Behavior by Type
*   `type="embedded"`: Generated automatically by the PDF extractor. Cannot be easily deleted, serves as the ground truth.
*   `type="redaction"`: Created by the user drawing a box. Inherits its initial formatting and justification by "snapping" to the closest `embedded` box.
*   `type="harfbuzz"`: Generated transiently by the Inspector to overlay in a different color to visualize mathematical layout errors.

## 3. The Unified Tooling & Interactions

Because every text box is identical under the hood, we only need **one toolbar** and **one event listener system**.

### The Universal Formatting Toolbar
Clicking *any* text box on the page activates the universal toolbar. Changing "Bold" or space width updates the selected box's state directly, regardless of whether it's a redaction or an embedded string. 

### Space Width & Default Toggle
*   Every box has its own independent `defaultSpaceWidth` boolean and `spaceWidth` float.
*   When `defaultSpaceWidth=true` (the "Default" checkbox is checked), the box uses the font's native space advance.
*   When unchecked, the slider is initialized to the HarfBuzz-measured natural width, and the user can manually adjust word spacing.

### Inline Text Editing (Implemented)

Double-clicking an `embedded` or `harfbuzz` span opens a WYSIWYG inline `<input>` over the span, allowing the user to edit text content directly. **Redaction spans are excluded** — their text is machine-managed by the match engine.

*   `Enter` commits the edit; `Escape` cancels; click-away commits.
*   The input is styled to match the span's font, size, color, weight, and style.

### Individual Character Advance (Implemented)

To support fine-tuning individual character advances without crippling rendering performance on dense OCR pages, the system leverages SVG's native coordinate arrays instead of DOM element wrapping.

1.  **Activation**: The user selects a span, then clicks the **Nudge** button (↔) in the toolbar to enter "Micro-Typography Mode". (This was originally planned as double-click, but double-click was reassigned to inline text editing.)
2.  **Selection**: The user clicks a specific character's bounding area.
3.  **Adjustment**: A small popover UI with a nudging slider appears. Moving the slider updates a local state value for that specific character index.
4.  **Data Flow & Rendering**: 
    *   The adjustment is saved to the `charAdvances` dictionary.
    *   The physical offset is applied by dynamically updating the `x` attribute array on the single SVG `<text>` node. 
    *   Because SVG handles the coordinate space internally, zooming remains perfectly fluid without requiring per-character `calc()` reflows.

## 4. Implementation Status

All planned stages have been completed:

1.  ✅ **Data Structure Migration**: 
    *   `UnifiedTextBox` JavaScript class stores spatial data, `charAdvances`, and all typography properties.
    *   `utbState` is the single source of truth for all text on the page.
2.  ✅ **Universal SVG Renderer** (`svg-renderer.js`): 
    *   `embedded`, `redaction`, and `harfbuzz` types are all drawn using the same `<text>` generator function.
    *   HarfBuzz layout arrays and `charAdvances` are mapped directly into SVG `x` arrays.
3.  ✅ **Toolbar & Event Unification** (`toolbar.js`): 
    *   The formatting toolbar reads/writes strictly from the currently selected `UnifiedTextBox` instance.
4.  ✅ **Micro-Typography Tooling** (`micro-typo.js`):
    *   Nudge button activates per-character hit rects and slider popover.
    *   `charAdvances` dictionary updates the SVG `<text>` coordinate array.
5.  ✅ **Inline Text Editing** (`inline-edit.js`):
    *   Double-click opens a WYSIWYG input overlay for embedded/harfbuzz spans.
    *   Redactions are excluded from editing.
6.  ☐ **Coordinate Extraction Engine (For Python)**: 
    *   Build the function that calculates final absolute document coordinates for the redaction engine.
    *   This function must read the base SVG coordinates, add the explicitly nudged characters, and map them to the true document-scale bounding boxes to send back to the server.