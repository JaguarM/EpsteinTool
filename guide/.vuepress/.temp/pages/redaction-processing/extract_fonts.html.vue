<template><div><h1 id="extract-fonts-—-font-detection-module" tabindex="-1"><a class="header-anchor" href="#extract-fonts-—-font-detection-module"><span>extract_fonts — Font Detection Module</span></a></h1>
<p><strong>File:</strong> <code v-pre>text_tool/logic/extract_fonts.py</code></p>
<p>Detects the dominant font used in a PDF and maps it to one of the <code v-pre>.ttf</code> files
available in <code v-pre>assets/fonts/</code>. The result is returned to the frontend as
<code v-pre>suggested_font</code> and <code v-pre>suggested_size</code> so the toolbar and width calculator are
pre-configured on every PDF load.</p>
<hr>
<h2 id="how-it-fits-into-the-pipeline" tabindex="-1"><a class="header-anchor" href="#how-it-fits-into-the-pipeline"><span>How it fits into the pipeline</span></a></h2>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">POST /analyze-pdf</span>
<span class="line">  └── process_pdf()              # ProcessRedactions.py</span>
<span class="line">        └── extracts text_spans  # PyMuPDF span data, one entry per text run</span>
<span class="line">  └── detect_dominant_font()     # text_tool.logic.extract_fonts   ← this module</span>
<span class="line">        └── returns font_file, font_size, pdf_font_name</span>
<span class="line">  └── JsonResponse</span>
<span class="line">        ├── suggested_font       # e.g. "times.ttf"</span>
<span class="line">        └── suggested_size       # e.g. 12.0</span>
<span class="line"></span>
<span class="line">Browser (pdf-viewer.js)</span>
<span class="line">  └── sets els.font.value  = suggested_font</span>
<span class="line">  └── sets els.size.value  = suggested_size</span>
<span class="line">  └── seeds every redaction's settings.font / settings.size</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h2 id="public-api" tabindex="-1"><a class="header-anchor" href="#public-api"><span>Public API</span></a></h2>
<h3 id="detect-dominant-font-text-spans-available-fonts" tabindex="-1"><a class="header-anchor" href="#detect-dominant-font-text-spans-available-fonts"><span><code v-pre>detect_dominant_font(text_spans, available_fonts)</code></span></a></h3>
<p>Analyses pre-extracted text spans and returns the font that accounts for the
most body-text characters in the document.</p>
<p><strong>Parameters</strong></p>
<table>
<thead>
<tr>
<th>Name</th>
<th>Type</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>text_spans</code></td>
<td><code v-pre>list[dict]</code></td>
<td>Span list produced by <code v-pre>ProcessRedactions.process_pdf</code>. Each entry: <code v-pre>{&quot;page&quot;: int, &quot;text&quot;: str, &quot;font&quot;: {&quot;size&quot;: float, &quot;flags&quot;: int, &quot;matched_font&quot;: str}}</code></td>
</tr>
<tr>
<td><code v-pre>available_fonts</code></td>
<td><code v-pre>list[str]</code></td>
<td><code v-pre>.ttf</code> filenames present in <code v-pre>assets/fonts/</code> (from <code v-pre>width_calculator.get_available_fonts()</code>). Only fonts in this list can be returned.</td>
</tr>
</tbody>
</table>
<p><strong>Returns</strong> — <code v-pre>dict</code></p>
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
<td><code v-pre>font_file</code></td>
<td><code v-pre>str | None</code></td>
<td>Filename to load, e.g. <code v-pre>&quot;times.ttf&quot;</code>. <code v-pre>None</code> if the dominant font has no match in <code v-pre>available_fonts</code>.</td>
</tr>
<tr>
<td><code v-pre>font_size</code></td>
<td><code v-pre>float</code></td>
<td>Most common size (in points) for that font across all spans.</td>
</tr>
<tr>
<td><code v-pre>pdf_font_name</code></td>
<td><code v-pre>str</code></td>
<td>Raw internal PDF font name, e.g. <code v-pre>&quot;TimesNewRomanPSMT&quot;</code>.</td>
</tr>
</tbody>
</table>
<p><strong>Example</strong></p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line"><span class="token keyword">from</span> text_tool<span class="token punctuation">.</span>logic<span class="token punctuation">.</span>extract_fonts <span class="token keyword">import</span> detect_dominant_font</span>
<span class="line"><span class="token keyword">from</span> text_tool<span class="token punctuation">.</span>logic<span class="token punctuation">.</span>width_calculator <span class="token keyword">import</span> get_available_fonts</span>
<span class="line"></span>
<span class="line">result <span class="token operator">=</span> detect_dominant_font<span class="token punctuation">(</span>spans<span class="token punctuation">,</span> get_available_fonts<span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line"><span class="token comment"># {"font_file": "times.ttf", "font_size": 12.0, "pdf_font_name": "TimesNewRomanPSMT"}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><hr>
<h2 id="detection-algorithm" tabindex="-1"><a class="header-anchor" href="#detection-algorithm"><span>Detection algorithm</span></a></h2>
<ol>
<li><strong>Aggregate character counts</strong> — iterate every span; accumulate the number
of characters per <code v-pre>(pdf_font_name, size)</code> pair.</li>
<li><strong>Filter noise</strong> — discard any font whose total character count is below
<code v-pre>MIN_CHARS</code> (currently <code v-pre>35</code>). This eliminates page headers, footnotes,
watermarks, and one-off decorative glyphs that are not representative of
body text.</li>
<li><strong>Pick dominant font</strong> — the font with the highest total character count
after filtering.</li>
<li><strong>Pick dominant size</strong> — for that font, the size bucket with the most
characters.</li>
<li><strong>Map to <code v-pre>.ttf</code></strong> — run the PDF internal name through <code v-pre>FONT_MAP</code> (see
below); return the first matching <code v-pre>.ttf</code> that exists in <code v-pre>available_fonts</code>.</li>
</ol>
<hr>
<h2 id="font-mapping-table-font-map" tabindex="-1"><a class="header-anchor" href="#font-mapping-table-font-map"><span>Font mapping table (<code v-pre>FONT_MAP</code>)</span></a></h2>
<p>Evaluated top-to-bottom; first keyword match wins.</p>
<table>
<thead>
<tr>
<th>Keywords in PDF font name</th>
<th>Mapped <code v-pre>.ttf</code> file</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>times</code>, <code v-pre>roman</code></td>
<td><code v-pre>times.ttf</code></td>
</tr>
<tr>
<td><code v-pre>courier</code></td>
<td><code v-pre>courier_new.ttf</code></td>
</tr>
<tr>
<td><code v-pre>arial</code>, <code v-pre>helvetica</code></td>
<td><code v-pre>arial.ttf</code></td>
</tr>
<tr>
<td><code v-pre>calibri</code></td>
<td><code v-pre>calibri.ttf</code></td>
</tr>
<tr>
<td><code v-pre>verdana</code></td>
<td><code v-pre>verdana.ttf</code></td>
</tr>
<tr>
<td><code v-pre>segoe</code></td>
<td><code v-pre>segoe_ui.ttf</code></td>
</tr>
</tbody>
</table>
<p>If no keyword matches, or the matched <code v-pre>.ttf</code> is not present in <code v-pre>available_fonts</code>,
<code v-pre>font_file</code> is returned as <code v-pre>None</code> and the frontend falls back to whatever is
currently selected in the font dropdown.</p>
<hr>
<h2 id="constants" tabindex="-1"><a class="header-anchor" href="#constants"><span>Constants</span></a></h2>
<table>
<thead>
<tr>
<th>Name</th>
<th>Default</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>MIN_CHARS</code></td>
<td><code v-pre>35</code></td>
<td>Minimum character count for a font to be considered significant. Raise to be more conservative; lower to detect fonts in short documents.</td>
</tr>
</tbody>
</table>
<hr>
<h2 id="standalone-script" tabindex="-1"><a class="header-anchor" href="#standalone-script"><span>Standalone script</span></a></h2>
<p>The module doubles as a CLI tool for auditing font metadata across a local
directory tree. Run directly with Python:</p>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line">python text_tool/logic/extract_fonts.py</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>The <code v-pre>base_directory</code> and <code v-pre>target_directories</code> at the bottom of the file control
which folders are scanned. For each PDF found it prints every recognised font
along with its character count, type, and encoding, and tags the highest-use
font as <code v-pre>[PRIMARY FONT]</code>.</p>
<p>This is useful for verifying that the <code v-pre>FONT_MAP</code> keywords cover the fonts
present in a new corpus before uploading documents to the tool.</p>
<hr>
<h2 id="adding-a-new-font" tabindex="-1"><a class="header-anchor" href="#adding-a-new-font"><span>Adding a new font</span></a></h2>
<ol>
<li>Drop the <code v-pre>.ttf</code> file into <code v-pre>assets/fonts/</code>.</li>
<li>Add a row to <code v-pre>FONT_MAP</code> in <code v-pre>extract_fonts.py</code>:<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line"><span class="token punctuation">(</span><span class="token punctuation">[</span><span class="token string">"myfont"</span><span class="token punctuation">,</span> <span class="token string">"alternate-name"</span><span class="token punctuation">]</span><span class="token punctuation">,</span> <span class="token string">"myfont.ttf"</span><span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div></li>
<li>Keywords are matched against the <strong>lowercase</strong> PDF-internal font name, so
use lowercase in the keyword list.</li>
<li>Place the new row before any existing row whose keywords could
accidentally match the same font name.</li>
</ol>
</div></template>


