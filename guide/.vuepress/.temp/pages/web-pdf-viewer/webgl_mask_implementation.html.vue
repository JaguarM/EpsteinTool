<template><div><h1 id="webgl-redaction-mask-implementation-overview" tabindex="-1"><a class="header-anchor" href="#webgl-redaction-mask-implementation-overview"><span>WebGL Redaction Mask: Implementation Overview</span></a></h1>
<p>The WebGL mask system provides a high-performance 60FPS overlay for visualizing redactions dynamically over the PDF. This document explains the full pipeline from the Python backend all the way to the GPU shader.</p>
<h2 id="_1-backend-mask-generation-webgl-mask-logic-artifact-visualizer-py" tabindex="-1"><a class="header-anchor" href="#_1-backend-mask-generation-webgl-mask-logic-artifact-visualizer-py"><span>1. Backend: Mask Generation (<code v-pre>webgl_mask/logic/artifact_visualizer.py</code>)</span></a></h2>
<p>The pipeline begins by analyzing the raw PDF bytes for a specific page using <code v-pre>fitz</code> (PyMuPDF).</p>
<ul>
<li><strong>Rasterization:</strong> The page is rendered to a fixed 816x1056 grayscale image (PNG bytes).</li>
<li><strong>Box Detection (<code v-pre>find_redaction_boxes_in_image</code>):</strong> By scanning the pixel rows, the algorithm identifies hard black rectangles (RGB &lt;= 10,10,10) that represent redacted areas, correctly interpreting intersecting boxes (like T-shapes) and actively filtering out anomalies (like circular hole punches from scanned pages).</li>
<li><strong>Grayscale Mask Synthesis:</strong>
<ul>
<li>An empty (all black, <code v-pre>0</code>) NumPy array of dimensions 816x1056 is created.</li>
<li>The interior of every detected redaction box is painted pure white (<code v-pre>255</code>).</li>
<li><strong>Anti-aliasing:</strong> A precise 1-pixel border along the edge of each box samples inverted pixels from the newly rendered PDF image to ensure smooth edges mapping perfectly against the source text.</li>
</ul>
</li>
<li><strong>Sparse Optimization:</strong> Crucially, if the detection algorithm finds zero redactions on a page, the function immediately returns <code v-pre>None</code> instead of heavily generating an empty, all-black PNG.</li>
</ul>
<h2 id="_2-api-layer-webgl-mask-views-py" tabindex="-1"><a class="header-anchor" href="#_2-api-layer-webgl-mask-views-py"><span>2. API Layer (<code v-pre>webgl_mask/views.py</code>)</span></a></h2>
<p>The Django backend exposes routes to serve these masks, notably <code v-pre>POST /webgl/masks</code>.</p>
<ul>
<li><strong>Asynchronous Processing:</strong> When a PDF is initially uploaded, the main <code v-pre>/analyze-pdf</code> response returns immediately. A second concurrent request is fired from the browser to the <code v-pre>/webgl/masks</code> endpoint.</li>
<li><strong>Batch Generation:</strong> The backend calculates masks for all pages in a single pass using <code v-pre>generate_all_masks(file_bytes)</code> and returns a JSON object containing an array of base64-encoded PNGs.</li>
<li><strong>Resource Conservation:</strong> If no redactions are found on a page, the array contains <code v-pre>null</code> for that index, instructing the frontend to skip WebGL instantiation for that page.</li>
</ul>
<h2 id="_3-frontend-gpu-rendering-webgl-mask-js" tabindex="-1"><a class="header-anchor" href="#_3-frontend-gpu-rendering-webgl-mask-js"><span>3. Frontend: GPU Rendering (<code v-pre>webgl-mask.js</code>)</span></a></h2>
<p>The legacy HTML <code v-pre>div</code> and Fabric.js canvas overlays were completely stripped out. Instead, a secondary purely visual <code v-pre>&lt;canvas class=&quot;webgl-overlay&quot;&gt;</code> is positioned rigidly over the primary PDF rendering canvas.</p>
<h3 id="lazy-instantiation-and-context-limits" tabindex="-1"><a class="header-anchor" href="#lazy-instantiation-and-context-limits"><span>Lazy Instantiation and Context Limits</span></a></h3>
<p>Modern browsers enforce a strict hard limit (often ~16) on the total number of simultaneous WebGL contexts permitted per browser tab. Because large PDFs might have dozens of pages, spinning up a WebGL context for <em>unredacted</em> pages would needlessly burn through these slots and cause a <code v-pre>CONTEXT_LOST_WEBGL</code> system crash.</p>
<p>To fix this, <code v-pre>webgl_mask.js</code> utilizes an <strong>Async Integration Strategy</strong>:</p>
<ol>
<li>When a document finishes analyzing, <code v-pre>fetchMasksAsync</code> is called to request all masks from <code v-pre>/webgl/masks</code>.</li>
<li>Pages already visible (monitored by <code v-pre>IntersectionObserver</code>) check if their mask data has arrived.</li>
<li>Once the async response populates <code v-pre>state.maskImages</code>, <code v-pre>refreshWebGLCanvases()</code> is triggered to initialize WebGL contexts only for the pages where a mask was successfully generated.</li>
<li>This guarantees that WebGL contexts are strictly allocated <em>only</em> for pages containing verifiable redactions, drastically saving GPU memory.</li>
</ol>
<h3 id="shaders-and-blending" tabindex="-1"><a class="header-anchor" href="#shaders-and-blending"><span>Shaders and Blending</span></a></h3>
<p>When a mask PNG is successfully loaded, WebGL kicks in:</p>
<ul>
<li><strong>Hard Pixel Processing:</strong> The internal texture is initialized with <code v-pre>gl.TEXTURE_MIN_FILTER</code> and <code v-pre>gl.MAG_FILTER</code> set to <code v-pre>gl.NEAREST</code>. This ensures that when the browser scales the 816x1056 mask to match your screen's high-DPI zoom ratio, it does not bilinearly blur the edges, but maintains &quot;hard pixel&quot; block boundaries reflecting the original detection exactly.</li>
<li><strong>The Fragment Shader:</strong>
<ul>
<li>A predefined vertex shader draws a perfect quad spanning the bounds of the webgl canvas.</li>
<li>The custom Fragment shader samples the mask (<code v-pre>uMask</code>).</li>
<li>Instead of discarding transparency, the shader applies <em>pre-multiplied alpha blend logic</em>:<div class="language-glsl line-numbers-mode" data-highlighter="prismjs" data-ext="glsl"><pre v-pre><code class="language-glsl"><span class="line"><span class="token keyword">float</span> maskVal <span class="token operator">=</span> <span class="token function">texture2D</span><span class="token punctuation">(</span>uMask<span class="token punctuation">,</span> vTexCoord<span class="token punctuation">)</span><span class="token punctuation">.</span>r<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">float</span> alpha <span class="token operator">=</span> maskVal<span class="token punctuation">;</span> </span>
<span class="line">gl_FragColor <span class="token operator">=</span> <span class="token keyword">vec4</span><span class="token punctuation">(</span>uColor <span class="token operator">*</span> alpha<span class="token punctuation">,</span> alpha<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></li>
<li><code v-pre>maskVal</code> acts as a direct map: pure white (<code v-pre>255</code>) dictates solid <code v-pre>uColor</code>, while variations of gray from the backend anti-aliasing dictate intermediate translucency (<code v-pre>alpha</code>), natively compositing <em>multiplicatively</em> against the PDF browser elements underneath for a flawless tint.</li>
</ul>
</li>
</ul>
<h3 id="real-time-60fps-tinting" tabindex="-1"><a class="header-anchor" href="#real-time-60fps-tinting"><span>Real-Time 60FPS Tinting</span></a></h3>
<p>Whenever the user adjusts the Mask Color sub-toolbar input in the UI, Javascript executes <code v-pre>updateWebGLUniforms()</code>. Instead of redrawing the massive DOM or manipulating images recursively, JavaScript instantly pipes the newly selected RGB values into the <code v-pre>uColor</code> Uniform Location on the graphics card.</p>
<p>The GPU instantly overrides the tint color in the fragment shader against all valid active texture quad bounds completely concurrently, achieving smooth 60FPS dynamic adjustments without ever dropping a frame.</p>
</div></template>


