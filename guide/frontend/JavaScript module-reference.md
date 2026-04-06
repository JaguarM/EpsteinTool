# Frontend — JavaScript Module Reference

The frontend is a single-page application built with vanilla JavaScript (no build step). Scripts are loaded in order via `<script>` tags in `index.html`.

## Loading Order

The scripts must load in this exact order because later modules depend on globals defined by earlier ones:

| Order | File | Defines | Depends On |
|-------|------|---------|------------|
| 1 | [state.js](../../guesser_core/static/guesser_core/state.js) | `state`, `els` | DOM elements |
| 2 | [api.js](../../redaction_matching/static/redaction_matching/api.js) | `addName`, `calculateAllWidths`, `renderCandidates`, `selectRedaction`, `updateAllMatchesView` | `state`, `els` |
| 3 | [webgl-mask.js](../../webgl_mask/static/webgl_mask/webgl-mask.js) | `setupWebGLOverlay`, `clearWebGLContexts`, `updateWebGLUniforms`, `fetchMasksAsync` | `state`, `els` |
| 4 | [pdf-viewer.js](../../guesser_core/static/guesser_core/pdf-viewer.js) | `handleFileUpload`, `goToPage`, `injectRedactionOverlays` | `state`, `els`, `api.js`, `webgl-mask.js` |
| 5 | [embedded-text-viewer.js](../../embedded_text_viewer/static/embedded_text_viewer/embedded-text-viewer.js) | `createETVOverlay`, `findNearestETVLine`, `connectRedactionsToETVLines`, `initDragETV` | `state`, `els`, `pdf-viewer.js` |
| 6 | [redaction-matching.js](../../redaction_matching/static/redaction_matching/redaction-matching.js) | `injectMatchingLabel` | `api.js` |
| 7 | [ui-events.js](../../guesser_core/static/guesser_core/ui-events.js) | `updateCSSZoom`, `processZoomFromText`, `initResize`, `initDragRedaction`, `renderThumbnails` | `state`, `els` |
| 8 | [app.js](../../guesser_core/static/guesser_core/app.js) | IIFE — wires all event listeners | All above |
| 9 | [text-tool.js](../../embedded_text_viewer/static/embedded_text_viewer/text-tool.js) | Formatting Toolbar Bridge (CustomEvents) | `state`, `els`, `app.js` |

## External Libraries

| Library | CDN | Purpose |
|---------|-----|---------|
| Fabric.js 5.3.1 | cloudflare | Canvas-based text overlays with drag/resize |
| Material Symbols | Google Fonts | Toolbar icons |
| Inter font | Google Fonts | UI typography |

## Module Documentation

- [State Management](state-management.md) — `state` object schema and `els` DOM cache
- [PDF Viewer](pdf-viewer.md) — File upload, page navigation, redaction overlay rendering
- [API & Candidate Logic](api-and-logic.md) — Width calculation, candidate matching, sort/pagination
- [UI Events](ui-events.md) — Zoom, resize, drag, thumbnails
- [Embedded Text Viewer](embedded-text-viewer.md) — Automatic text spans, bidirectional sync, snapping
- [Formatting Bridge](text-tool.md) — Shared options bar and formatting bridge
- [WebGL Mask](webgl-mask.md) — GPU-accelerated redaction mask rendering
