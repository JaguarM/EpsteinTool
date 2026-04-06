# Formatting Bridge — `text-tool.js`

[text-tool.js](../../embedded_text_viewer/static/embedded_text_viewer/text-tool.js) manages the **Unified Options Bar** and acts as a formatting bridge between the **Redaction Matcher** and the **Embedded Text Viewer (ETV)**.

It ensures that rich text properties (Bold, Italic, Color, etc.) are synchronized across all interactive text elements in the viewer.

---

## Unified Options Bar

The viewer features a centralized formatting toolbar (`#unified-options-bar-container`) located and shared between the core and the plugins.

### Shared Controls

| Control | ID | Description |
|---------|-----|-------------|
| Font Family | `font` | Dropdown: Arial, Times New Roman, Calibri, Courier New |
| Font Size | `size` | Global font size in points |
| Scale % | `calc-scale` | Width scaling for HarfBuzz measurements |
| Bold | `btn-bold` | Toggle for `font-weight: bold` |
| Italic | `btn-italic` | Toggle for `font-style: italic` |
| Underline | `btn-underline` | Toggle for `text-decoration: underline` |
| Text Color | `color-picker` | Color applied to labels and spans |

---

## The Formatting Bridge

`text-tool.js` tracks the currently focused element via the `document.activeElement`. It listens for changes on any of the toolbar inputs and broadcasts them.

### `text-format-changed` Event

When a formatting property is changed in the toolbar, `text-tool.js` dispatches a `CustomEvent` to the focused element.

**Example Payload:**
```javascript
{
  detail: {
    element: HTMLElement,
    styles: {
      fontWeight: "bold",
      fontStyle: "italic",
      color: "#ff0000",
      ...
    }
  }
}
```

**Participating Modules:**
- **Redaction Matching**: `api.js` listens for this event to update the `state.redactions[idx].settings` so that formatting persists during re-renders.
- **Embedded Text Viewer**: Automatically applies styles to the underlying PDF text layer.

---

## Selection Management

The bridge automatically detects when a `.redaction-label` or an `.etv-span` gains focus. It then:
1. Reads the current styles of the element.
2. Updates the toolbar buttons (e.g., highlighting the "B" button if the text is bold).
3. Ensures the toolbar remains visible and active for as long as a text element is being manipulated.
