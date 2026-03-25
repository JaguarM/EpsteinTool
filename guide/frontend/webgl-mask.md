# WebGL Mask — `webgl-mask.js`

[webgl-mask.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/webgl-mask.js) renders GPU-accelerated redaction mask overlays using WebGL. It fetches grayscale mask PNGs from the backend and composites them over PDF pages using custom shaders and `mix-blend-mode: screen`.

## Architecture

```
GET /mask/{page_num}
    ↓
Fetch mask PNG (or 404 → destroy canvas)
    ↓
Load as LUMINANCE texture (NEAREST filtering)
    ↓
Fragment shader: maskVal × uColor × uOpacity → pre-multiplied alpha
    ↓
CSS mix-blend-mode: screen → composited over PDF
```

## Functions

### `setupWebGLOverlay(pageContainer, canvas, pageNum)`

**Lazy instantiation strategy** to respect browser WebGL context limits (~16 per tab):

1. Fetches `GET /mask/{pageNum}` before creating any WebGL context
2. If response is `404` (no redactions) → removes the canvas element entirely
3. Only if a mask exists → initializes WebGL, loads shaders, uploads texture

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
