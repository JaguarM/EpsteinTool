# State Management — `state.js`

[state.js](https://github.com/JaguarM/EpsteinTool/blob/main/guesser_core/static/guesser_core/state.js) defines two global objects used by all other frontend modules.

## `state` — Application State

```javascript
const state = {
  // PDF Viewer
  pageImages: [],         // data URLs (base64), index 0 = page 1
  numPages: 0,
  pageWidth: 816,         // pixel width of page images
  pageHeight: 1056,       // pixel height of page images
  currentPage: 1,
  currentZoom: 1.0,
  minZoom: 0.5,
  maxZoom: 8.0,
  renderQueue: [],
  fabricCanvases: new Map(),  // page_num → Fabric.Canvas instance

  // Unredactor
  candidates: [...],      // array of name strings (pre-populated with known names)
  redactions: [],         // array of redaction objects (see below)
  selectedRedactionIdx: null,

  // Pagination/Sort
  page: 1,
  perPage: 15,
  sortBy: 'name',         // 'name' or 'width'
  sortDir: 'asc',
  activeTool: null,        // 'add-box' or null
};
```

### Redaction Object Schema

Each item in `state.redactions` is created by `handleFileUpload()`:

```javascript
{
  page: 1,               // 1-based page number
  x: 203.0,              // pixel x coordinate
  y: 438.0,              // pixel y coordinate
  width: 121.53,         // pixel width
  height: 16.0,          // pixel height
  area: 1944.48,         // width × height
  lineId: "1_12",        // ID for linking to ETV text lines

  settings: {            // per-redaction font/matching settings
    font: "times.ttf",
    size: 12,
    scale: 178,
    tol: 3,              // tolerance in pixels for width matching
    kern: true,
    lig: true,
    upper: false
  },

  widths: {},            // { "name": measuredWidth, ... }
  labelText: "",         // current overlay label text
  manualLabel: false     // true if user manually edited the label
}
```

## `els` — DOM Element Cache

All DOM elements are cached at load time to avoid repeated `getElementById` calls:

| Group | Elements |
|-------|----------|
| **Viewer** | `dragOverlay`, `viewerContainer`, `viewer`, `titleElem`, `pageCountElem`, `pageInputElem`, `zoomInputElem`, `zoomInBtn`, `zoomOutBtn`, `sidebar`, `toggleSidebarBtn`, `thumbnailView` |
| **Tools** | `toolsSidebar`, `toggleToolsBtn`, `toolAddBoxBtn`, `toggleWebglBtn`, `webglOptionsBar`, `textOptionsBar`, `maskColor`, `edgeSubtract` |
| **Settings** | `font`, `size`, `calcScale`, `tol`, `kern`, `lig`, `upper` |
| **Data** | `pdfFile`, `nameInput`, `pasteInput`, `tableBody`, `pageInfo` |
| **Matches** | `allMatchesCard`, `allMatchesSummary`, `allMatchesBody` |
