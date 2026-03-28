<template><div><h1 id="artifact-visualizer-—-documentation" tabindex="-1"><a class="header-anchor" href="#artifact-visualizer-—-documentation"><span>Artifact Visualizer — Documentation</span></a></h1>
<p><code v-pre>webgl_mask/logic/artifact_visualizer.py</code></p>
<hr>
<h2 id="overview" tabindex="-1"><a class="header-anchor" href="#overview"><span>Overview</span></a></h2>
<p>The artifact visualizer detects black redaction boxes embedded in PDF pages and generates grayscale mask PNGs that the WebGL overlay layer uses to highlight or subtract those regions in the browser.</p>
<p><strong>Pipeline summary:</strong></p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">PDF bytes</span>
<span class="line">  └─ generate_all_masks()           ← webgl_mask views.py</span>
<span class="line">       └─ find_redaction_boxes_in_image()   ← detect pure-black rectangles</span>
<span class="line">            └─ build mask array + edge borders</span>
<span class="line">                 └─ returned as bytes (web) or saved to disk (CLI)</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h2 id="constants" tabindex="-1"><a class="header-anchor" href="#constants"><span>Constants</span></a></h2>
<table>
<thead>
<tr>
<th>Name</th>
<th>Value</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>SOURCE_PDF</code></td>
<td><code v-pre>&quot;efta00018586.pdf&quot;</code></td>
<td>Default input path for CLI mode</td>
</tr>
<tr>
<td><code v-pre>PAGE_W</code></td>
<td><code v-pre>816</code></td>
<td>Reference page width in pixels</td>
</tr>
<tr>
<td><code v-pre>PAGE_H</code></td>
<td><code v-pre>1056</code></td>
<td>Reference page height in pixels</td>
</tr>
</tbody>
</table>
<p>The mask is generated at the source image's native resolution.</p>
<hr>
<h2 id="find-redaction-boxes-in-image-image-bytes" tabindex="-1"><a class="header-anchor" href="#find-redaction-boxes-in-image-image-bytes"><span><code v-pre>find_redaction_boxes_in_image(image_bytes)</code></span></a></h2>
<p><strong>Input:</strong> raw image bytes (any PIL-readable format)
<strong>Output:</strong> <code v-pre>(boxes, img_w, img_h)</code></p>
<ul>
<li><code v-pre>boxes</code> — list of <code v-pre>(x1, y1, x2, y2)</code> tuples in source-image pixel space</li>
<li><code v-pre>img_w</code>, <code v-pre>img_h</code> — dimensions of the source image</li>
</ul>
<h3 id="what-counts-as-a-redaction-box" tabindex="-1"><a class="header-anchor" href="#what-counts-as-a-redaction-box"><span>What counts as a redaction box</span></a></h3>
<p>A pixel must be <strong>exactly</strong> <code v-pre>R=0, G=0, B=0</code> (pure black). No tolerance. The detected rectangle must be at least <strong>17 px wide</strong> and <strong>10 px tall</strong>.</p>
<h3 id="detection-algorithm-—-row-by-row-run-tracking" tabindex="-1"><a class="header-anchor" href="#detection-algorithm-—-row-by-row-run-tracking"><span>Detection algorithm — row-by-row run tracking</span></a></h3>
<p>The algorithm scans the image one row at a time. It never converts to grayscale; it works directly on the RGB array.</p>
<p><strong>Step 1 — Black pixel mask</strong></p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line">mask <span class="token operator">=</span> <span class="token punctuation">(</span>r <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token operator">&amp;</span> <span class="token punctuation">(</span>g <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span> <span class="token operator">&amp;</span> <span class="token punctuation">(</span>b <span class="token operator">==</span> <span class="token number">0</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>This produces a 2D boolean array the same size as the image.</p>
<p><strong>Step 2 — Run detection per row</strong></p>
<p>For each row, contiguous runs of <code v-pre>True</code> pixels are found using <code v-pre>np.diff</code> on a padded version of the row. Only runs ≥ 17 px wide are kept as <code v-pre>current_segments</code>.</p>
<p><strong>Step 3 — Active run tracking across rows</strong></p>
<p><code v-pre>active_runs</code> is a dict keyed by <code v-pre>(sx, ex)</code> — the x-span of a run when it first started. Each entry stores:</p>
<ul>
<li><code v-pre>start_y</code> — the row where this run began</li>
<li><code v-pre>history</code> — list of <code v-pre>(csx, cex)</code> x-spans observed on each subsequent row</li>
</ul>
<p>A run <strong>survives</strong> into the next row if a current segment mostly contains it (±2 px tolerance on each side). The history records the actual x-span each row so that tapered shapes can be measured.</p>
<p>A run <strong>dies</strong> (becomes a candidate box) when no current segment contains it. At that point:</p>
<ul>
<li>Height <code v-pre>h = current_row - start_y</code> must be ≥ 10</li>
<li>The <strong>core span</strong> is computed: <code v-pre>core_x = max of all left edges</code>, <code v-pre>core_ex = min of all right edges</code> — this is the narrowest consistent width across the entire run, filtering out one-row wider sections</li>
<li>Core width must still be ≥ 17 px</li>
</ul>
<p><strong>Step 4 — Taper filter (circle/hole-punch rejection)</strong></p>
<p>Circular hole-punches in paper taper on both top and bottom. The filter checks the row just above the start and just below the end:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">missing_top  = width - count_of_black_pixels_on_top_edge_row</span>
<span class="line">missing_bottom = width - count_of_black_pixels_on_bottom_edge_row</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><p>If <strong>both</strong> <code v-pre>missing_top ≤ 30%</code> and <code v-pre>missing_bottom ≤ 30%</code>, the shape is rejected. A true rectangle has full-width top and bottom edges (missing ≈ 0%), while a circle is narrow at both ends.</p>
<p><strong>Step 5 — Flush remaining active runs at end of image</strong></p>
<p>Any run still active after the last row is flushed with <code v-pre>missing_bottom = width</code> (forced full missing, so only tapered-top shapes with a flat bottom get rejected).</p>
<p><strong>Step 6 — <code v-pre>clean_overlapping_boxes</code></strong></p>
<p>Handles T-shaped intersections (e.g., a vertical bar meeting a horizontal bar). If box B:</p>
<ul>
<li>starts during box A's vertical extent</li>
<li>horizontally contains A (±2 px)</li>
<li>is significantly wider than A (≥ 10 px wider)</li>
<li>ends at roughly the same y as A (±5 px)</li>
</ul>
<p>...then A's bottom is trimmed to where B starts. This separates the vertical stem from the horizontal bar of a T.</p>
<p>After cleaning, boxes are deduplicated and sorted by <code v-pre>(y, x)</code>.</p>
<hr>
<h2 id="create-redaction-masks-pdf-path" tabindex="-1"><a class="header-anchor" href="#create-redaction-masks-pdf-path"><span><code v-pre>create_redaction_masks(pdf_path)</code></span></a></h2>
<p>CLI entry point. Processes every page of a PDF file and saves mask PNGs to disk.</p>
<p><strong>Output filenames:</strong> <code v-pre>{pdf_basename}_mask_p{page_num}.png</code></p>
<h3 id="per-page-process" tabindex="-1"><a class="header-anchor" href="#per-page-process"><span>Per-page process</span></a></h3>
<ol>
<li>
<p><strong>Extract image</strong> — calls <code v-pre>extract_page_image_bytes(doc, page_index)</code> which pulls an embedded raster image from the PDF page (does not re-render the PDF via fitz).</p>
</li>
<li>
<p><strong>Detect boxes</strong> — calls <code v-pre>find_redaction_boxes_in_image()</code>.</p>
</li>
<li>
<p><strong>Build grayscale rendered array</strong> — opens the same image bytes and converts to <code v-pre>&quot;L&quot;</code> (8-bit grayscale). This is used only for the edge border calculation.</p>
</li>
<li>
<p><strong>Build mask array</strong> — <code v-pre>np.zeros((img_h, img_w), dtype=np.uint8)</code>. Convention:</p>
<ul>
<li><code v-pre>0</code> = unredacted (black in PNG)</li>
<li><code v-pre>255</code> = fully redacted (white in PNG)</li>
</ul>
</li>
<li>
<p><strong>Fill boxes + borders</strong> — see <a href="#mask-construction">Mask Construction</a> below.</p>
</li>
<li>
<p><strong>Save</strong> — save as PNG at native resolution.</p>
</li>
</ol>
<hr>
<p>The mask construction logic is identical to <code v-pre>generate_mask_from_image</code>.</p>
<hr>
<h2 id="generate-all-masks-pdf-bytes" tabindex="-1"><a class="header-anchor" href="#generate-all-masks-pdf-bytes"><span><code v-pre>generate_all_masks(pdf_bytes)</code></span></a></h2>
<p>Batch processes an entire PDF and returns an array of base64-encoded mask strings (or <code v-pre>null</code> for pages without redactions). Used by the <code v-pre>/webgl/masks</code> endpoint for async frontend loading.</p>
<hr>
<h2 id="mask-construction" tabindex="-1"><a class="header-anchor" href="#mask-construction"><span>Mask Construction</span></a></h2>
<h3 id="interior-fill" tabindex="-1"><a class="header-anchor" href="#interior-fill"><span>Interior fill</span></a></h3>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line">mask<span class="token punctuation">[</span>y1<span class="token punctuation">:</span>y2<span class="token punctuation">,</span> x1<span class="token punctuation">:</span>x2<span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token number">255</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>Every pixel inside the detected bounding box is set to 255 (fully redacted).</p>
<h3 id="_1-pixel-border-—-uniform-edge-shading" tabindex="-1"><a class="header-anchor" href="#_1-pixel-border-—-uniform-edge-shading"><span>1-pixel border — uniform edge shading</span></a></h3>
<p>For each of the four edges of each box, a 1-pixel strip <strong>outside</strong> the box is filled with a single uniform gray value:</p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line">shade <span class="token operator">=</span> <span class="token builtin">int</span><span class="token punctuation">(</span>np<span class="token punctuation">.</span><span class="token builtin">max</span><span class="token punctuation">(</span>rendered<span class="token punctuation">[</span>y1 <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">,</span> x1<span class="token punctuation">:</span>x2<span class="token punctuation">]</span><span class="token punctuation">)</span><span class="token punctuation">)</span>   <span class="token comment"># top edge</span></span>
<span class="line">mask<span class="token punctuation">[</span>y1 <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">,</span> x1<span class="token punctuation">:</span>x2<span class="token punctuation">]</span> <span class="token operator">=</span> np<span class="token punctuation">.</span>maximum<span class="token punctuation">(</span>mask<span class="token punctuation">[</span>y1 <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">,</span> x1<span class="token punctuation">:</span>x2<span class="token punctuation">]</span><span class="token punctuation">,</span> shade<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><p><code v-pre>shade</code> is the <strong>lightest pixel</strong> (maximum luminance) found anywhere along that edge in the source image. The entire 1 px strip gets that single value.</p>
<p><strong>Why the lightest pixel?</strong>
The strip outside a redaction box can contain a mix of paper (light) and letter strokes (dark). Using the maximum ensures that paper-adjacent edges get a high shade value (≈ 255, near-white) while edges that are surrounded entirely by dark content get a lower shade. <code v-pre>np.maximum</code> prevents overwriting a higher value already written by an adjacent overlapping box.</p>
<p>Bounds are checked before each edge write (<code v-pre>y1 &gt; 0</code>, <code v-pre>y2 &lt; img_h</code>, <code v-pre>x1 &gt; 0</code>, <code v-pre>x2 &lt; img_w</code>) to avoid out-of-bounds writes.</p>
<h3 id="mask-value-semantics" tabindex="-1"><a class="header-anchor" href="#mask-value-semantics"><span>Mask value semantics</span></a></h3>
<table>
<thead>
<tr>
<th>Value</th>
<th>Meaning</th>
<th>WebGL alpha (via <code v-pre>maskVal * uOpacity</code>)</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>0</code></td>
<td>Unredacted / outside box</td>
<td>0 — fully transparent</td>
</tr>
<tr>
<td><code v-pre>1–254</code></td>
<td>Edge border (uniform per edge)</td>
<td>Proportional — light brightening</td>
</tr>
<tr>
<td><code v-pre>255</code></td>
<td>Redacted interior</td>
<td><code v-pre>uOpacity</code> — full effect</td>
</tr>
</tbody>
</table>
<p>The WebGL fragment shader reads <code v-pre>maskVal</code> (0.0–1.0) directly as the alpha factor, so lighter edge shades produce proportionally stronger screen-blend brightening.</p>
<hr>
<h2 id="webgl-integration" tabindex="-1"><a class="header-anchor" href="#webgl-integration"><span>WebGL Integration</span></a></h2>
<p>The mask PNG is served by the Django backend at <code v-pre>/webgl/masks</code> and loaded as a <code v-pre>LUMINANCE</code> texture in [webgl-mask.js](file:///c:/Users/yanni/Desktop/EpsteinTool/webgl_mask/static/webgl_mask/webgl-mask.js).</p>
<p>Fragment shader reads:</p>
<div class="language-glsl line-numbers-mode" data-highlighter="prismjs" data-ext="glsl"><pre v-pre><code class="language-glsl"><span class="line"><span class="token keyword">float</span> alpha <span class="token operator">=</span> maskVal <span class="token operator">*</span> uOpacity<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">vec3</span> invColor <span class="token operator">=</span> <span class="token number">1.0</span> <span class="token operator">-</span> uColor<span class="token punctuation">;</span></span>
<span class="line">gl_FragColor <span class="token operator">=</span> <span class="token keyword">vec4</span><span class="token punctuation">(</span>invColor <span class="token operator">*</span> alpha<span class="token punctuation">,</span> alpha<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Combined with <code v-pre>mix-blend-mode: screen</code> on the canvas element, this makes:</p>
<ul>
<li><strong>White mask color</strong> → inverted to black → screen with black = no change</li>
<li><strong>Black mask color</strong> → inverted to white → screen brightens the PDF</li>
</ul>
<p>The <code v-pre>uOpacity</code> uniform is driven by the &quot;Mask Opacity&quot; slider (0–255 → 0.0–1.0).</p>
<hr>
<h2 id="cli-usage" tabindex="-1"><a class="header-anchor" href="#cli-usage"><span>CLI Usage</span></a></h2>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line">python webgl_mask/logic/artifact_visualizer.py</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>Reads <code v-pre>PDF.pdf</code> from the working directory and writes one PNG per page that contains redactions.</p>
<hr>
<h2 id="known-constraints" tabindex="-1"><a class="header-anchor" href="#known-constraints"><span>Known Constraints</span></a></h2>
<ul>
<li><strong>Pure black only</strong> — pixels with RGB <code v-pre>(1,1,1)</code> or any near-black value are not detected. This is intentional to avoid false positives from dark text.</li>
<li><strong>Minimum size</strong> — boxes smaller than 17×10 px are ignored.</li>
<li><strong>Single-image pages</strong> — <code v-pre>extract_page_image_bytes</code> extracts the first embedded raster image from each page. Pages with no embedded image or only vector content produce no mask.</li>
</ul>
</div></template>


