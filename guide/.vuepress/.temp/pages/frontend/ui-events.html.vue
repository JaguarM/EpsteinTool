<template><div><h1 id="ui-events-—-ui-events-js" tabindex="-1"><a class="header-anchor" href="#ui-events-—-ui-events-js"><span>UI Events — <code v-pre>ui-events.js</code></span></a></h1>
<p>[ui-events.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/ui-events.js) handles zoom controls, redaction box resizing/dragging, and thumbnail rendering.</p>
<h2 id="zoom" tabindex="-1"><a class="header-anchor" href="#zoom"><span>Zoom</span></a></h2>
<h3 id="updatezoomleveltext" tabindex="-1"><a class="header-anchor" href="#updatezoomleveltext"><span><code v-pre>updateZoomLevelText()</code></span></a></h3>
<p>Syncs the zoom input display with <code v-pre>state.currentZoom</code>.</p>
<h3 id="updatecsszoom" tabindex="-1"><a class="header-anchor" href="#updatecsszoom"><span><code v-pre>updateCSSZoom()</code></span></a></h3>
<p>Applies the current zoom by setting the <code v-pre>--scale-factor</code> CSS custom property on the viewer. Also calls <code v-pre>onZoomChange()</code> if defined (used by the text tool to update Fabric canvas dimensions).</p>
<h3 id="processzoomfromtext-newzoom-mousex-mousey" tabindex="-1"><a class="header-anchor" href="#processzoomfromtext-newzoom-mousex-mousey"><span><code v-pre>processZoomFromText(newZoom, mouseX?, mouseY?)</code></span></a></h3>
<p>Constrains the zoom to <code v-pre>[minZoom, maxZoom]</code>, updates <code v-pre>state.currentZoom</code>, and applies. When mouse coordinates are provided (Ctrl+Wheel), preserves the document position under the cursor by adjusting scroll offsets.</p>
<p><strong>Zoom is CSS-only</strong> — no canvas re-rendering is needed because pages are <code v-pre>&lt;img&gt;</code> elements that scale via CSS transforms.</p>
<h2 id="redaction-resizing" tabindex="-1"><a class="header-anchor" href="#redaction-resizing"><span>Redaction Resizing</span></a></h2>
<h3 id="initresize-e-idx-edge" tabindex="-1"><a class="header-anchor" href="#initresize-e-idx-edge"><span><code v-pre>initResize(e, idx, edge)</code></span></a></h3>
<p>Called when a user drags one of the four edge handles (<code v-pre>l</code>, <code v-pre>r</code>, <code v-pre>t</code>, <code v-pre>b</code>):</p>
<ol>
<li>Captures start position and dimensions</li>
<li>On <code v-pre>mousemove</code>: updates <code v-pre>r.x</code> / <code v-pre>r.y</code> / <code v-pre>r.width</code> / <code v-pre>r.height</code> based on drag delta, scaled by <code v-pre>1/currentZoom</code></li>
<li>Updates overlay CSS custom properties in real-time</li>
<li>Re-evaluates matches for the affected redaction (live)</li>
<li>Updates the match summary count</li>
<li>On <code v-pre>mouseup</code>: removes listeners</li>
</ol>
<h2 id="redaction-dragging" tabindex="-1"><a class="header-anchor" href="#redaction-dragging"><span>Redaction Dragging</span></a></h2>
<h3 id="initdragredaction-e-idx" tabindex="-1"><a class="header-anchor" href="#initdragredaction-e-idx"><span><code v-pre>initDragRedaction(e, idx)</code></span></a></h3>
<p>Called on mousedown on a redaction overlay (not on a resizer or label):</p>
<ol>
<li>Captures start position</li>
<li>On <code v-pre>mousemove</code>: updates <code v-pre>r.x</code> and <code v-pre>r.y</code> based on delta, scaled by <code v-pre>1/currentZoom</code></li>
<li>Moves the overlay via CSS custom properties</li>
<li>On <code v-pre>mouseup</code>: removes listeners</li>
</ol>
<h2 id="thumbnails" tabindex="-1"><a class="header-anchor" href="#thumbnails"><span>Thumbnails</span></a></h2>
<h3 id="renderthumbnails" tabindex="-1"><a class="header-anchor" href="#renderthumbnails"><span><code v-pre>renderThumbnails()</code></span></a></h3>
<p>Builds the sidebar thumbnail strip from <code v-pre>state.pageImages</code>. Each thumbnail is a 180px-wide <code v-pre>&lt;img&gt;</code> with a page number label. Clicking navigates to that page via <code v-pre>goToPage()</code>. The active page gets the <code v-pre>.active</code> class.</p>
</div></template>


