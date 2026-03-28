<template><div><h1 id="text-tool-—-text-tool-js" tabindex="-1"><a class="header-anchor" href="#text-tool-—-text-tool-js"><span>Text Tool — <code v-pre>text-tool.js</code></span></a></h1>
<p>[text-tool.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/text-tool.js) provides a Fabric.js-based text overlay system for placing editable text on top of PDF pages. It is used to visually type text into redacted regions.</p>
<h2 id="core-functions" tabindex="-1"><a class="header-anchor" href="#core-functions"><span>Core Functions</span></a></h2>
<h3 id="createpageoverlay-pagecontainer-pagenum" tabindex="-1"><a class="header-anchor" href="#createpageoverlay-pagecontainer-pagenum"><span><code v-pre>createPageOverlay(pageContainer, pageNum)</code></span></a></h3>
<p>Creates a Fabric.js canvas overlay on top of a page container. The canvas matches the page dimensions and is positioned absolutely.</p>
<p><strong>Canvas setup:</strong></p>
<ul>
<li>Transparent background</li>
<li>Selection disabled by default</li>
<li>Mouse events wired for text insertion</li>
</ul>
<h3 id="resetfabriccanvases" tabindex="-1"><a class="header-anchor" href="#resetfabriccanvases"><span><code v-pre>resetFabricCanvases()</code></span></a></h3>
<p>Disposes all active Fabric.js canvas instances. Called when a new file is uploaded.</p>
<h3 id="onzoomchange-newzoom" tabindex="-1"><a class="header-anchor" href="#onzoomchange-newzoom"><span><code v-pre>onZoomChange(newZoom)</code></span></a></h3>
<p>Called by <code v-pre>updateCSSZoom()</code> when the zoom level changes. Adjusts Fabric canvas dimensions to match the new zoom scale so that objects remain properly positioned.</p>
<h2 id="text-placement" tabindex="-1"><a class="header-anchor" href="#text-placement"><span>Text Placement</span></a></h2>
<p>When the text tool is active (toggle button in toolbar):</p>
<ul>
<li><strong>Click on page</strong> → creates a new <code v-pre>fabric.IText</code> object at the click position</li>
<li>Text properties are read from the Fabric options bar: font family, font size, scale, bold/italic/underline/strikethrough, letter spacing, and color</li>
</ul>
<h2 id="fabric-options-bar" tabindex="-1"><a class="header-anchor" href="#fabric-options-bar"><span>Fabric Options Bar</span></a></h2>
<p>The <code v-pre>#fabric-options-bar</code> provides controls for:</p>
<table>
<thead>
<tr>
<th>Control</th>
<th>ID</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td>Font family</td>
<td><code v-pre>fabric-font-family</code></td>
<td>Dropdown: Arial, Times New Roman, Courier New, Georgia, Verdana</td>
</tr>
<tr>
<td>Font size</td>
<td><code v-pre>fabric-font-size</code></td>
<td>Number input (px)</td>
</tr>
<tr>
<td>Horizontal scale</td>
<td><code v-pre>fabric-font-scale</code></td>
<td>Percentage (affects <code v-pre>scaleX</code>)</td>
</tr>
<tr>
<td>Bold</td>
<td><code v-pre>fabric-bold</code></td>
<td>Toggle button</td>
</tr>
<tr>
<td>Italic</td>
<td><code v-pre>fabric-italic</code></td>
<td>Toggle button</td>
</tr>
<tr>
<td>Underline</td>
<td><code v-pre>fabric-underline</code></td>
<td>Toggle button</td>
</tr>
<tr>
<td>Strikethrough</td>
<td><code v-pre>fabric-strikethrough</code></td>
<td>Toggle button</td>
</tr>
<tr>
<td>Letter spacing</td>
<td><code v-pre>fabric-letter-spacing</code></td>
<td>Number input (em units)</td>
</tr>
<tr>
<td>Text color</td>
<td><code v-pre>fabric-color</code></td>
<td>Color picker</td>
</tr>
</tbody>
</table>
<h2 id="redaction-gap-controls" tabindex="-1"><a class="header-anchor" href="#redaction-gap-controls"><span>Redaction Gap Controls</span></a></h2>
<p>The <code v-pre>#redact-gap-controls</code> section appears when relevant:</p>
<ul>
<li><strong>Gap slider</strong> (<code v-pre>redact-gap-slider</code>): adjusts the width of spaces between text elements to match the gap patterns in the source document</li>
<li>Displayed as <code v-pre>{value} px</code> next to the slider</li>
</ul>
</div></template>


