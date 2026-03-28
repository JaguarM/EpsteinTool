<template><div><h1 id="state-management-—-state-js" tabindex="-1"><a class="header-anchor" href="#state-management-—-state-js"><span>State Management — <code v-pre>state.js</code></span></a></h1>
<p>[state.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/state.js) defines two global objects used by all other frontend modules.</p>
<h2 id="state-—-application-state" tabindex="-1"><a class="header-anchor" href="#state-—-application-state"><span><code v-pre>state</code> — Application State</span></a></h2>
<div class="language-javascript line-numbers-mode" data-highlighter="prismjs" data-ext="js"><pre v-pre><code class="language-javascript"><span class="line"><span class="token keyword">const</span> state <span class="token operator">=</span> <span class="token punctuation">{</span></span>
<span class="line">  <span class="token comment">// PDF Viewer</span></span>
<span class="line">  <span class="token literal-property property">pageImages</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>         <span class="token comment">// data URLs (base64), index 0 = page 1</span></span>
<span class="line">  <span class="token literal-property property">numPages</span><span class="token operator">:</span> <span class="token number">0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">pageWidth</span><span class="token operator">:</span> <span class="token number">816</span><span class="token punctuation">,</span>         <span class="token comment">// pixel width of page images</span></span>
<span class="line">  <span class="token literal-property property">pageHeight</span><span class="token operator">:</span> <span class="token number">1056</span><span class="token punctuation">,</span>       <span class="token comment">// pixel height of page images</span></span>
<span class="line">  <span class="token literal-property property">currentPage</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">currentZoom</span><span class="token operator">:</span> <span class="token number">1.0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">minZoom</span><span class="token operator">:</span> <span class="token number">0.5</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">maxZoom</span><span class="token operator">:</span> <span class="token number">8.0</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">renderQueue</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">fabricCanvases</span><span class="token operator">:</span> <span class="token keyword">new</span> <span class="token class-name">Map</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>  <span class="token comment">// page_num → Fabric.Canvas instance</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment">// Unredactor</span></span>
<span class="line">  <span class="token literal-property property">candidates</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token operator">...</span><span class="token punctuation">]</span><span class="token punctuation">,</span>      <span class="token comment">// array of name strings (pre-populated with known names)</span></span>
<span class="line">  <span class="token literal-property property">redactions</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>         <span class="token comment">// array of redaction objects (see below)</span></span>
<span class="line">  <span class="token literal-property property">selectedRedactionIdx</span><span class="token operator">:</span> <span class="token keyword">null</span><span class="token punctuation">,</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment">// Pagination/Sort</span></span>
<span class="line">  <span class="token literal-property property">page</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">perPage</span><span class="token operator">:</span> <span class="token number">15</span><span class="token punctuation">,</span></span>
<span class="line">  <span class="token literal-property property">sortBy</span><span class="token operator">:</span> <span class="token string">'name'</span><span class="token punctuation">,</span>         <span class="token comment">// 'name' or 'width'</span></span>
<span class="line">  <span class="token literal-property property">sortDir</span><span class="token operator">:</span> <span class="token string">'asc'</span></span>
<span class="line"><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="redaction-object-schema" tabindex="-1"><a class="header-anchor" href="#redaction-object-schema"><span>Redaction Object Schema</span></a></h3>
<p>Each item in <code v-pre>state.redactions</code> is created by <code v-pre>handleFileUpload()</code>:</p>
<div class="language-javascript line-numbers-mode" data-highlighter="prismjs" data-ext="js"><pre v-pre><code class="language-javascript"><span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token literal-property property">page</span><span class="token operator">:</span> <span class="token number">1</span><span class="token punctuation">,</span>               <span class="token comment">// 1-based page number</span></span>
<span class="line">  <span class="token literal-property property">x</span><span class="token operator">:</span> <span class="token number">203.0</span><span class="token punctuation">,</span>              <span class="token comment">// pixel x coordinate</span></span>
<span class="line">  <span class="token literal-property property">y</span><span class="token operator">:</span> <span class="token number">438.0</span><span class="token punctuation">,</span>              <span class="token comment">// pixel y coordinate</span></span>
<span class="line">  <span class="token literal-property property">width</span><span class="token operator">:</span> <span class="token number">121.53</span><span class="token punctuation">,</span>         <span class="token comment">// pixel width</span></span>
<span class="line">  <span class="token literal-property property">height</span><span class="token operator">:</span> <span class="token number">16.0</span><span class="token punctuation">,</span>          <span class="token comment">// pixel height</span></span>
<span class="line">  <span class="token literal-property property">area</span><span class="token operator">:</span> <span class="token number">1944.48</span><span class="token punctuation">,</span>         <span class="token comment">// width × height</span></span>
<span class="line"></span>
<span class="line">  <span class="token literal-property property">settings</span><span class="token operator">:</span> <span class="token punctuation">{</span>            <span class="token comment">// per-redaction font/matching settings</span></span>
<span class="line">    <span class="token literal-property property">font</span><span class="token operator">:</span> <span class="token string">"times.ttf"</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token literal-property property">size</span><span class="token operator">:</span> <span class="token number">12</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token literal-property property">scale</span><span class="token operator">:</span> <span class="token number">178</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token literal-property property">tol</span><span class="token operator">:</span> <span class="token number">3</span><span class="token punctuation">,</span>              <span class="token comment">// tolerance in pixels for width matching</span></span>
<span class="line">    <span class="token literal-property property">kern</span><span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token literal-property property">lig</span><span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token literal-property property">upper</span><span class="token operator">:</span> <span class="token boolean">false</span></span>
<span class="line">  <span class="token punctuation">}</span><span class="token punctuation">,</span></span>
<span class="line"></span>
<span class="line">  <span class="token literal-property property">widths</span><span class="token operator">:</span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">,</span>            <span class="token comment">// { "name": measuredWidth, ... }</span></span>
<span class="line">  <span class="token literal-property property">labelText</span><span class="token operator">:</span> <span class="token string">""</span><span class="token punctuation">,</span>         <span class="token comment">// current overlay label text</span></span>
<span class="line">  <span class="token literal-property property">manualLabel</span><span class="token operator">:</span> <span class="token boolean">false</span>     <span class="token comment">// true if user manually edited the label</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="els-—-dom-element-cache" tabindex="-1"><a class="header-anchor" href="#els-—-dom-element-cache"><span><code v-pre>els</code> — DOM Element Cache</span></a></h2>
<p>All DOM elements are cached at load time to avoid repeated <code v-pre>getElementById</code> calls:</p>
<table>
<thead>
<tr>
<th>Group</th>
<th>Elements</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Viewer</strong></td>
<td><code v-pre>dragOverlay</code>, <code v-pre>viewerContainer</code>, <code v-pre>viewer</code>, <code v-pre>titleElem</code>, <code v-pre>pageCountElem</code>, <code v-pre>pageInputElem</code>, <code v-pre>zoomInputElem</code>, <code v-pre>zoomInBtn</code>, <code v-pre>zoomOutBtn</code>, <code v-pre>sidebar</code>, <code v-pre>toggleSidebarBtn</code>, <code v-pre>thumbnailView</code></td>
</tr>
<tr>
<td><strong>Tools</strong></td>
<td><code v-pre>toolsSidebar</code>, <code v-pre>toggleToolsBtn</code>, <code v-pre>toggleWebglBtn</code>, <code v-pre>webglOptionsBar</code>, <code v-pre>textOptionsBar</code>, <code v-pre>maskColor</code>, <code v-pre>edgeSubtract</code></td>
</tr>
<tr>
<td><strong>Settings</strong></td>
<td><code v-pre>font</code>, <code v-pre>size</code>, <code v-pre>calcScale</code>, <code v-pre>tol</code>, <code v-pre>kern</code>, <code v-pre>lig</code>, <code v-pre>upper</code></td>
</tr>
<tr>
<td><strong>Data</strong></td>
<td><code v-pre>pdfFile</code>, <code v-pre>nameInput</code>, <code v-pre>pasteInput</code>, <code v-pre>tableBody</code>, <code v-pre>pageInfo</code></td>
</tr>
<tr>
<td><strong>Matches</strong></td>
<td><code v-pre>allMatchesCard</code>, <code v-pre>allMatchesSummary</code>, <code v-pre>allMatchesBody</code></td>
</tr>
</tbody>
</table>
</div></template>


