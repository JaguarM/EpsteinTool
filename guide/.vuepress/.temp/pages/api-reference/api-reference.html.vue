<template><div><h1 id="api-reference" tabindex="-1"><a class="header-anchor" href="#api-reference"><span>API Reference</span></a></h1>
<p>The Django backend exposes several HTTP endpoints organized into modular apps.</p>
<blockquote>
<p><strong>Note:</strong> All POST endpoints use <code v-pre>@csrf_exempt</code> — no CSRF token is required. There is no authentication.</p>
</blockquote>
<h2 id="endpoints" tabindex="-1"><a class="header-anchor" href="#endpoints"><span>Endpoints</span></a></h2>
<h3 id="guesser-core-base-viewer" tabindex="-1"><a class="header-anchor" href="#guesser-core-base-viewer"><span><code v-pre>guesser_core</code> (Base Viewer)</span></a></h3>
<table>
<thead>
<tr>
<th>Method</th>
<th>Path</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>GET</code></td>
<td><code v-pre>/</code></td>
<td>Serves the single-page application</td>
</tr>
<tr>
<td><code v-pre>POST</code></td>
<td><code v-pre>/analyze-pdf</code></td>
<td>Upload a PDF or image for redaction analysis</td>
</tr>
<tr>
<td><code v-pre>GET</code></td>
<td><code v-pre>/analyze-default</code></td>
<td>Processes the bundled default PDF</td>
</tr>
</tbody>
</table>
<h3 id="text-tool-typography-plugin" tabindex="-1"><a class="header-anchor" href="#text-tool-typography-plugin"><span><code v-pre>text_tool</code> (Typography Plugin)</span></a></h3>
<table>
<thead>
<tr>
<th>Method</th>
<th>Path</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>POST</code></td>
<td><code v-pre>/widths</code></td>
<td>Calculate pixel widths for candidate text strings</td>
</tr>
<tr>
<td><code v-pre>GET</code></td>
<td><code v-pre>/fonts-list</code></td>
<td>List available font files</td>
</tr>
</tbody>
</table>
<h3 id="webgl-mask-gpu-visualization-plugin" tabindex="-1"><a class="header-anchor" href="#webgl-mask-gpu-visualization-plugin"><span><code v-pre>webgl_mask</code> (GPU Visualization Plugin)</span></a></h3>
<table>
<thead>
<tr>
<th>Method</th>
<th>Path</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>POST</code></td>
<td><code v-pre>/webgl/masks</code></td>
<td>Generate all redaction masks for an uploaded PDF</td>
</tr>
<tr>
<td><code v-pre>GET</code></td>
<td><code v-pre>/webgl/masks?default=true</code></td>
<td>Generate all masks for the default PDF</td>
</tr>
</tbody>
</table>
<hr>
<h2 id="post-analyze-pdf" tabindex="-1"><a class="header-anchor" href="#post-analyze-pdf"><span><code v-pre>POST /analyze-pdf</code></span></a></h2>
<p>Upload a file (PDF or image) for redaction box detection and text span extraction.</p>
<h3 id="request" tabindex="-1"><a class="header-anchor" href="#request"><span>Request</span></a></h3>
<ul>
<li><strong>Content-Type:</strong> <code v-pre>multipart/form-data</code></li>
<li><strong>Body:</strong> Form field <code v-pre>file</code> containing the uploaded file</li>
</ul>
<p>Supported formats:</p>
<ul>
<li>PDF (<code v-pre>application/pdf</code>)</li>
<li>Images: PNG, JPEG, TIFF, BMP, WebP</li>
</ul>
<h3 id="response-—-200-ok" tabindex="-1"><a class="header-anchor" href="#response-—-200-ok"><span>Response — <code v-pre>200 OK</code></span></a></h3>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token property">"redactions"</span><span class="token operator">:</span> <span class="token punctuation">[</span></span>
<span class="line">    <span class="token punctuation">{</span></span>
<span class="line">      <span class="token property">"page"</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"x"</span><span class="token operator">:</span> <span class="token number">203.0</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"y"</span><span class="token operator">:</span> <span class="token number">438.0</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"width"</span><span class="token operator">:</span> <span class="token number">121.53</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"height"</span><span class="token operator">:</span> <span class="token number">16.0</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"area"</span><span class="token operator">:</span> <span class="token number">1944.48</span></span>
<span class="line">    <span class="token punctuation">}</span></span>
<span class="line">  <span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"spans"</span><span class="token operator">:</span> <span class="token punctuation">[</span></span>
<span class="line">    <span class="token punctuation">{</span></span>
<span class="line">      <span class="token property">"page"</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"text"</span><span class="token operator">:</span> <span class="token string">"Confidential"</span><span class="token punctuation">,</span></span>
<span class="line">      <span class="token property">"font"</span><span class="token operator">:</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token property">"size"</span><span class="token operator">:</span> <span class="token number">12.0</span><span class="token punctuation">,</span></span>
<span class="line">        <span class="token property">"flags"</span><span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">,</span></span>
<span class="line">        <span class="token property">"matched_font"</span><span class="token operator">:</span> <span class="token string">"TimesNewRomanPSMT"</span></span>
<span class="line">      <span class="token punctuation">}</span></span>
<span class="line">    <span class="token punctuation">}</span></span>
<span class="line">  <span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"pdf_fonts"</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token string">"TimesNewRomanPSMT"</span><span class="token punctuation">,</span> <span class="token string">"TimesNewRomanPS-BoldMT"</span><span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"suggested_scale"</span><span class="token operator">:</span> <span class="token number">133</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"suggested_size"</span><span class="token operator">:</span> <span class="token number">12.0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"suggested_font"</span><span class="token operator">:</span> <span class="token string">"times.ttf"</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"page_images"</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token string">"base64-encoded-PNG-string"</span><span class="token punctuation">,</span> <span class="token null keyword">null</span><span class="token punctuation">,</span> <span class="token string">"..."</span><span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"page_image_type"</span><span class="token operator">:</span> <span class="token string">"image/png"</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"page_width"</span><span class="token operator">:</span> <span class="token number">816</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"page_height"</span><span class="token operator">:</span> <span class="token number">1056</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"num_pages"</span><span class="token operator">:</span> <span class="token number">3</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table>
<thead>
<tr>
<th>Field</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>redactions</code></td>
<td>array</td>
<td>Detected redaction boxes sorted by page, then y, then x. Coordinates are in the embedded image's pixel space.</td>
</tr>
<tr>
<td><code v-pre>spans</code></td>
<td>array</td>
<td>Text spans with font metadata (PDF only, always <code v-pre>[]</code> for images)</td>
</tr>
<tr>
<td><code v-pre>pdf_fonts</code></td>
<td>array</td>
<td>Base-font names declared in the PDF, sorted by number of pages they appear on (most common first). <code v-pre>[]</code> for images.</td>
</tr>
<tr>
<td><code v-pre>suggested_scale</code></td>
<td>int</td>
<td>Recommended &quot;Scale %&quot; for the width calculator. <code v-pre>133</code> for standard 816 px / 612 pt letter pages. See <RouteLink to="/redaction-processing/scale-and-size-detection.html">Scale &amp; Size Detection</RouteLink>.</td>
</tr>
<tr>
<td><code v-pre>suggested_size</code></td>
<td>float</td>
<td>Dominant body-text font size in points, detected from text spans. <code v-pre>12.0</code> when unknown.</td>
</tr>
<tr>
<td><code v-pre>suggested_font</code></td>
<td>str | null</td>
<td><code v-pre>.ttf</code> filename of the dominant font (e.g. <code v-pre>&quot;times.ttf&quot;</code>). <code v-pre>null</code> if the font could not be matched to an available file.</td>
</tr>
<tr>
<td><code v-pre>page_images</code></td>
<td>array</td>
<td>Base64-encoded PNG for each page (one per page, <code v-pre>null</code> if no embedded image found on that page)</td>
</tr>
<tr>
<td><code v-pre>page_image_type</code></td>
<td>string</td>
<td>MIME type of the page images — always <code v-pre>&quot;image/png&quot;</code></td>
</tr>
<tr>
<td><code v-pre>page_width</code> / <code v-pre>page_height</code></td>
<td>int</td>
<td>Pixel dimensions of the page images (816 × 1056 for standard PDFs; actual image dimensions for raw image uploads)</td>
</tr>
<tr>
<td><code v-pre>num_pages</code></td>
<td>int</td>
<td>Total number of pages</td>
</tr>
</tbody>
</table>
<h3 id="errors" tabindex="-1"><a class="header-anchor" href="#errors"><span>Errors</span></a></h3>
<table>
<thead>
<tr>
<th>Status</th>
<th>Reason</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>400</code></td>
<td>No file uploaded or no file selected</td>
</tr>
<tr>
<td><code v-pre>500</code></td>
<td>Processing error (detail in response body)</td>
</tr>
</tbody>
</table>
<hr>
<h2 id="post-widths" tabindex="-1"><a class="header-anchor" href="#post-widths"><span><code v-pre>POST /widths</code></span></a></h2>
<p>Calculate pixel widths for a list of text strings using HarfBuzz text shaping.</p>
<h3 id="request-1" tabindex="-1"><a class="header-anchor" href="#request-1"><span>Request</span></a></h3>
<ul>
<li><strong>Content-Type:</strong> <code v-pre>application/json</code></li>
</ul>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token property">"strings"</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token string">"Jeffrey Epstein"</span><span class="token punctuation">,</span> <span class="token string">"Ghislaine Maxwell"</span><span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"font"</span><span class="token operator">:</span> <span class="token string">"times.ttf"</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"size"</span><span class="token operator">:</span> <span class="token number">12</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"scale"</span><span class="token operator">:</span> <span class="token number">133</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"kerning"</span><span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"ligatures"</span><span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"force_uppercase"</span><span class="token operator">:</span> <span class="token boolean">false</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table>
<thead>
<tr>
<th>Field</th>
<th>Type</th>
<th>Default</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>strings</code></td>
<td>array</td>
<td><code v-pre>[]</code></td>
<td>Text strings to measure</td>
</tr>
<tr>
<td><code v-pre>font</code></td>
<td>string</td>
<td><code v-pre>&quot;times.ttf&quot;</code></td>
<td>Font filename from <code v-pre>assets/fonts/</code></td>
</tr>
<tr>
<td><code v-pre>size</code></td>
<td>number</td>
<td><code v-pre>12</code></td>
<td>Font size in points</td>
</tr>
<tr>
<td><code v-pre>scale</code></td>
<td>number</td>
<td><code v-pre>135</code></td>
<td>Scale percentage (divided by 100 internally to get <code v-pre>scale_factor</code>)</td>
</tr>
<tr>
<td><code v-pre>kerning</code></td>
<td>bool</td>
<td><code v-pre>true</code></td>
<td>Enable OpenType <code v-pre>kern</code> feature</td>
</tr>
<tr>
<td><code v-pre>ligatures</code></td>
<td>bool</td>
<td><code v-pre>true</code></td>
<td>Enable <code v-pre>liga</code>/<code v-pre>clig</code> features</td>
</tr>
<tr>
<td><code v-pre>force_uppercase</code></td>
<td>bool</td>
<td><code v-pre>false</code></td>
<td>Measure uppercase version of each string</td>
</tr>
</tbody>
</table>
<p>The width formula applied by the backend is:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">pixel_width = (advance / upem) × size × (scale / 100)</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>With <code v-pre>scale = 133</code> and <code v-pre>size</code> set to the document's body-text size, this matches the pixel-space width of that text as it appears in the embedded page images.</p>
<h3 id="response-—-200-ok-1" tabindex="-1"><a class="header-anchor" href="#response-—-200-ok-1"><span>Response — <code v-pre>200 OK</code></span></a></h3>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token property">"results"</span><span class="token operator">:</span> <span class="token punctuation">[</span></span>
<span class="line">    <span class="token punctuation">{</span> <span class="token property">"text"</span><span class="token operator">:</span> <span class="token string">"Jeffrey Epstein"</span><span class="token punctuation">,</span> <span class="token property">"width"</span><span class="token operator">:</span> <span class="token number">89.472</span> <span class="token punctuation">}</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token punctuation">{</span> <span class="token property">"text"</span><span class="token operator">:</span> <span class="token string">"Ghislaine Maxwell"</span><span class="token punctuation">,</span> <span class="token property">"width"</span><span class="token operator">:</span> <span class="token number">107.136</span> <span class="token punctuation">}</span></span>
<span class="line">  <span class="token punctuation">]</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h2 id="get-fonts-list" tabindex="-1"><a class="header-anchor" href="#get-fonts-list"><span><code v-pre>GET /fonts-list</code></span></a></h2>
<p>Returns a JSON array of available <code v-pre>.ttf</code> font filenames from <code v-pre>assets/fonts/</code>.</p>
<h3 id="response-—-200-ok-2" tabindex="-1"><a class="header-anchor" href="#response-—-200-ok-2"><span>Response — <code v-pre>200 OK</code></span></a></h3>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">[</span><span class="token string">"times.ttf"</span><span class="token punctuation">,</span> <span class="token string">"arial.ttf"</span><span class="token punctuation">,</span> <span class="token string">"courier_new.ttf"</span><span class="token punctuation">,</span> <span class="token string">"calibri.ttf"</span><span class="token punctuation">]</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><hr>
<h2 id="post-webgl-masks" tabindex="-1"><a class="header-anchor" href="#post-webgl-masks"><span><code v-pre>POST /webgl/masks</code></span></a></h2>
<p>Asynchronously generates redaction masks for an entire document. This is separated from <code v-pre>/analyze-pdf</code> to improve response times for the main layout.</p>
<h3 id="request-2" tabindex="-1"><a class="header-anchor" href="#request-2"><span>Request</span></a></h3>
<ul>
<li><strong>Content-Type:</strong> <code v-pre>multipart/form-data</code></li>
<li><strong>Body:</strong> Form field <code v-pre>file</code> containing the same PDF previously sent to <code v-pre>/analyze-pdf</code>.</li>
</ul>
<h3 id="response-—-200-ok-3" tabindex="-1"><a class="header-anchor" href="#response-—-200-ok-3"><span>Response — <code v-pre>200 OK</code></span></a></h3>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token property">"mask_images"</span><span class="token operator">:</span> <span class="token punctuation">[</span></span>
<span class="line">    <span class="token string">"base64-encoded-PNG-mask-string"</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token null keyword">null</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token string">"base64-encoded-PNG-mask-string"</span></span>
<span class="line">  <span class="token punctuation">]</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><table>
<thead>
<tr>
<th>Field</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>mask_images</code></td>
<td>array</td>
<td>Array of base64-encoded grayscale PNG masks (one per page). <code v-pre>null</code> suggests no redactions on that page.</td>
</tr>
</tbody>
</table>
<hr>
<h2 id="get-webgl-masks-default-true" tabindex="-1"><a class="header-anchor" href="#get-webgl-masks-default-true"><span><code v-pre>GET /webgl/masks?default=true</code></span></a></h2>
<p>Utility endpoint to fetch masks for the bundled default demonstration PDF.</p>
<h3 id="response-—-200-ok-4" tabindex="-1"><a class="header-anchor" href="#response-—-200-ok-4"><span>Response — <code v-pre>200 OK</code></span></a></h3>
<p>Returns the same schema as <code v-pre>POST /webgl/masks</code>.</p>
</div></template>


