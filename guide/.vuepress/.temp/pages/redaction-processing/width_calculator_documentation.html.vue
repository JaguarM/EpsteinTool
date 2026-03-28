<template><div><h1 id="width-calculator-py" tabindex="-1"><a class="header-anchor" href="#width-calculator-py"><span>width_calculator.py</span></a></h1>
<p><a href="../../text_tool/logic/width_calculator.py">width_calculator.py</a> provides precision text-width measurement for candidate name matching.</p>
<hr>
<h2 id="functions" tabindex="-1"><a class="header-anchor" href="#functions"><span>Functions</span></a></h2>
<h3 id="get-text-widths-texts-font-name-font-size-force-uppercase-scale-factor-kerning-ligatures" tabindex="-1"><a class="header-anchor" href="#get-text-widths-texts-font-name-font-size-force-uppercase-scale-factor-kerning-ligatures"><span><code v-pre>get_text_widths(texts, font_name, font_size, force_uppercase, scale_factor, kerning, ligatures)</code></span></a></h3>
<p>Calculates pixel widths for a list of text strings.</p>
<p><strong>Parameters:</strong></p>
<table>
<thead>
<tr>
<th>Parameter</th>
<th>Type</th>
<th>Default</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>texts</code></td>
<td>list[str]</td>
<td>—</td>
<td>Strings to measure</td>
</tr>
<tr>
<td><code v-pre>font_name</code></td>
<td>str</td>
<td><code v-pre>&quot;times.ttf&quot;</code></td>
<td>Font filename</td>
</tr>
<tr>
<td><code v-pre>font_size</code></td>
<td>int/float</td>
<td><code v-pre>12</code></td>
<td>Font size in <strong>points</strong></td>
</tr>
<tr>
<td><code v-pre>force_uppercase</code></td>
<td>bool</td>
<td><code v-pre>False</code></td>
<td>Convert text to uppercase before measuring</td>
</tr>
<tr>
<td><code v-pre>scale_factor</code></td>
<td>float</td>
<td><code v-pre>1.35</code></td>
<td>Multiplier applied to the raw advance width</td>
</tr>
<tr>
<td><code v-pre>kerning</code></td>
<td>bool</td>
<td><code v-pre>True</code></td>
<td>Enable OpenType <code v-pre>kern</code> feature</td>
</tr>
<tr>
<td><code v-pre>ligatures</code></td>
<td>bool</td>
<td><code v-pre>True</code></td>
<td>Enable <code v-pre>liga</code> and <code v-pre>clig</code> features</td>
</tr>
</tbody>
</table>
<p><strong>Output:</strong></p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line"><span class="token punctuation">[</span><span class="token punctuation">{</span><span class="token string">"text"</span><span class="token punctuation">:</span> <span class="token string">"Jeffrey Epstein"</span><span class="token punctuation">,</span> <span class="token string">"width"</span><span class="token punctuation">:</span> <span class="token number">89.472</span><span class="token punctuation">}</span><span class="token punctuation">,</span> <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">]</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><hr>
<h3 id="font-resolution" tabindex="-1"><a class="header-anchor" href="#font-resolution"><span>Font Resolution</span></a></h3>
<p>The font is searched in this order:</p>
<ol>
<li>Direct path (<code v-pre>font_name</code> as-is)</li>
<li><code v-pre>assets/fonts/{font_name}</code></li>
<li><code v-pre>assets/fonts/{font_name}.ttf</code></li>
</ol>
<p>System font directories are intentionally excluded to ensure consistent results across environments.</p>
<hr>
<h3 id="harfbuzz-engine-primary" tabindex="-1"><a class="header-anchor" href="#harfbuzz-engine-primary"><span>HarfBuzz Engine (Primary)</span></a></h3>
<p>When <code v-pre>uharfbuzz</code> is available:</p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line">face <span class="token operator">=</span> hb<span class="token punctuation">.</span>Face<span class="token punctuation">(</span>font_data<span class="token punctuation">)</span></span>
<span class="line">font <span class="token operator">=</span> hb<span class="token punctuation">.</span>Font<span class="token punctuation">(</span>face<span class="token punctuation">)</span></span>
<span class="line">upem <span class="token operator">=</span> face<span class="token punctuation">.</span>upem   <span class="token comment"># units per em</span></span>
<span class="line"></span>
<span class="line">buf <span class="token operator">=</span> hb<span class="token punctuation">.</span>Buffer<span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">buf<span class="token punctuation">.</span>add_str<span class="token punctuation">(</span>text<span class="token punctuation">)</span></span>
<span class="line">buf<span class="token punctuation">.</span>guess_segment_properties<span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">hb<span class="token punctuation">.</span>shape<span class="token punctuation">(</span>font<span class="token punctuation">,</span> buf<span class="token punctuation">,</span> features<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">total_advance <span class="token operator">=</span> <span class="token builtin">sum</span><span class="token punctuation">(</span>pos<span class="token punctuation">.</span>x_advance <span class="token keyword">for</span> pos <span class="token keyword">in</span> buf<span class="token punctuation">.</span>glyph_positions<span class="token punctuation">)</span></span>
<span class="line">pixel_width <span class="token operator">=</span> <span class="token punctuation">(</span>total_advance <span class="token operator">/</span> upem<span class="token punctuation">)</span> <span class="token operator">*</span> font_size <span class="token operator">*</span> scale_factor</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><strong>Features controlled:</strong></p>
<table>
<thead>
<tr>
<th>Feature</th>
<th>Enabled</th>
<th>Disabled</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>kern</code></td>
<td>Default</td>
<td><code v-pre>kerning=False</code></td>
</tr>
<tr>
<td><code v-pre>liga</code></td>
<td>Default</td>
<td><code v-pre>ligatures=False</code></td>
</tr>
<tr>
<td><code v-pre>clig</code></td>
<td>Default</td>
<td><code v-pre>ligatures=False</code></td>
</tr>
<tr>
<td><code v-pre>dlig</code></td>
<td>Never</td>
<td><code v-pre>ligatures=False</code></td>
</tr>
</tbody>
</table>
<h3 id="pillow-fallback" tabindex="-1"><a class="header-anchor" href="#pillow-fallback"><span>Pillow Fallback</span></a></h3>
<p>If HarfBuzz fails or is not installed, falls back to <code v-pre>ImageFont.truetype()</code> with <code v-pre>font.getlength()</code>. This method does not support fine-grained kerning/ligature control.</p>
<hr>
<h3 id="get-available-fonts" tabindex="-1"><a class="header-anchor" href="#get-available-fonts"><span><code v-pre>get_available_fonts()</code></span></a></h3>
<p>Scans the <code v-pre>assets/fonts/</code> directory and returns a list of <code v-pre>.ttf</code> filenames.</p>
<p><strong>Output:</strong> <code v-pre>[&quot;times.ttf&quot;, &quot;arial.ttf&quot;, ...]</code></p>
<p>Used by the <code v-pre>/fonts-list</code> API endpoint to populate the frontend font dropdown.</p>
<hr>
<h2 id="scale-factor" tabindex="-1"><a class="header-anchor" href="#scale-factor"><span>Scale Factor</span></a></h2>
<p><code v-pre>scale_factor</code> is the multiplier that converts a raw typographic advance (in font points) into the <strong>image pixel width</strong> used by the redaction overlay coordinates.</p>
<h3 id="formula" tabindex="-1"><a class="header-anchor" href="#formula"><span>Formula</span></a></h3>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">pixel_width = (advance / upem) × font_size_pt × scale_factor</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>For the width to match a redaction box measured in the 816 × 1056 px embedded page images:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">scale_factor = img_width_px / page_width_pt</span>
<span class="line">             = 816 / 612</span>
<span class="line">             = 4/3</span>
<span class="line">             ≈ 1.3333</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This is equivalent to converting from 72 dpi (PDF points) to 96 dpi (screen pixels): <code v-pre>96 / 72 = 4/3</code>.</p>
<h3 id="how-the-frontend-sets-scale-factor" tabindex="-1"><a class="header-anchor" href="#how-the-frontend-sets-scale-factor"><span>How the frontend sets scale_factor</span></a></h3>
<p>The <code v-pre>/analyze-pdf</code> response includes <code v-pre>suggested_scale</code> (an integer percentage). <code v-pre>views.py</code> divides it by 100 before passing it to <code v-pre>get_text_widths()</code>:</p>
<div class="language-python line-numbers-mode" data-highlighter="prismjs" data-ext="py"><pre v-pre><code class="language-python"><span class="line">scale_factor <span class="token operator">=</span> scale <span class="token operator">/</span> <span class="token number">100.0</span>   <span class="token comment"># e.g. 133 / 100 = 1.33</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>The auto-detected value <code v-pre>suggested_scale = 133</code> corresponds to <code v-pre>scale_factor ≈ 1.333</code>, which correctly maps 12 pt Times New Roman to its pixel width in the embedded page images.</p>
<blockquote>
<p><strong>Note:</strong> The function signature's default <code v-pre>scale_factor=1.35</code> is a legacy approximation of 4/3. In normal operation the frontend always supplies an explicit scale from the <code v-pre>suggested_scale</code> auto-detection, so the default is rarely used.</p>
</blockquote>
<p>For a full derivation of the correct scale value and why the old formula (<code v-pre>(median_size / 12) × (816/612)² × 100 ≈ 178</code>) was incorrect, see <RouteLink to="/redaction-processing/scale-and-size-detection.html">Scale &amp; Size Detection</RouteLink>.</p>
</div></template>


