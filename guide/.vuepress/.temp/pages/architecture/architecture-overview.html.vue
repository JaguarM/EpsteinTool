<template><div><h1 id="epstein-unredactor-—-architecture-overview" tabindex="-1"><a class="header-anchor" href="#epstein-unredactor-—-architecture-overview"><span>Epstein Unredactor — Architecture Overview</span></a></h1>
<p>A Django web application that analyzes scanned PDF documents to detect black redaction bars, measures their pixel widths, and helps users identify which names could fit under each redaction by matching text widths. The project uses a multi-app &quot;Plugin&quot; architecture to isolate different features.</p>
<h2 id="technology-stack" tabindex="-1"><a class="header-anchor" href="#technology-stack"><span>Technology Stack</span></a></h2>
<table>
<thead>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Web framework</strong></td>
<td>Django 6.0</td>
<td>URL routing, template rendering, API views</td>
</tr>
<tr>
<td><strong>PDF parsing</strong></td>
<td>PyMuPDF (fitz)</td>
<td>Extract embedded images and text spans from PDFs</td>
</tr>
<tr>
<td><strong>Image analysis</strong></td>
<td>OpenCV + NumPy</td>
<td>Detect black rectangular redaction boxes in page images</td>
</tr>
<tr>
<td><strong>Text shaping</strong></td>
<td>uHarfBuzz (+ Pillow fallback)</td>
<td>Measure precise pixel widths of candidate names accounting for kerning and ligatures</td>
</tr>
<tr>
<td><strong>Mask generation</strong></td>
<td>Pillow + NumPy</td>
<td>Create grayscale mask PNGs marking redacted regions</td>
</tr>
<tr>
<td><strong>Frontend rendering</strong></td>
<td>Vanilla JS, Fabric.js, WebGL</td>
<td>PDF page display, text overlays, GPU-accelerated mask tinting</td>
</tr>
<tr>
<td><strong>Production server</strong></td>
<td>Gunicorn + Nginx</td>
<td>WSGI app server behind a reverse proxy with SSL</td>
</tr>
</tbody>
</table>
<h2 id="directory-structure" tabindex="-1"><a class="header-anchor" href="#directory-structure"><span>Directory Structure</span></a></h2>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">EpsteinTool/</span>
<span class="line">├── manage.py                       # Django entry point</span>
<span class="line">├── requirements.txt                # Python dependencies</span>
<span class="line">├── setup.sh                        # Production server setup (Linux)</span>
<span class="line">├── run_app.sh / run_app.bat        # Local dev launchers</span>
<span class="line">│</span>
<span class="line">├── epstein_project/                # Django project config</span>
<span class="line">│   ├── settings.py                 # INSTALLED_APPS (registers the 3 apps below)</span>
<span class="line">│   ├── urls.py                     # Root URL conf</span>
<span class="line">│   ├── wsgi.py / asgi.py</span>
<span class="line">│</span>
<span class="line">├── guesser_core/                   # Core App (Base Viewer &amp; Redaction Processing)</span>
<span class="line">│   ├── views.py                    # Root /, /analyze-pdf</span>
<span class="line">│   ├── urls.py                     </span>
<span class="line">│   ├── logic/                      </span>
<span class="line">│   │   ├── BoxDetector.py          # Row-scan black box detection</span>
<span class="line">│   │   ├── SurroundingWordWidth.py # Refine box edges using nearby text positions</span>
<span class="line">│   │   └── ProcessRedactions.py    # Orchestrator: PDF → boxes → refined redactions</span>
<span class="line">│   ├── templates/                  # Base index.html (dynamic hooks for plugins)</span>
<span class="line">│   └── static/guesser_core/        # Base UI JS (pdf-viewer.js, app.js, api.js)</span>
<span class="line">│</span>
<span class="line">├── text_tool/                      # Plugin App (Font logic &amp; Typography)</span>
<span class="line">│   ├── views.py                    # /widths, /fonts-list</span>
<span class="line">│   ├── urls.py</span>
<span class="line">│   ├── logic/</span>
<span class="line">│   │   ├── width_calculator.py     # HarfBuzz width measurement</span>
<span class="line">│   │   └── extract_fonts.py        # Dominant font detection</span>
<span class="line">│   ├── templates/                  # Toolbars injected into guesser_core UI</span>
<span class="line">│   └── static/text_tool/           # text-tool.js (Fabric.js canvas wrapper)</span>
<span class="line">│</span>
<span class="line">├── webgl_mask/                     # Plugin App (Visual GPU Masks)</span>
<span class="line">│   ├── views.py                    # /webgl/masks</span>
<span class="line">│   ├── urls.py</span>
<span class="line">│   ├── logic/</span>
<span class="line">│   │   └── artifact_visualizer.py  # OpenCV -> grayscale mask PNG generator</span>
<span class="line">│   ├── templates/                  # Toolbars injected into guesser_core UI</span>
<span class="line">│   └── static/webgl_mask/          # webgl-mask.js (WebGL renderer)</span>
<span class="line">│</span>
<span class="line">├── assets/</span>
<span class="line">│   ├── fonts/                      # .ttf font files for width calculation</span>
<span class="line">│   ├── names/                      # Pre-built candidate name lists</span>
<span class="line">│   └── pdfs/                       # Sample PDF documents</span>
<span class="line">│</span>
<span class="line">├── guide/                          # Documentation (you are here)</span>
<span class="line">└── tests/                          # Test scripts</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="data-flow" tabindex="-1"><a class="header-anchor" href="#data-flow"><span>Data Flow</span></a></h2>
<div class="language-mermaid line-numbers-mode" data-highlighter="prismjs" data-ext="mermaid"><pre v-pre><code class="language-mermaid"><span class="line"><span class="token keyword">flowchart</span> TD</span>
<span class="line">    A<span class="token text string">["User uploads PDF"]</span> <span class="token arrow operator">--></span> B<span class="token text string">["POST /analyze-pdf (guesser_core)"]</span></span>
<span class="line">    B <span class="token arrow operator">--></span> C<span class="token text string">{"Is image?"}</span></span>
<span class="line">    C <span class="token arrow operator">--></span><span class="token label property">|Yes|</span> D<span class="token text string">["process_image()"]</span></span>
<span class="line">    C <span class="token arrow operator">--></span><span class="token label property">|No|</span> E<span class="token text string">["process_pdf()"]</span></span>
<span class="line"></span>
<span class="line">    E <span class="token arrow operator">--></span> F<span class="token text string">["Extract embedded page images\n(PyMuPDF)"]</span></span>
<span class="line">    F <span class="token arrow operator">--></span> G<span class="token text string">["BoxDetector\nfind_redaction_boxes_in_image()"]</span></span>
<span class="line">    G <span class="token arrow operator">--></span> H<span class="token text string">["SurroundingWordWidth\nestimate_widths_for_boxes()"]</span></span>
<span class="line">    H <span class="token arrow operator">--></span> I<span class="token text string">["Return JSON:\nredactions + page images"]</span></span>
<span class="line"></span>
<span class="line">    D <span class="token arrow operator">--></span> G2<span class="token text string">["BoxDetector\nfind_redaction_boxes_in_image()"]</span></span>
<span class="line">    G2 <span class="token arrow operator">--></span> I2<span class="token text string">["Return JSON:\nredactions + page image"]</span></span>
<span class="line"></span>
<span class="line">    I <span class="token arrow operator">--></span> J<span class="token text string">["Frontend (pdf-viewer.js) renders pages"]</span></span>
<span class="line">    I2 <span class="token arrow operator">--></span> J</span>
<span class="line">    </span>
<span class="line">    J <span class="token arrow operator">--></span> Y<span class="token text string">["Frontend calls async fetchMasksAsync()"]</span></span>
<span class="line">    Y <span class="token arrow operator">--></span> O<span class="token text string">["POST /webgl/masks (webgl_mask)"]</span></span>
<span class="line">    O <span class="token arrow operator">--></span> P<span class="token text string">["artifact_visualizer\ngenerate_all_masks()"]</span></span>
<span class="line">    P <span class="token arrow operator">--></span> Q<span class="token text string">["webgl-mask.js renders mask tint on canvas"]</span></span>
<span class="line"></span>
<span class="line">    J <span class="token arrow operator">--></span> K<span class="token text string">["User adds candidate names"]</span></span>
<span class="line">    K <span class="token arrow operator">--></span> L<span class="token text string">["POST /widths (text_tool)\n(HarfBuzz text shaping)"]</span></span>
<span class="line">    L <span class="token arrow operator">--></span> M<span class="token text string">["Compare widths vs\nredaction box widths"]</span></span>
<span class="line">    M <span class="token arrow operator">--></span> N<span class="token text string">["Highlight matching names"]</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="module-dependencies" tabindex="-1"><a class="header-anchor" href="#module-dependencies"><span>Module Dependencies</span></a></h2>
<div class="language-mermaid line-numbers-mode" data-highlighter="prismjs" data-ext="mermaid"><pre v-pre><code class="language-mermaid"><span class="line"><span class="token keyword">graph</span> TD</span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">"Django Project"</span></span>
<span class="line">        urls<span class="token text string">["epstein_project/urls.py"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">"guesser_core (Core App)"</span></span>
<span class="line">        PR<span class="token text string">["ProcessRedactions.py"]</span></span>
<span class="line">        BD<span class="token text string">["BoxDetector.py"]</span></span>
<span class="line">        SW<span class="token text string">["SurroundingWordWidth.py"]</span></span>
<span class="line">        core_views<span class="token text string">["views.py"]</span></span>
<span class="line">        HTML<span class="token text string">["index.html"]</span></span>
<span class="line">        APP<span class="token text string">["app.js / pdf-viewer.js / api.js"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">"webgl_mask (Plugin)"</span></span>
<span class="line">        WGL_V<span class="token text string">["views.py"]</span></span>
<span class="line">        AV<span class="token text string">["artifact_visualizer.py"]</span></span>
<span class="line">        WGL_JS<span class="token text string">["webgl-mask.js"]</span></span>
<span class="line">        WGL_T<span class="token text string">["templates"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">"text_tool (Plugin)"</span></span>
<span class="line">        TXT_V<span class="token text string">["views.py"]</span></span>
<span class="line">        WC<span class="token text string">["width_calculator.py"]</span></span>
<span class="line">        TXT_JS<span class="token text string">["text-tool.js"]</span></span>
<span class="line">        TXT_T<span class="token text string">["templates"]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    urls <span class="token arrow operator">--></span> core_views</span>
<span class="line">    urls <span class="token arrow operator">--></span> WGL_V</span>
<span class="line">    urls <span class="token arrow operator">--></span> TXT_V</span>
<span class="line"></span>
<span class="line">    core_views <span class="token arrow operator">--></span> PR</span>
<span class="line">    PR <span class="token arrow operator">--></span> BD</span>
<span class="line">    PR <span class="token arrow operator">--></span> SW</span>
<span class="line">    </span>
<span class="line">    WGL_V <span class="token arrow operator">--></span> AV</span>
<span class="line">    AV <span class="token arrow operator">-.-></span><span class="token label property">|"reads from core"|</span> BD</span>
<span class="line"></span>
<span class="line">    TXT_V <span class="token arrow operator">--></span> WC</span>
<span class="line"></span>
<span class="line">    HTML <span class="token arrow operator">-.-></span><span class="token label property">|"dynamically includes"|</span> WGL_T</span>
<span class="line">    HTML <span class="token arrow operator">-.-></span><span class="token label property">|"dynamically includes"|</span> TXT_T</span>
<span class="line">    APP <span class="token arrow operator">-.-></span><span class="token label property">|"depends on"|</span> WGL_JS</span>
<span class="line">    APP <span class="token arrow operator">-.-></span><span class="token label property">|"depends on"|</span> TXT_JS</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></div></template>


