# WebGL Redaction Mask: Implementation Overview

The WebGL mask system provides a high-performance 60FPS overlay for visualizing redactions dynamically over the PDF. This document explains the full pipeline from the Python backend all the way to the GPU shader.

## 1. Backend: Mask Generation (`webgl_mask/logic/artifact_visualizer.py`)

The pipeline begins by analyzing the raw PDF bytes for a specific page using `fitz` (PyMuPDF).

- **Rasterization:** The page is rendered to a fixed 816x1056 grayscale image (PNG bytes).
- **Box Detection (`find_redaction_boxes_in_image`):** By scanning the pixel rows, the algorithm identifies hard black rectangles (RGB <= 10,10,10) that represent redacted areas, correctly interpreting intersecting boxes (like T-shapes) and actively filtering out anomalies (like circular hole punches from scanned pages).
- **Grayscale Mask Synthesis:** 
  - An empty (all black, `0`) NumPy array of dimensions 816x1056 is created.
  - The interior of every detected redaction box is painted pure white (`255`).
  - **Anti-aliasing:** A precise 1-pixel border along the edge of each box samples inverted pixels from the newly rendered PDF image to ensure smooth edges mapping perfectly against the source text.
- **Sparse Optimization:** Crucially, if the detection algorithm finds zero redactions on a page, the function immediately returns `None` instead of heavily generating an empty, all-black PNG.

## 2. API Layer (`webgl_mask/views.py`)

The Django backend exposes routes to serve these masks, notably `POST /webgl/masks`.
- **Asynchronous Processing:** When a PDF is initially uploaded, the main `/analyze-pdf` response returns immediately. A second concurrent request is fired from the browser to the `/webgl/masks` endpoint.
- **Batch Generation:** The backend calculates masks for all pages in a single pass using `generate_all_masks(file_bytes)` and returns a JSON object containing an array of base64-encoded PNGs.
- **Resource Conservation:** If no redactions are found on a page, the array contains `null` for that index, instructing the frontend to skip WebGL instantiation for that page.


## 3. Frontend: GPU Rendering (`webgl-mask.js`)

The legacy HTML `div` and Fabric.js canvas overlays were completely stripped out. Instead, a secondary purely visual `<canvas class="webgl-overlay">` is positioned rigidly over the primary PDF rendering canvas.

### Lazy Instantiation and Context Limits
Modern browsers enforce a strict hard limit (often ~16) on the total number of simultaneous WebGL contexts permitted per browser tab. Because large PDFs might have dozens of pages, spinning up a WebGL context for *unredacted* pages would needlessly burn through these slots and cause a `CONTEXT_LOST_WEBGL` system crash.

To fix this, `webgl_mask.js` utilizes an **Async Integration Strategy**:
1. When a document finishes analyzing, `fetchMasksAsync` is called to request all masks from `/webgl/masks`.
2. Pages already visible (monitored by `IntersectionObserver`) check if their mask data has arrived.
3. Once the async response populates `state.maskImages`, `refreshWebGLCanvases()` is triggered to initialize WebGL contexts only for the pages where a mask was successfully generated.
4. This guarantees that WebGL contexts are strictly allocated *only* for pages containing verifiable redactions, drastically saving GPU memory.

### Shaders and Blending
When a mask PNG is successfully loaded, WebGL kicks in:

- **Hard Pixel Processing:** The internal texture is initialized with `gl.TEXTURE_MIN_FILTER` and `gl.MAG_FILTER` set to `gl.NEAREST`. This ensures that when the browser scales the 816x1056 mask to match your screen's high-DPI zoom ratio, it does not bilinearly blur the edges, but maintains "hard pixel" block boundaries reflecting the original detection exactly.
- **The Fragment Shader:** 
  - A predefined vertex shader draws a perfect quad spanning the bounds of the webgl canvas.
  - The custom Fragment shader samples the mask (`uMask`). 
  - Instead of discarding transparency, the shader applies *pre-multiplied alpha blend logic*: 
    ```glsl
    float maskVal = texture2D(uMask, vTexCoord).r;
    float alpha = maskVal; 
    gl_FragColor = vec4(uColor * alpha, alpha);
    ```
  - `maskVal` acts as a direct map: pure white (`255`) dictates solid `uColor`, while variations of gray from the backend anti-aliasing dictate intermediate translucency (`alpha`), natively compositing *multiplicatively* against the PDF browser elements underneath for a flawless tint.

### Real-Time 60FPS Tinting
Whenever the user adjusts the Mask Color sub-toolbar input in the UI, Javascript executes `updateWebGLUniforms()`. Instead of redrawing the massive DOM or manipulating images recursively, JavaScript instantly pipes the newly selected RGB values into the `uColor` Uniform Location on the graphics card.

The GPU instantly overrides the tint color in the fragment shader against all valid active texture quad bounds completely concurrently, achieving smooth 60FPS dynamic adjustments without ever dropping a frame.
