# WebGL Mask — `webgl-mask.js`

[webgl-mask.js](file:///c:/Users/yanni/Desktop/EpsteinTool/webgl_mask/static/webgl_mask/webgl-mask.js) renders GPU-accelerated redaction mask overlays using WebGL. It fetches grayscale mask PNGs from the backend asynchronously and composites them over PDF pages using custom shaders and `mix-blend-mode: screen`.

## Architecture

```
POST /webgl/masks
    ↓
`state.maskImages` populated with all base64 masks
    ↓
`refreshWebGLCanvases()`
    ↓
`initWebGLOverlay()` (for visible pages)
    ↓
Load as LUMINANCE texture (NEAREST filtering)
    ↓
Fragment shader: maskVal × uColor × uOpacity → pre-multiplied alpha
    ↓
CSS mix-blend-mode: screen → composited over PDF
```

## Functions

### `fetchMasksAsync(file, isDefault)`
Asynchronously requests all masks for the current document from the `/webgl/masks` endpoint. Once received, it stores them in `state.maskImages` and calls `refreshWebGLCanvases()`.

### `setupWebGLOverlay(pageContainer, canvas, pageNum)`
Registers a page container with the `IntersectionObserver`. When a page becomes visible:
1. `initWebGLOverlay(canvas, pageNum)` is called.
2. If `state.maskImages[pageNum-1]` exists, the texture is loaded.
3. If no mask data exists yet (still loading), the canvas remains hidden until `refreshWebGLCanvases()` triggers.

**Texture setup:**
- Format: `gl.LUMINANCE` (single-channel grayscale)
- Filtering: `gl.NEAREST` (no blurring — preserves hard pixel boundaries)
- Wrapping: `gl.CLAMP_TO_EDGE`

### `clearWebGLContexts()`
Destroys all active WebGL contexts. Called when navigating between pages.

### `updateWebGLUniforms()`
Called when the user changes mask color or opacity controls. Pipes the new values directly into GPU uniforms for instant 60fps updates without re-uploading textures.

## Shaders

### Vertex Shader
Draws a full-screen quad covering the canvas bounds.

### Fragment Shader
```glsl
float maskVal = texture2D(uMask, vTexCoord).r;
float alpha = maskVal * uOpacity;
vec3 invColor = 1.0 - uColor;
gl_FragColor = vec4(invColor * alpha, alpha);
```

- `maskVal`: 0.0 (unredacted) to 1.0 (fully redacted)
- `uColor`: user-selected RGB tint color
- `uOpacity`: slider-controlled opacity (0–255 → 0.0–1.0)

Combined with CSS `mix-blend-mode: screen`:
- **Black mask color** → inverted to white → brightens the PDF underneath
- **White mask color** → inverted to black → no visible change
- **Edge pixels** (gray values from anti-aliased borders) → proportional blend

## UI Controls

| Control | ID | Effect |
|---------|-----|--------|
| Mask color | `mask-color` | RGB value passed to `uColor` uniform |
| Mask opacity | `edge-subtract` | 0–255 range passed to `uOpacity` uniform |
| WebGL toggle | `toggle-webgl` | Shows/hides all `.webgl-overlay` canvases |

## Context Limits

Browsers enforce ~16 simultaneous WebGL contexts. The lazy instantiation strategy ensures contexts are only allocated for pages with actual redactions, preventing `CONTEXT_LOST_WEBGL` crashes on large documents.
