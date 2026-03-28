<template><div><h1 id="redaction-processing-—-backend-logic" tabindex="-1"><a class="header-anchor" href="#redaction-processing-—-backend-logic"><span>Redaction Processing — Backend Logic</span></a></h1>
<p>This folder documents the core logic modules distributed across the <strong>guesser_core</strong>, <strong>webgl_mask</strong>, and <strong>text_tool</strong> Django apps.</p>
<h2 id="module-pipeline" tabindex="-1"><a class="header-anchor" href="#module-pipeline"><span>Module Pipeline</span></a></h2>
<div class="language-mermaid line-numbers-mode" data-highlighter="prismjs" data-ext="mermaid"><pre v-pre><code class="language-mermaid"><span class="line"><span class="token keyword">flowchart</span> TD</span>
<span class="line">    <span class="token keyword">subgraph</span> guesser_core</span>
<span class="line">        PR<span class="token text string">["ProcessRedactions"]</span></span>
<span class="line">        BD<span class="token text string">["BoxDetector"]</span></span>
<span class="line">        SW<span class="token text string">["SurroundingWordWidth"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line">    </span>
<span class="line">    <span class="token keyword">subgraph</span> webgl_mask</span>
<span class="line">        AV<span class="token text string">["artifact_visualizer"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line">    </span>
<span class="line">    <span class="token keyword">subgraph</span> text_tool</span>
<span class="line">        WC<span class="token text string">["width_calculator"]</span></span>
<span class="line">        EF<span class="token text string">["extract_fonts"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    PDF<span class="token text string">["PDF Bytes"]</span> <span class="token arrow operator">--></span> PR</span>
<span class="line">    PR <span class="token arrow operator">--></span> BD</span>
<span class="line">    PR <span class="token arrow operator">--></span> SW</span>
<span class="line">    </span>
<span class="line">    PDF <span class="token arrow operator">--></span> AV</span>
<span class="line">    AV <span class="token arrow operator">-.-></span><span class="token label property">|"depends on core logic"|</span> BD</span>
<span class="line">    </span>
<span class="line">    EF <span class="token arrow operator">-.-</span> PR</span>
<span class="line">    </span>
<span class="line">    <span class="token keyword">style</span> PR <span class="token style"><span class="token property">fill</span><span class="token operator">:</span>#2d333b<span class="token punctuation">,</span><span class="token property">stroke</span><span class="token operator">:</span>#81c995</span></span>
<span class="line">    <span class="token keyword">style</span> BD <span class="token style"><span class="token property">fill</span><span class="token operator">:</span>#2d333b<span class="token punctuation">,</span><span class="token property">stroke</span><span class="token operator">:</span>#8ab4f8</span></span>
<span class="line">    <span class="token keyword">style</span> SW <span class="token style"><span class="token property">fill</span><span class="token operator">:</span>#2d333b<span class="token punctuation">,</span><span class="token property">stroke</span><span class="token operator">:</span>#f28b82</span></span>
<span class="line">    <span class="token keyword">style</span> AV <span class="token style"><span class="token property">fill</span><span class="token operator">:</span>#2d333b<span class="token punctuation">,</span><span class="token property">stroke</span><span class="token operator">:</span>#fdd663</span></span>
<span class="line">    <span class="token keyword">style</span> WC <span class="token style"><span class="token property">fill</span><span class="token operator">:</span>#2d333b<span class="token punctuation">,</span><span class="token property">stroke</span><span class="token operator">:</span>#c58af9</span></span>
<span class="line">    <span class="token keyword">style</span> EF <span class="token style"><span class="token property">fill</span><span class="token operator">:</span>#2d333b<span class="token punctuation">,</span><span class="token property">stroke</span><span class="token operator">:</span>#c58af9</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="module-reference" tabindex="-1"><a class="header-anchor" href="#module-reference"><span>Module Reference</span></a></h2>
<table>
<thead>
<tr>
<th>App</th>
<th>Module</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>guesser_core</strong></td>
<td><RouteLink to="/redaction-processing/boxdetector.html">BoxDetector</RouteLink></td>
<td>Row-scan detection of black rectangular boxes</td>
</tr>
<tr>
<td><strong>guesser_core</strong></td>
<td><RouteLink to="/redaction-processing/surrounding-word-width.html">SurroundingWordWidth</RouteLink></td>
<td>Refine box edges using positions of nearby words</td>
</tr>
<tr>
<td><strong>guesser_core</strong></td>
<td><RouteLink to="/redaction-processing/process_redactions_docs.html">ProcessRedactions</RouteLink></td>
<td>Orchestrator: coordinates detection + refinement</td>
</tr>
<tr>
<td><strong>webgl_mask</strong></td>
<td><RouteLink to="/redaction-processing/artifact_visualizer_documentation.html">artifact_visualizer</RouteLink></td>
<td>Async generation of grayscale mask PNGs</td>
</tr>
<tr>
<td><strong>text_tool</strong></td>
<td><RouteLink to="/redaction-processing/width_calculator_documentation.html">width_calculator</RouteLink></td>
<td>HarfBuzz text shaping for width measurement</td>
</tr>
<tr>
<td><strong>text_tool</strong></td>
<td><RouteLink to="/redaction-processing/extract_fonts.html">extract_fonts</RouteLink></td>
<td>Dominant font detection and mapping</td>
</tr>
</tbody>
</table>
<h2 id="processing-order" tabindex="-1"><a class="header-anchor" href="#processing-order"><span>Processing Order</span></a></h2>
<ol>
<li><strong>Receive</strong> PDF or image bytes from the Django view</li>
<li><strong>Extract</strong> embedded page images from PDF using PyMuPDF (<code v-pre>extract_page_image_bytes</code>)</li>
<li><strong>Detect</strong> black rectangular boxes in each image (<code v-pre>BoxDetector</code>)</li>
<li><strong>Refine</strong> box edges by measuring gaps to surrounding text words (<code v-pre>SurroundingWordWidth</code>)</li>
<li><strong>Return</strong> structured JSON with redaction coordinates, text spans, and base64 page images</li>
<li><strong>On demand:</strong> Generate grayscale mask PNGs for individual pages (<code v-pre>artifact_visualizer</code>)</li>
<li><strong>On demand:</strong> Measure pixel widths of candidate names using HarfBuzz (<code v-pre>width_calculator</code>)</li>
</ol>
</div></template>


