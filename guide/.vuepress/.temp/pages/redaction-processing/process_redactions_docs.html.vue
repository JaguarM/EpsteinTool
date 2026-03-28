<template><div><h1 id="processredactions-py" tabindex="-1"><a class="header-anchor" href="#processredactions-py"><span>ProcessRedactions.py</span></a></h1>
<p><a href="../../guesser_core/logic/ProcessRedactions.py">ProcessRedactions.py</a> is the main orchestrator for PDF and image analysis. It opens the uploaded file, extracts embedded page images, runs redaction box detection, refines box boundaries using surrounding text, and collects font metadata — returning the core structural data the frontend needs in a single JSON-serialisable dict.</p>
<hr>
<h2 id="functions" tabindex="-1"><a class="header-anchor" href="#functions"><span>Functions</span></a></h2>
<h3 id="process-pdf-pdf-bytes" tabindex="-1"><a class="header-anchor" href="#process-pdf-pdf-bytes"><span><code v-pre>process_pdf(pdf_bytes)</code></span></a></h3>
<p>The primary entry point for PDF files. Accepts raw bytes from the uploaded file and processes every page.</p>
<p><strong>Returns</strong> a dict with:</p>
<table>
<thead>
<tr>
<th>Key</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>redactions</code></td>
<td>list</td>
<td>Detected redaction boxes, sorted page → y → x</td>
</tr>
<tr>
<td><code v-pre>spans</code></td>
<td>list</td>
<td>Text spans extracted from the PDF text layer</td>
</tr>
<tr>
<td><code v-pre>pdf_fonts</code></td>
<td>list[str]</td>
<td>Base-font names declared in the PDF, sorted by page-frequency (most common first)</td>
</tr>
<tr>
<td><code v-pre>suggested_scale</code></td>
<td>int</td>
<td>Recommended &quot;Scale %&quot; for the width calculator (see <RouteLink to="/redaction-processing/scale-and-size-detection.html">Scale &amp; Size Detection</RouteLink>)</td>
</tr>
<tr>
<td><code v-pre>suggested_size</code></td>
<td>float</td>
<td>Detected dominant body-text size in points (see <RouteLink to="/redaction-processing/scale-and-size-detection.html">Scale &amp; Size Detection</RouteLink>)</td>
</tr>
<tr>
<td><code v-pre>page_images</code></td>
<td>list</td>
<td>Base64-encoded PNG string for each page (one per page, <code v-pre>null</code> if none found)</td>
</tr>
<tr>
<td><code v-pre>page_image_type</code></td>
<td>str</td>
<td>MIME type — always <code v-pre>&quot;image/png&quot;</code></td>
</tr>
<tr>
<td><code v-pre>page_width</code></td>
<td>int</td>
<td>Fixed pixel width — <code v-pre>816</code></td>
</tr>
<tr>
<td><code v-pre>page_height</code></td>
<td>int</td>
<td>Fixed pixel height — <code v-pre>1056</code></td>
</tr>
<tr>
<td><code v-pre>num_pages</code></td>
<td>int</td>
<td>Total number of pages in the document</td>
</tr>
</tbody>
</table>
<p><strong>Redaction object shape:</strong></p>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token property">"page"</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"x"</span><span class="token operator">:</span> <span class="token number">203.0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"y"</span><span class="token operator">:</span> <span class="token number">438.0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"width"</span><span class="token operator">:</span> <span class="token number">121.53</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"height"</span><span class="token operator">:</span> <span class="token number">16.0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"area"</span><span class="token operator">:</span> <span class="token number">1944.48</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Coordinates are in the pixel space of the embedded 816 × 1056 px page image.</p>
<p><strong>Span object shape:</strong></p>
<div class="language-json line-numbers-mode" data-highlighter="prismjs" data-ext="json"><pre v-pre><code class="language-json"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token property">"page"</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"text"</span><span class="token operator">:</span> <span class="token string">"Confidential"</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token property">"font"</span><span class="token operator">:</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token property">"size"</span><span class="token operator">:</span> <span class="token number">12.0</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token property">"flags"</span><span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token property">"matched_font"</span><span class="token operator">:</span> <span class="token string">"TimesNewRomanPSMT"</span></span>
<span class="line">  <span class="token punctuation">}</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h3 id="process-image-image-bytes-mime-type" tabindex="-1"><a class="header-anchor" href="#process-image-image-bytes-mime-type"><span><code v-pre>process_image(image_bytes, mime_type)</code></span></a></h3>
<p>Handles raw image uploads (PNG, JPEG, TIFF, …). Runs the same box detection pipeline but skips text-span extraction and font detection.</p>
<p>Returns the same structure as <code v-pre>process_pdf()</code> with:</p>
<ul>
<li><code v-pre>spans</code> always <code v-pre>[]</code></li>
<li><code v-pre>suggested_scale</code> always <code v-pre>178</code> (fallback; no page geometry is available)</li>
<li><code v-pre>page_width</code> / <code v-pre>page_height</code> reflect the actual uploaded image dimensions</li>
</ul>
<hr>
<hr>
<h2 id="processing-pipeline-pdf-path" tabindex="-1"><a class="header-anchor" href="#processing-pipeline-pdf-path"><span>Processing Pipeline (PDF path)</span></a></h2>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">pdf_bytes</span>
<span class="line">  │</span>
<span class="line">  ▼</span>
<span class="line">fitz.open()  ──► per-page loop</span>
<span class="line">                  │</span>
<span class="line">                  ├─ page.get_fonts()         → pdf_font_pages (declared font registry)</span>
<span class="line">                  │</span>
<span class="line">                  ├─ page.get_text("dict")    → text_spans (size, flags, font name)</span>
<span class="line">                  │</span>
<span class="line">                  └─ doc.get_page_images()    → per image on the page</span>
<span class="line">                        │</span>
<span class="line">                        ├─ doc.extract_image()               → raw PNG/TIFF bytes</span>
<span class="line">                        ├─ find_redaction_boxes_in_image()   → pixel-space boxes</span>
<span class="line">                        ├─ page.get_image_rects()            → placement rect in PDF pts</span>
<span class="line">                        │     └─ captures page_scale_ratio = img_px / page_pts</span>
<span class="line">                        └─ estimate_widths_for_boxes()       → refined x1/x2 from text context</span>
<span class="line">                              └─ 25% tolerance gate: keep refined only if |Δw| ≤ 25% of original</span>
<span class="line"></span>
<span class="line">  ▼</span>
<span class="line">Post-loop calculations</span>
<span class="line">  ├─ suggested_scale  = round(100 × page_scale_ratio)   [133 for standard 816 px / 612 pt pages]</span>
<span class="line">  └─ suggested_size   = mode of body-text span sizes, rounded to 0.5 pt</span>
<span class="line">                        (spans ≥ 20 chars preferred; falls back to all spans)</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h2 id="coordinate-system" tabindex="-1"><a class="header-anchor" href="#coordinate-system"><span>Coordinate System</span></a></h2>
<p>All redaction coordinates are in the <strong>embedded image's pixel space</strong> (typically 816 × 1056 px). This matches what the frontend renders, so overlay divs can be positioned directly using these values.</p>
<p>PDF text spans from <code v-pre>page.get_text(&quot;dict&quot;)</code> are in <strong>PDF points</strong> (72 dpi). The conversion factor <code v-pre>page_scale_ratio</code> (captured during image processing) bridges the two spaces:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">image_pixels = pdf_points × page_scale_ratio</span>
<span class="line">             = pdf_points × (816 / 612)          ← standard letter pages</span>
<span class="line">             = pdf_points × 1.3333</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This same ratio is what <code v-pre>suggested_scale / 100</code> represents — see <RouteLink to="/redaction-processing/scale-and-size-detection.html">Scale &amp; Size Detection</RouteLink> for the derivation.</p>
<hr>
<h2 id="edge-refinement-25-tolerance" tabindex="-1"><a class="header-anchor" href="#edge-refinement-25-tolerance"><span>Edge Refinement (25% Tolerance)</span></a></h2>
<p><code v-pre>estimate_widths_for_boxes()</code> (from <code v-pre>SurroundingWordWidth.py</code>) examines surrounding text spans to infer where a redaction likely starts and ends. <code v-pre>ProcessRedactions.py</code> accepts the refined coordinates only when the new width is within ±25% of the raw <code v-pre>BoxDetector</code> measurement:</p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line">diff_pct <span class="token operator">=</span> <span class="token builtin">abs</span><span class="token punctuation">(</span>new_w <span class="token operator">-</span> bw<span class="token punctuation">)</span> <span class="token operator">/</span> bw</span>
<span class="line"><span class="token keyword">if</span> diff_pct <span class="token operator">&lt;=</span> <span class="token number">0.25</span><span class="token punctuation">:</span></span>
<span class="line">    use refined coordinates</span>
<span class="line"><span class="token keyword">else</span><span class="token punctuation">:</span></span>
<span class="line">    keep BoxDetector coordinates</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h2 id="dependencies" tabindex="-1"><a class="header-anchor" href="#dependencies"><span>Dependencies</span></a></h2>
<table>
<thead>
<tr>
<th>Module</th>
<th>Used for</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>BoxDetector.find_redaction_boxes_in_image()</code></td>
<td>Raw black-box detection in pixel space</td>
</tr>
<tr>
<td><code v-pre>SurroundingWordWidth.estimate_widths_for_boxes()</code></td>
<td>Context-aware x1/x2 refinement</td>
</tr>
<tr>
<td><code v-pre>fitz</code> (PyMuPDF)</td>
<td>PDF parsing, text span extraction, image extraction</td>
</tr>
<tr>
<td><code v-pre>collections.Counter</code></td>
<td>Mode calculation for <code v-pre>suggested_size</code></td>
</tr>
</tbody>
</table>
</div></template>


