<template><div><h1 id="frontend-—-javascript-module-reference" tabindex="-1"><a class="header-anchor" href="#frontend-—-javascript-module-reference"><span>Frontend — JavaScript Module Reference</span></a></h1>
<p>The frontend is a single-page application built with vanilla JavaScript (no build step). Scripts are loaded in order via <code v-pre>&lt;script&gt;</code> tags in <code v-pre>index.html</code>.</p>
<h2 id="loading-order" tabindex="-1"><a class="header-anchor" href="#loading-order"><span>Loading Order</span></a></h2>
<p>The scripts must load in this exact order because later modules depend on globals defined by earlier ones:</p>
<table>
<thead>
<tr>
<th>Order</th>
<th>File</th>
<th>Defines</th>
<th>Depends On</th>
</tr>
</thead>
<tbody>
<tr>
<td>1</td>
<td>[state.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/state.js)</td>
<td><code v-pre>state</code>, <code v-pre>els</code></td>
<td>DOM elements</td>
</tr>
<tr>
<td>2</td>
<td>[api.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/api.js)</td>
<td><code v-pre>addName</code>, <code v-pre>calculateAllWidths</code>, <code v-pre>renderCandidates</code>, <code v-pre>selectRedaction</code>, <code v-pre>updateAllMatchesView</code></td>
<td><code v-pre>state</code>, <code v-pre>els</code></td>
</tr>
<tr>
<td>3</td>
<td>[webgl-mask.js](file:///c:/Users/yanni/Desktop/EpsteinTool/webgl_mask/static/webgl_mask/webgl-mask.js)</td>
<td><code v-pre>setupWebGLOverlay</code>, <code v-pre>clearWebGLContexts</code>, <code v-pre>updateWebGLUniforms</code>, <code v-pre>fetchMasksAsync</code></td>
<td><code v-pre>state</code>, <code v-pre>els</code></td>
</tr>
<tr>
<td>4</td>
<td>[pdf-viewer.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/pdf-viewer.js)</td>
<td><code v-pre>handleFileUpload</code>, <code v-pre>goToPage</code>, <code v-pre>injectRedactionOverlays</code></td>
<td><code v-pre>state</code>, <code v-pre>els</code>, api.js, webgl-mask.js</td>
</tr>
<tr>
<td>5</td>
<td>[ui-events.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/ui-events.js)</td>
<td><code v-pre>updateCSSZoom</code>, <code v-pre>processZoomFromText</code>, <code v-pre>initResize</code>, <code v-pre>initDragRedaction</code>, <code v-pre>renderThumbnails</code></td>
<td><code v-pre>state</code>, <code v-pre>els</code></td>
</tr>
<tr>
<td>6</td>
<td>[app.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser_core/static/guesser_core/app.js)</td>
<td>IIFE — wires all event listeners</td>
<td>All above</td>
</tr>
<tr>
<td>7</td>
<td>[text-tool.js](file:///c:/Users/yanni/Desktop/EpsteinTool/text_tool/static/text_tool/text-tool.js)</td>
<td><code v-pre>createPageOverlay</code>, <code v-pre>resetFabricCanvases</code>, <code v-pre>onZoomChange</code></td>
<td><code v-pre>state</code>, <code v-pre>els</code>, Fabric.js</td>
</tr>
</tbody>
</table>
<h2 id="external-libraries" tabindex="-1"><a class="header-anchor" href="#external-libraries"><span>External Libraries</span></a></h2>
<table>
<thead>
<tr>
<th>Library</th>
<th>CDN</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td>Fabric.js 5.3.1</td>
<td>cloudflare</td>
<td>Canvas-based text overlays with drag/resize</td>
</tr>
<tr>
<td>Material Symbols</td>
<td>Google Fonts</td>
<td>Toolbar icons</td>
</tr>
<tr>
<td>Inter font</td>
<td>Google Fonts</td>
<td>UI typography</td>
</tr>
</tbody>
</table>
<h2 id="module-documentation" tabindex="-1"><a class="header-anchor" href="#module-documentation"><span>Module Documentation</span></a></h2>
<ul>
<li><RouteLink to="/frontend/state-management.html">State Management</RouteLink> — <code v-pre>state</code> object schema and <code v-pre>els</code> DOM cache</li>
<li><RouteLink to="/frontend/pdf-viewer.html">PDF Viewer</RouteLink> — File upload, page navigation, redaction overlay rendering</li>
<li><RouteLink to="/frontend/api-and-logic.html">API &amp; Candidate Logic</RouteLink> — Width calculation, candidate matching, sort/pagination</li>
<li><RouteLink to="/frontend/ui-events.html">UI Events</RouteLink> — Zoom, resize, drag, thumbnails</li>
<li><RouteLink to="/frontend/text-tool.html">Text Tool</RouteLink> — Fabric.js text overlay system</li>
<li><RouteLink to="/frontend/webgl-mask.html">WebGL Mask</RouteLink> — GPU-accelerated redaction mask rendering</li>
</ul>
</div></template>


