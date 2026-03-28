<template><div><h1 id="api-candidate-logic-—-api-js" tabindex="-1"><a class="header-anchor" href="#api-candidate-logic-—-api-js"><span>API &amp; Candidate Logic — <code v-pre>api.js</code></span></a></h1>
<p>[api.js](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/static/guesser/api.js) manages the candidate name list, sends width calculation requests to the backend, renders the candidates table, and matches candidate widths against redaction box widths.</p>
<h2 id="candidate-management" tabindex="-1"><a class="header-anchor" href="#candidate-management"><span>Candidate Management</span></a></h2>
<h3 id="addname" tabindex="-1"><a class="header-anchor" href="#addname"><span><code v-pre>addName()</code></span></a></h3>
<p>Reads from the name input field, adds to <code v-pre>state.candidates</code> if not a duplicate, then triggers width recalculation.</p>
<h3 id="processpaste" tabindex="-1"><a class="header-anchor" href="#processpaste"><span><code v-pre>processPaste()</code></span></a></h3>
<p>Reads multi-line text from the paste textarea, adds each non-empty, non-duplicate line to <code v-pre>state.candidates</code>.</p>
<h3 id="clearall" tabindex="-1"><a class="header-anchor" href="#clearall"><span><code v-pre>clearAll()</code></span></a></h3>
<p>Prompts confirmation, then clears all candidates and re-renders.</p>
<h3 id="removename-name" tabindex="-1"><a class="header-anchor" href="#removename-name"><span><code v-pre>removeName(name)</code></span></a></h3>
<p>Removes a specific candidate and triggers recalculation.</p>
<h2 id="width-calculation" tabindex="-1"><a class="header-anchor" href="#width-calculation"><span>Width Calculation</span></a></h2>
<h3 id="calculateallwidths" tabindex="-1"><a class="header-anchor" href="#calculateallwidths"><span><code v-pre>calculateAllWidths()</code></span></a></h3>
<p>Sends one <code v-pre>POST /widths</code> request per redaction (in parallel via <code v-pre>Promise.all</code>), using each redaction's individual <code v-pre>settings</code> (font, size, scale, kerning, ligatures).</p>
<h3 id="calculatewidthsforredaction-idx" tabindex="-1"><a class="header-anchor" href="#calculatewidthsforredaction-idx"><span><code v-pre>calculateWidthsForRedaction(idx)</code></span></a></h3>
<p>Sends a single width calculation request for the candidate list using the settings of redaction <code v-pre>idx</code>. Stores results in <code v-pre>redaction.widths[candidateName] = measuredWidth</code>.</p>
<h2 id="rendering" tabindex="-1"><a class="header-anchor" href="#rendering"><span>Rendering</span></a></h2>
<h3 id="rendercandidates" tabindex="-1"><a class="header-anchor" href="#rendercandidates"><span><code v-pre>renderCandidates()</code></span></a></h3>
<p>Renders the paginated candidates table in the sidebar. Shows name, measured width, and a delete button. Supports sorting by name or width.</p>
<h3 id="selectredaction-idx" tabindex="-1"><a class="header-anchor" href="#selectredaction-idx"><span><code v-pre>selectRedaction(idx)</code></span></a></h3>
<p>Selects a redaction by index: navigates to its page, updates the settings controls, highlights the redaction overlay and the match table row, then re-renders candidates.</p>
<h3 id="updateallmatchesview-onlyidx" tabindex="-1"><a class="header-anchor" href="#updateallmatchesview-onlyidx"><span><code v-pre>updateAllMatchesView(onlyIdx?)</code></span></a></h3>
<p>Re-renders the &quot;All Matches&quot; table. For each redaction, finds candidates whose width is within the tolerance. Updates the overlay label text (unless manually overridden). Shows match count summary.</p>
<h2 id="helper" tabindex="-1"><a class="header-anchor" href="#helper"><span>Helper</span></a></h2>
<h3 id="getfontfamily-fontname" tabindex="-1"><a class="header-anchor" href="#getfontfamily-fontname"><span><code v-pre>getFontFamily(fontName)</code></span></a></h3>
<p>Maps font filenames to CSS font-family strings:</p>
<ul>
<li><code v-pre>times</code> → <code v-pre>&quot;Times New Roman&quot;, serif</code></li>
<li><code v-pre>arial</code> → <code v-pre>Arial, sans-serif</code></li>
<li><code v-pre>calibri</code> → <code v-pre>Calibri, sans-serif</code></li>
<li><code v-pre>cour</code> → <code v-pre>&quot;Courier New&quot;, monospace</code></li>
</ul>
</div></template>


