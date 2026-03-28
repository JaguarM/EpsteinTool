<template><div><h1 id="webgl-mask-—-webgl-mask-js" tabindex="-1"><a class="header-anchor" href="#webgl-mask-—-webgl-mask-js"><span>WebGL Mask — <code v-pre>webgl-mask.js</code></span></a></h1>
<p>[webgl-mask.js](file:///c:/Users/yanni/Desktop/EpsteinTool/webgl_mask/static/webgl_mask/webgl-mask.js) renders GPU-accelerated redaction mask overlays using WebGL. It fetches grayscale mask PNGs from the backend asynchronously and composites them over PDF pages using custom shaders and <code v-pre>mix-blend-mode: screen</code>.</p>
<h2 id="architecture" tabindex="-1"><a class="header-anchor" href="#architecture"><span>Architecture</span></a></h2>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">POST /webgl/masks</span>
<span class="line">    ↓</span>
<span class="line">`state.maskImages` populated with all base64 masks</span>
<span class="line">    ↓</span>
<span class="line">`refreshWebGLCanvases()`</span>
<span class="line">    ↓</span>
<span class="line">`initWebGLOverlay()` (for visible pages)</span>
<span class="line">    ↓</span>
<span class="line">Load as LUMINANCE texture (NEAREST filtering)</span>
<span class="line">    ↓</span>
<span class="line">Fragment shader: maskVal × uColor × uOpacity → pre-multiplied alpha</span>
<span class="line">    ↓</span>
<span class="line">CSS mix-blend-mode: screen → composited over PDF</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="functions" tabindex="-1"><a class="header-anchor" href="#functions"><span>Functions</span></a></h2>
<h3 id="fetchmasksasync-file-isdefault" tabindex="-1"><a class="header-anchor" href="#fetchmasksasync-file-isdefault"><span><code v-pre>fetchMasksAsync(file, isDefault)</code></span></a></h3>
<p>Asynchronously requests all masks for the current document from the <code v-pre>/webgl/masks</code> endpoint. Once received, it stores them in <code v-pre>state.maskImages</code> and calls <code v-pre>refreshWebGLCanvases()</code>.</p>
<h3 id="setupwebgloverlay-pagecontainer-canvas-pagenum" tabindex="-1"><a class="header-anchor" href="#setupwebgloverlay-pagecontainer-canvas-pagenum"><span><code v-pre>setupWebGLOverlay(pageContainer, canvas, pageNum)</code></span></a></h3>
<p>Registers a page container with the <code v-pre>IntersectionObserver</code>. When a page becomes visible:</p>
<ol>
<li><code v-pre>initWebGLOverlay(canvas, pageNum)</code> is called.</li>
<li>If <code v-pre>state.maskImages[pageNum-1]</code> exists, the texture is loaded.</li>
<li>If no mask data exists yet (still loading), the canvas remains hidden until <code v-pre>refreshWebGLCanvases()</code> triggers.</li>
</ol>
<p><strong>Texture setup:</strong></p>
<ul>
<li>Format: <code v-pre>gl.LUMINANCE</code> (single-channel grayscale)</li>
<li>Filtering: <code v-pre>gl.NEAREST</code> (no blurring — preserves hard pixel boundaries)</li>
<li>Wrapping: <code v-pre>gl.CLAMP_TO_EDGE</code></li>
</ul>
<h3 id="clearwebglcontexts" tabindex="-1"><a class="header-anchor" href="#clearwebglcontexts"><span><code v-pre>clearWebGLContexts()</code></span></a></h3>
<p>Destroys all active WebGL contexts. Called when navigating between pages.</p>
<h3 id="updatewebgluniforms" tabindex="-1"><a class="header-anchor" href="#updatewebgluniforms"><span><code v-pre>updateWebGLUniforms()</code></span></a></h3>
<p>Called when the user changes mask color or opacity controls. Pipes the new values directly into GPU uniforms for instant 60fps updates without re-uploading textures.</p>
<h2 id="shaders" tabindex="-1"><a class="header-anchor" href="#shaders"><span>Shaders</span></a></h2>
<h3 id="vertex-shader" tabindex="-1"><a class="header-anchor" href="#vertex-shader"><span>Vertex Shader</span></a></h3>
<p>Draws a full-screen quad covering the canvas bounds.</p>
<h3 id="fragment-shader" tabindex="-1"><a class="header-anchor" href="#fragment-shader"><span>Fragment Shader</span></a></h3>
<div class="language-glsl line-numbers-mode" data-highlighter="prismjs" data-ext="glsl"><pre v-pre><code class="language-glsl"><span class="line"><span class="token keyword">float</span> maskVal <span class="token operator">=</span> <span class="token function">texture2D</span><span class="token punctuation">(</span>uMask<span class="token punctuation">,</span> vTexCoord<span class="token punctuation">)</span><span class="token punctuation">.</span>r<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">float</span> alpha <span class="token operator">=</span> maskVal <span class="token operator">*</span> uOpacity<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">vec3</span> invColor <span class="token operator">=</span> <span class="token number">1.0</span> <span class="token operator">-</span> uColor<span class="token punctuation">;</span></span>
<span class="line">gl_FragColor <span class="token operator">=</span> <span class="token keyword">vec4</span><span class="token punctuation">(</span>invColor <span class="token operator">*</span> alpha<span class="token punctuation">,</span> alpha<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><ul>
<li><code v-pre>maskVal</code>: 0.0 (unredacted) to 1.0 (fully redacted)</li>
<li><code v-pre>uColor</code>: user-selected RGB tint color</li>
<li><code v-pre>uOpacity</code>: slider-controlled opacity (0–255 → 0.0–1.0)</li>
</ul>
<p>Combined with CSS <code v-pre>mix-blend-mode: screen</code>:</p>
<ul>
<li><strong>Black mask color</strong> → inverted to white → brightens the PDF underneath</li>
<li><strong>White mask color</strong> → inverted to black → no visible change</li>
<li><strong>Edge pixels</strong> (gray values from anti-aliased borders) → proportional blend</li>
</ul>
<h2 id="ui-controls" tabindex="-1"><a class="header-anchor" href="#ui-controls"><span>UI Controls</span></a></h2>
<table>
<thead>
<tr>
<th>Control</th>
<th>ID</th>
<th>Effect</th>
</tr>
</thead>
<tbody>
<tr>
<td>Mask color</td>
<td><code v-pre>mask-color</code></td>
<td>RGB value passed to <code v-pre>uColor</code> uniform</td>
</tr>
<tr>
<td>Mask opacity</td>
<td><code v-pre>edge-subtract</code></td>
<td>0–255 range passed to <code v-pre>uOpacity</code> uniform</td>
</tr>
<tr>
<td>WebGL toggle</td>
<td><code v-pre>toggle-webgl</code></td>
<td>Shows/hides all <code v-pre>.webgl-overlay</code> canvases</td>
</tr>
</tbody>
</table>
<h2 id="context-limits" tabindex="-1"><a class="header-anchor" href="#context-limits"><span>Context Limits</span></a></h2>
<p>Browsers enforce ~16 simultaneous WebGL contexts. The lazy instantiation strategy ensures contexts are only allocated for pages with actual redactions, preventing <code v-pre>CONTEXT_LOST_WEBGL</code> crashes on large documents.</p>
</div></template>


