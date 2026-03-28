<template><div><h1 id="pdf-viewer-—-pdf-viewer-js" tabindex="-1"><a class="header-anchor" href="#pdf-viewer-—-pdf-viewer-js"><span>PDF Viewer — <code v-pre>pdf-viewer.js</code></span></a></h1>
<p>[pdf-viewer.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/pdf-viewer.js) handles file uploads, page rendering, and redaction overlay injection. It does <strong>not</strong> use PDF.js — pages are rendered from server-extracted base64 PNG images.</p>
<h2 id="functions" tabindex="-1"><a class="header-anchor" href="#functions"><span>Functions</span></a></h2>
<h3 id="handlefileupload" tabindex="-1"><a class="header-anchor" href="#handlefileupload"><span><code v-pre>handleFileUpload()</code></span></a></h3>
<p>Triggered when a file is selected or dropped. Sends the file to <code v-pre>POST /analyze-pdf</code>, then:</p>
<ol>
<li>Parses the response into <code v-pre>state.pageImages</code>, <code v-pre>state.numPages</code>, <code v-pre>state.pageWidth</code>, <code v-pre>state.pageHeight</code></li>
<li>Navigates to page 1</li>
<li>Renders thumbnails</li>
<li>Auto-detects font size and sets <code v-pre>suggested_scale</code></li>
<li>Initializes each redaction with per-redaction <code v-pre>settings</code> from the DOM controls</li>
<li>Calculates widths for all candidates via <code v-pre>calculateAllWidths()</code></li>
<li>Injects redaction overlays and selects the first one</li>
</ol>
<h3 id="gotopage-pagenum" tabindex="-1"><a class="header-anchor" href="#gotopage-pagenum"><span><code v-pre>goToPage(pageNum)</code></span></a></h3>
<p>Switches the viewer to display a specific page:</p>
<ol>
<li>Disposes the Fabric.js canvas for the previous page</li>
<li>Clears existing WebGL contexts</li>
<li>Creates a new <code v-pre>page-container</code> div with CSS custom properties for dimensions</li>
<li>Inserts an <code v-pre>&lt;img&gt;</code> element with the base64 page image</li>
<li>Creates a WebGL overlay <code v-pre>&lt;canvas&gt;</code> (visible only if WebGL toggle is active)</li>
<li>Calls <code v-pre>setupWebGLOverlay()</code> and <code v-pre>createPageOverlay()</code> for the new page</li>
<li>Re-injects redaction overlays</li>
</ol>
<h3 id="injectredactionoverlays" tabindex="-1"><a class="header-anchor" href="#injectredactionoverlays"><span><code v-pre>injectRedactionOverlays()</code></span></a></h3>
<p>Creates interactive overlay divs positioned over each redaction box on the currently visible page:</p>
<p><strong>Overlay structure:</strong></p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">div.redaction-overlay (id="redaction-idx-{idx}")</span>
<span class="line">  ├── div.resizer.resizer-l     (left edge drag handle)</span>
<span class="line">  ├── div.resizer.resizer-r     (right edge drag handle)</span>
<span class="line">  ├── div.resizer.resizer-t     (top edge drag handle)</span>
<span class="line">  ├── div.resizer.resizer-b     (bottom edge drag handle)</span>
<span class="line">  └── div.redaction-label       (editable text label)</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>Positioning:</strong> Uses CSS custom properties (<code v-pre>--px-x</code>, <code v-pre>--px-y</code>, <code v-pre>--px-width</code>, <code v-pre>--px-height</code>) multiplied by <code v-pre>--scale-factor</code> for zoom-independent positioning.</p>
<p><strong>Interactions:</strong></p>
<ul>
<li><strong>Click</strong> → select redaction (<code v-pre>selectRedaction(idx)</code>)</li>
<li><strong>Drag</strong> → move redaction (<code v-pre>initDragRedaction</code>)</li>
<li><strong>Edge drag</strong> → resize redaction (<code v-pre>initResize</code>)</li>
<li><strong>Double-click label</strong> → make label editable (<code v-pre>contentEditable</code>)</li>
<li><strong>Label edit</strong> → sets <code v-pre>manualLabel: true</code> to prevent auto-override</li>
</ul>
</div></template>


