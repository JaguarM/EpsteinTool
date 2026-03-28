# Frontend — JavaScript Module Reference

The frontend is a single-page application built with vanilla JavaScript (no build step). Scripts are loaded in order via `<script>` tags in `index.html`.

## Loading Order

The scripts must load in this exact order because later modules depend on globals defined by earlier ones:

| Order | File | Defines | Depends On |
|-------|------|---------|------------|
| 1 | [state.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/state.js) | `state`, `els` | DOM elements |
| 2 | [api.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/api.js) | `addName`, `calculateAllWidths`, `renderCandidates`, `selectRedaction`, `updateAllMatchesView` | `state`, `els` |
| 3 | [webgl-mask.js](file:///c:/Users/yanni/Desktop/EpsteinTool/webgl_mask/static/webgl_mask/webgl-mask.js) | `setupWebGLOverlay`, `clearWebGLContexts`, `updateWebGLUniforms`, `fetchMasksAsync` | `state`, `els` |
| 4 | [pdf-viewer.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/pdf-viewer.js) | `handleFileUpload`, `goToPage`, `injectRedactionOverlays` | `state`, `els`, api.js, webgl-mask.js |
| 5 | [ui-events.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/ui-events.js) | `updateCSSZoom`, `processZoomFromText`, `initResize`, `initDragRedaction`, `renderThumbnails` | `state`, `els` |
| 6 | [app.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/app.js) | IIFE — wires all event listeners | All above |
| 7 | [text-tool.js](file:///c:/Users/yanni/Desktop/EpsteinTool/text_tool/static/text_tool/text-tool.js) | `createPageOverlay`, `resetFabricCanvases`, `onZoomChange` | `state`, `els`, Fabric.js |

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
- [Text Tool](text-tool.md) — Fabric.js text overlay system
- [WebGL Mask](webgl-mask.md) — GPU-accelerated redaction mask rendering
