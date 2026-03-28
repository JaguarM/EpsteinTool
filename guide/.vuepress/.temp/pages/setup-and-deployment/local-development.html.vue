<template><div><h1 id="local-development" tabindex="-1"><a class="header-anchor" href="#local-development"><span>Local Development</span></a></h1>
<h2 id="quick-start" tabindex="-1"><a class="header-anchor" href="#quick-start"><span>Quick Start</span></a></h2>
<h3 id="windows" tabindex="-1"><a class="header-anchor" href="#windows"><span>Windows</span></a></h3>
<div class="language-powershell line-numbers-mode" data-highlighter="prismjs" data-ext="powershell"><pre v-pre><code class="language-powershell"><span class="line"><span class="token comment"># 1. Clone and enter project</span></span>
<span class="line">cd EpsteinTool</span>
<span class="line"></span>
<span class="line"><span class="token comment"># 2. Create virtual environment</span></span>
<span class="line">python <span class="token operator">-</span>m venv venv</span>
<span class="line"><span class="token punctuation">.</span>\venv\Scripts\Activate<span class="token punctuation">.</span>ps1</span>
<span class="line"></span>
<span class="line"><span class="token comment"># 3. Install dependencies</span></span>
<span class="line">pip install <span class="token operator">-</span>r requirements<span class="token punctuation">.</span>txt</span>
<span class="line"></span>
<span class="line"><span class="token comment"># 4. Run database migrations</span></span>
<span class="line">python manage<span class="token punctuation">.</span>py migrate</span>
<span class="line"></span>
<span class="line"><span class="token comment"># 5. Start dev server</span></span>
<span class="line">python manage<span class="token punctuation">.</span>py runserver</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Open <a href="http://localhost:8000" target="_blank" rel="noopener noreferrer">http://localhost:8000</a> in your browser.</p>
<h3 id="linux" tabindex="-1"><a class="header-anchor" href="#linux"><span>Linux</span></a></h3>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token comment"># 1. Install system dependencies</span></span>
<span class="line"><span class="token function">sudo</span> <span class="token function">apt-get</span> <span class="token function">install</span> <span class="token parameter variable">-y</span> python3-pip python3-venv libgl1 libglib2.0-0 <span class="token punctuation">\</span></span>
<span class="line">    build-essential libharfbuzz-bin libharfbuzz-dev</span>
<span class="line"></span>
<span class="line"><span class="token comment"># 2. Install Microsoft fonts (required for accurate width measurement)</span></span>
<span class="line"><span class="token builtin class-name">echo</span> ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula <span class="token punctuation">\</span></span>
<span class="line">    <span class="token keyword">select</span> <span class="token boolean">true</span> <span class="token operator">|</span> <span class="token function">sudo</span> debconf-set-selections</span>
<span class="line"><span class="token function">sudo</span> <span class="token function">apt-get</span> <span class="token function">install</span> <span class="token parameter variable">-y</span> fontconfig ttf-mscorefonts-installer</span>
<span class="line"><span class="token function">sudo</span> fc-cache <span class="token parameter variable">-fv</span></span>
<span class="line"></span>
<span class="line"><span class="token comment"># 3. Setup venv + install</span></span>
<span class="line">python3 <span class="token parameter variable">-m</span> venv venv</span>
<span class="line"><span class="token builtin class-name">source</span> venv/bin/activate</span>
<span class="line">pip <span class="token function">install</span> <span class="token parameter variable">-r</span> requirements.txt</span>
<span class="line"></span>
<span class="line"><span class="token comment"># 4. Migrate and run</span></span>
<span class="line">python3 manage.py migrate</span>
<span class="line">python3 manage.py runserver</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Or use the provided script:</p>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">chmod</span> +x run_app.sh</span>
<span class="line">./run_app.sh</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><p>This starts the server on port 5000 and auto-opens a browser.</p>
<hr>
<h2 id="adding-fonts" tabindex="-1"><a class="header-anchor" href="#adding-fonts"><span>Adding Fonts</span></a></h2>
<p>Place <code v-pre>.ttf</code> font files in <code v-pre>assets/fonts/</code>. The width calculator scans this directory automatically and makes all fonts available in the frontend dropdown.</p>
<p>Common fonts to add:</p>
<ul>
<li><code v-pre>times.ttf</code> (Times New Roman)</li>
<li><code v-pre>arial.ttf</code></li>
<li><code v-pre>cour.ttf</code> (Courier New)</li>
<li><code v-pre>calibri.ttf</code></li>
</ul>
<h2 id="collecting-static-files" tabindex="-1"><a class="header-anchor" href="#collecting-static-files"><span>Collecting Static Files</span></a></h2>
<p>During development, Django's <code v-pre>staticfiles</code> app serves files directly from the <code v-pre>static/</code> folders of each app (<code v-pre>guesser_core</code>, <code v-pre>webgl_mask</code>, <code v-pre>text_tool</code>). For production, run:</p>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line">python manage.py collectstatic <span class="token parameter variable">--noinput</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>This copies all static assets to the <code v-pre>STATIC_ROOT</code> (<code v-pre>static/</code> at project root).</p>
<h2 id="running-tests" tabindex="-1"><a class="header-anchor" href="#running-tests"><span>Running Tests</span></a></h2>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token builtin class-name">cd</span> tests/</span>
<span class="line">python <span class="token parameter variable">-m</span> pytest test_app.py</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><blockquote>
<p><strong>Note:</strong> <code v-pre>test_app.py</code> currently tests against the legacy Flask <code v-pre>app.py</code>. To test the Django views, use <code v-pre>python manage.py test guesser_core</code>.</p>
</blockquote>
</div></template>


