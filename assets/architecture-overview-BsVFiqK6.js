import{a as e,c as t,i as n,l as r,n as i,o as a,r as o,s,t as c}from"./app-CL0pSD9Q.js";var l=JSON.parse(`{"path":"/architecture/architecture-overview.html","title":"Epstein Unredactor — Architecture Overview","lang":"en-US","frontmatter":{},"git":{"updatedTime":1780776451000,"contributors":[{"name":"JaguarM","username":"JaguarM","email":"39597011+JaguarM@users.noreply.github.com","commits":7,"url":"https://github.com/JaguarM"}],"changelog":[{"hash":"d5bf1bc0899703a1340d6ae5815507072ddc8c2d","time":1780776451000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"Cleanup step 3"},{"hash":"7efa96eb07dd2c49d47a3f27a89f3b5c4b7cc563","time":1778316600000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"Add plugin registry and dynamic discovery"},{"hash":"f7379a270c9017587048bdc46c269272afc057f2","time":1777718854000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"updated documentation"},{"hash":"a267f4ad383509977e55b04d582225aecd2802d2","time":1775467276000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"Updated Documentation"},{"hash":"3bbb491f17913ec6288159d2b53d03c92c805a63","time":1774704928000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"Made that shit modular with django apps"},{"hash":"ead06576b31ffd1a26400fd90bfc269f882305f3","time":1774476550000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"Detect scale/size and update PDF analysis output"},{"hash":"f7330e85197db34564e6215e1d272b22e506e24e","time":1774437245000,"email":"39597011+JaguarM@users.noreply.github.com","author":"JaguarM","message":"Add redaction detection backend and docs"}]},"filePathRelative":"architecture/architecture-overview.md"}`),u={name:`architecture-overview.md`};function d(c,l,u,d,f,p){let m=t(`RouteLink`);return s(),o(`div`,null,[l[7]||=n(`<h1 id="epstein-unredactor-—-architecture-overview" tabindex="-1"><a class="header-anchor" href="#epstein-unredactor-—-architecture-overview"><span>Epstein Unredactor — Architecture Overview</span></a></h1><p>A Django web application that analyzes scanned PDF documents to detect black redaction bars, measures their pixel widths, and helps users identify which names could fit under each redaction by matching text widths. The project uses a &quot;Core + Plugin&quot; architecture with two complementary registries — a <strong>Python tool registry</strong> (<code>@register_tool</code>) for backend/template wiring and a <strong>JavaScript hook bus</strong> (<code>PDFHooks</code>) for frontend lifecycle wiring — so features live in independent, individually-removable Django apps.</p><h2 id="technology-stack" tabindex="-1"><a class="header-anchor" href="#technology-stack"><span>Technology Stack</span></a></h2><table><thead><tr><th>Layer</th><th>Technology</th><th>Purpose</th></tr></thead><tbody><tr><td><strong>Web framework</strong></td><td>Django 6.0</td><td>URL routing, template rendering, API views</td></tr><tr><td><strong>PDF parsing</strong></td><td>PyMuPDF (fitz)</td><td>Extract embedded images and text spans from PDFs</td></tr><tr><td><strong>Image analysis</strong></td><td>OpenCV + NumPy</td><td>Detect black rectangular redaction boxes in page images</td></tr><tr><td><strong>Refiner pipeline</strong></td><td>Python ABCs + dataclasses</td><td>Modular edge-refinement stages that each propose adjustments independently; merged by confidence</td></tr><tr><td><strong>Text shaping</strong></td><td>uHarfBuzz (+ Pillow fallback)</td><td>Measure precise pixel widths of candidate names accounting for kerning</td></tr><tr><td><strong>Mask generation</strong></td><td>Pillow + NumPy</td><td>Create grayscale mask PNGs marking redacted regions</td></tr><tr><td><strong>Frontend rendering</strong></td><td>Vanilla JS, Fabric.js, WebGL</td><td>PDF page display, SVG text overlays, GPU-accelerated mask tinting</td></tr><tr><td><strong>Plugin integration</strong></td><td><code>PDFHooks</code> event bus (JS) + <code>@register_tool</code> (Python)</td><td>Decoupled, by-event plugin wiring on both ends</td></tr><tr><td><strong>Production server</strong></td><td>Gunicorn + Nginx</td><td>WSGI app server behind a reverse proxy with SSL</td></tr></tbody></table><h2 id="directory-structure" tabindex="-1"><a class="header-anchor" href="#directory-structure"><span>Directory Structure</span></a></h2><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre><code class="language-text"><span class="line">redaction_light/</span>
<span class="line">├── manage.py                       # Django entry point</span>
<span class="line">├── requirements.txt                # Python dependencies</span>
<span class="line">├── run_app.bat                     # Local dev launcher (Windows)</span>
<span class="line">│</span>
<span class="line">├── epstein_project/                # Django project config</span>
<span class="line">│   ├── settings.py                 # INSTALLED_APPS (core + dynamic plugin discovery)</span>
<span class="line">│   ├── urls.py                     # Auto-discovers routes via registry + AppConfig</span>
<span class="line">│   ├── wsgi.py / asgi.py</span>
<span class="line">│</span>
<span class="line">├── guesser_core/                   # Core App (Base Viewer &amp; Redaction Processing)</span>
<span class="line">│   ├── base.py                     # PDFTool base class (all plugins inherit from this)</span>
<span class="line">│   ├── registry.py                 # PDFToolRegistry + @register_tool decorator</span>
<span class="line">│   ├── views.py                    # Root /, /analyze-pdf, /analyze-default</span>
<span class="line">│   ├── urls.py</span>
<span class="line">│   ├── logic/</span>
<span class="line">│   │   ├── BoxDetector.py          # Row-scan black box detection</span>
<span class="line">│   │   ├── SurroundingWordWidth.py # ETV edge-refinement logic (wrapped by EtvRefiner)</span>
<span class="line">│   │   ├── ProcessRedactions.py    # Orchestrator: PDF → boxes → RefinerPipeline → redactions</span>
<span class="line">│   │   ├── masking.py              # Shared mask-array helpers (used by webgl_mask)</span>
<span class="line">│   │   └── refiners/               # Refiner pipeline package</span>
<span class="line">│   │       ├── base.py             # DetectedBox, BoxProposal dataclasses + RedactionRefiner ABC</span>
<span class="line">│   │       ├── pipeline.py         # RefinerPipeline: independent runs + confidence-based merge</span>
<span class="line">│   │       └── etv_refiner.py      # EtvRefiner — wraps SurroundingWordWidth (confidence=0.9)</span>
<span class="line">│   ├── templates/                  # Base index.html (iterates registry for plugins)</span>
<span class="line">│   └── static/guesser_core/        # Base UI JS: hooks.js (event bus), state.js, pdf-viewer.js,</span>
<span class="line">│                                   #   ui-events.js, app.js, styles.css</span>
<span class="line">│</span>
<span class="line">├── text_tool/                      # Plugin App (Font logic &amp; Typography)</span>
<span class="line">│   ├── tool.py                     # TextTool(PDFTool) — registered via @register_tool</span>
<span class="line">│   ├── apps.py                     # ready() imports tool.py</span>
<span class="line">│   ├── views.py                    # /widths, /fonts-list</span>
<span class="line">│   ├── urls.py</span>
<span class="line">│   ├── logic/</span>
<span class="line">│   │   ├── width_calculator.py     # HarfBuzz width measurement</span>
<span class="line">│   │   └── extract_fonts.py        # Dominant font detection</span>
<span class="line">│   ├── templates/                  # Toolbars injected via registry</span>
<span class="line">│   └── static/text_tool/           # unified-text-box.js, svg-renderer.js, etc.</span>
<span class="line">│</span>
<span class="line">├── webgl_mask/                     # Plugin App (Visual GPU Masks)</span>
<span class="line">│   ├── tool.py                     # WebglMaskTool(PDFTool)</span>
<span class="line">│   ├── apps.py</span>
<span class="line">│   ├── views.py                    # /webgl/masks</span>
<span class="line">│   ├── urls.py</span>
<span class="line">│   ├── logic/</span>
<span class="line">│   │   └── artifact_visualizer.py  # OpenCV -&gt; grayscale mask PNG generator (uses core masking.py)</span>
<span class="line">│   ├── templates/                  # Toolbar button + options bar injected via registry</span>
<span class="line">│   └── static/webgl_mask/          # webgl-mask.js (WebGL renderer), webgl-mask.css</span>
<span class="line">│</span>
<span class="line">├── redaction_matching/             # Plugin App (Name-matching sidebar)</span>
<span class="line">│   ├── tool.py                     # RedactionMatchingTool(PDFTool) — UI only, no routes</span>
<span class="line">│   ├── apps.py</span>
<span class="line">│   ├── templates/                  # sidebar_tools.html, toolbar_button.html</span>
<span class="line">│   └── static/redaction_matching/  # api.js, redaction-matching.js, styles.css</span>
<span class="line">│</span>
<span class="line">├── embedded_text_viewer/           # Plugin App (Self-contained Inline Text Overlay)</span>
<span class="line">│   ├── tool.py                     # EmbeddedTextViewerTool(PDFTool)</span>
<span class="line">│   ├── apps.py</span>
<span class="line">│   ├── views.py                    # /embedded-text-viewer/api/extract-spans</span>
<span class="line">│   ├── urls.py</span>
<span class="line">│   ├── logic/                      # span extraction + width helpers</span>
<span class="line">│   ├── templates/                  # Toolbar link and options bar</span>
<span class="line">│   └── static/embedded_text_viewer/</span>
<span class="line">│       └── etv-fetch.js            # Span fetching &amp; ETV lifecycle (subscribes to PDFHooks)</span>
<span class="line">│</span>
<span class="line">├── extracted_text/                 # Backend-only App (no PDFTool, no UI, no routes)</span>
<span class="line">│   ├── apps.py                     # Pure logic module</span>
<span class="line">│   └── logic/extract.py            # extract_pdf() — imported by embedded_text_viewer.views</span>
<span class="line">│</span>
<span class="line">├── assets/</span>
<span class="line">│   ├── fonts/                      # .ttf font files for width calculation</span>
<span class="line">│   ├── names/                      # Pre-built candidate name lists</span>
<span class="line">│   └── pdfs/                       # Sample PDF documents</span>
<span class="line">│</span>
<span class="line">├── guide/                          # Documentation (you are here)</span>
<span class="line">└── db.sqlite3</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="two-registries-two-directions-of-decoupling" tabindex="-1"><a class="header-anchor" href="#two-registries-two-directions-of-decoupling"><span>Two registries, two directions of decoupling</span></a></h2><p>The project keeps the core ignorant of which plugins exist, on <strong>both</strong> ends of the stack:</p><table><thead><tr><th>Concern</th><th>Mechanism</th><th>Who registers</th><th>Who consumes</th></tr></thead><tbody><tr><td>Backend routes, templates, static, toolbar slots</td><td><code>@register_tool</code> on a <code>PDFTool</code> subclass (<code>guesser_core/registry.py</code>)</td><td>each plugin&#39;s <code>tool.py</code> (imported by its <code>apps.py</code> <code>ready()</code>)</td><td><code>epstein_project/urls.py</code> + <code>index.html</code> iterate the registry</td></tr><tr><td>Frontend runtime lifecycle (page render, document load, zoom, …)</td><td><code>PDFHooks.on(event, handler)</code> (<code>guesser_core/static/guesser_core/hooks.js</code>)</td><td>each plugin&#39;s JS at load time</td><td>the core viewer emits events with <code>PDFHooks.emit(...)</code></td></tr></tbody></table>`,9),i(`p`,null,[l[1]||=e(`Because the core `,-1),l[2]||=i(`strong`,null,`emits events`,-1),l[3]||=e(` and `,-1),l[4]||=i(`strong`,null,`iterates a registry`,-1),l[5]||=e(` rather than calling plugin code by name, deleting a plugin folder removes the app, its routes, its templates, its static, and its event subscriptions in one step — with no dangling references left in the core. (See the `,-1),a(m,{to:`/tool-expansion-guide.html`},{default:r(()=>[...l[0]||=[e(`Tool Expansion Guide`,-1)]]),_:1}),l[6]||=e(` for the hook bus contract.)`,-1)]),l[8]||=n(`<h2 id="data-flow" tabindex="-1"><a class="header-anchor" href="#data-flow"><span>Data Flow</span></a></h2><div class="language-mermaid line-numbers-mode" data-highlighter="prismjs" data-ext="mermaid"><pre><code class="language-mermaid"><span class="line"><span class="token keyword">flowchart</span> TD</span>
<span class="line">    A<span class="token text string">[&quot;User uploads PDF&quot;]</span> <span class="token arrow operator">--&gt;</span> B<span class="token text string">[&quot;POST /analyze-pdf (guesser_core)&quot;]</span></span>
<span class="line">    B <span class="token arrow operator">--&gt;</span> C<span class="token text string">{&quot;Is image?&quot;}</span></span>
<span class="line">    C <span class="token arrow operator">--&gt;</span><span class="token label property">|Yes|</span> D<span class="token text string">[&quot;process_image()&quot;]</span></span>
<span class="line">    C <span class="token arrow operator">--&gt;</span><span class="token label property">|No|</span> E<span class="token text string">[&quot;process_pdf()&quot;]</span></span>
<span class="line"></span>
<span class="line">    E <span class="token arrow operator">--&gt;</span> F<span class="token text string">[&quot;Extract embedded page images\\n(PyMuPDF)&quot;]</span></span>
<span class="line">    F <span class="token arrow operator">--&gt;</span> G<span class="token text string">[&quot;BoxDetector\\nfind_redaction_boxes_in_image()&quot;]</span></span>
<span class="line">    G <span class="token arrow operator">--&gt;</span> RP<span class="token text string">[&quot;RefinerPipeline.run()\\n— each refiner sees original box —&quot;]</span></span>
<span class="line">    RP <span class="token arrow operator">--&gt;</span> ETV<span class="token text string">[&quot;EtvRefiner\\n(SurroundingWordWidth, conf=0.9)&quot;]</span></span>
<span class="line">    ETV <span class="token arrow operator">--&gt;</span> MERGE<span class="token text string">[&quot;Merge proposals\\nhighest confidence wins&quot;]</span></span>
<span class="line">    MERGE <span class="token arrow operator">--&gt;</span> I<span class="token text string">[&quot;Return JSON:\\nredactions + page images&quot;]</span></span>
<span class="line"></span>
<span class="line">    D <span class="token arrow operator">--&gt;</span> G2<span class="token text string">[&quot;BoxDetector\\nfind_redaction_boxes_in_image()&quot;]</span></span>
<span class="line">    G2 <span class="token arrow operator">--&gt;</span> I2<span class="token text string">[&quot;Return JSON:\\nredactions + page image&quot;]</span></span>
<span class="line"></span>
<span class="line">    I <span class="token arrow operator">--&gt;</span> J<span class="token text string">[&quot;Frontend (pdf-viewer.js) renders pages&quot;]</span></span>
<span class="line">    I2 <span class="token arrow operator">--&gt;</span> J</span>
<span class="line"></span>
<span class="line">    J <span class="token arrow operator">--&gt;</span> HOOK<span class="token text string">[&quot;pdf-viewer.js emits PDFHooks events:\\nviewer:clear · page:rendered ·\\npages:refresh · document:loaded&quot;]</span></span>
<span class="line"></span>
<span class="line">    HOOK <span class="token arrow operator">--&gt;</span> O<span class="token text string">[&quot;webgl_mask subscribes →\\nPOST /webgl/masks → webgl-mask.js tints canvas&quot;]</span></span>
<span class="line">    HOOK <span class="token arrow operator">--&gt;</span> TXT<span class="token text string">[&quot;text_tool subscribes →\\nrenderTextLayer draws SVG overlay&quot;]</span></span>
<span class="line">    HOOK <span class="token arrow operator">--&gt;</span> ETVJS<span class="token text string">[&quot;embedded_text_viewer subscribes →\\nPOST /embedded-text-viewer/api/extract-spans&quot;]</span></span>
<span class="line"></span>
<span class="line">    J <span class="token arrow operator">--&gt;</span> K<span class="token text string">[&quot;User adds candidate names&quot;]</span></span>
<span class="line">    K <span class="token arrow operator">--&gt;</span> L<span class="token text string">[&quot;POST /widths (text_tool)\\n(HarfBuzz text shaping)&quot;]</span></span>
<span class="line">    L <span class="token arrow operator">--&gt;</span> M<span class="token text string">[&quot;Compare widths vs\\nredaction box widths&quot;]</span></span>
<span class="line">    M <span class="token arrow operator">--&gt;</span> N<span class="token text string">[&quot;Highlight matching names&quot;]</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="module-dependencies" tabindex="-1"><a class="header-anchor" href="#module-dependencies"><span>Module Dependencies</span></a></h2><div class="language-mermaid line-numbers-mode" data-highlighter="prismjs" data-ext="mermaid"><pre><code class="language-mermaid"><span class="line"><span class="token keyword">graph</span> TD</span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">&quot;Django Project&quot;</span></span>
<span class="line">        urls<span class="token text string">[&quot;epstein_project/urls.py&quot;]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">&quot;guesser_core (Core App)&quot;</span></span>
<span class="line">        REG<span class="token text string">[&quot;registry.py\\n@register_tool&quot;]</span></span>
<span class="line">        BASE<span class="token text string">[&quot;base.py\\nPDFTool&quot;]</span></span>
<span class="line">        HOOKS<span class="token text string">[&quot;hooks.js\\nPDFHooks bus&quot;]</span></span>
<span class="line">        PR<span class="token text string">[&quot;ProcessRedactions.py&quot;]</span></span>
<span class="line">        BD<span class="token text string">[&quot;BoxDetector.py&quot;]</span></span>
<span class="line">        SW<span class="token text string">[&quot;SurroundingWordWidth.py&quot;]</span></span>
<span class="line">        MASK<span class="token text string">[&quot;masking.py&quot;]</span></span>
<span class="line">        core_views<span class="token text string">[&quot;views.py&quot;]</span></span>
<span class="line">        HTML<span class="token text string">[&quot;index.html&quot;]</span></span>
<span class="line">        APP<span class="token text string">[&quot;app.js / pdf-viewer.js / ui-events.js&quot;]</span></span>
<span class="line">        <span class="token keyword">subgraph</span> <span class="token string">&quot;refiners/&quot;</span></span>
<span class="line">            RF_BASE<span class="token text string">[&quot;base.py\\nDetectedBox · BoxProposal\\nRedactionRefiner ABC&quot;]</span></span>
<span class="line">            RF_PIPE<span class="token text string">[&quot;pipeline.py\\nRefinerPipeline&quot;]</span></span>
<span class="line">            RF_ETV<span class="token text string">[&quot;etv_refiner.py\\nEtvRefiner&quot;]</span></span>
<span class="line">        <span class="token keyword">end</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">&quot;webgl_mask (Plugin)&quot;</span></span>
<span class="line">        WGL_TOOL<span class="token text string">[&quot;tool.py\\nWebglMaskTool&quot;]</span></span>
<span class="line">        WGL_V<span class="token text string">[&quot;views.py&quot;]</span></span>
<span class="line">        AV<span class="token text string">[&quot;artifact_visualizer.py&quot;]</span></span>
<span class="line">        WGL_JS<span class="token text string">[&quot;webgl-mask.js&quot;]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">&quot;text_tool (Plugin)&quot;</span></span>
<span class="line">        TXT_TOOL<span class="token text string">[&quot;tool.py\\nTextTool&quot;]</span></span>
<span class="line">        TXT_V<span class="token text string">[&quot;views.py&quot;]</span></span>
<span class="line">        WC<span class="token text string">[&quot;width_calculator.py&quot;]</span></span>
<span class="line">        TXT_JS<span class="token text string">[&quot;svg-renderer.js&quot;]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">&quot;redaction_matching (Plugin)&quot;</span></span>
<span class="line">        RM_TOOL<span class="token text string">[&quot;tool.py\\nRedactionMatchingTool&quot;]</span></span>
<span class="line">        RM_JS<span class="token text string">[&quot;api.js&quot;]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">subgraph</span> <span class="token string">&quot;embedded_text_viewer (Plugin)&quot;</span></span>
<span class="line">        ETV_TOOL<span class="token text string">[&quot;tool.py\\nEmbeddedTextViewerTool&quot;]</span></span>
<span class="line">        ETV_V<span class="token text string">[&quot;views.py&quot;]</span></span>
<span class="line">        ETV_JS<span class="token text string">[&quot;etv-fetch.js&quot;]</span></span>
<span class="line">        ET_LOGIC<span class="token text string">[&quot;extracted_text.logic.extract&quot;]</span></span>
<span class="line">    <span class="token keyword">end</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">%% Backend registration flow</span></span>
<span class="line">    BASE <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;inherits&quot;|</span> WGL_TOOL</span>
<span class="line">    BASE <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;inherits&quot;|</span> TXT_TOOL</span>
<span class="line">    BASE <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;inherits&quot;|</span> RM_TOOL</span>
<span class="line">    BASE <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;inherits&quot;|</span> ETV_TOOL</span>
<span class="line">    WGL_TOOL <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;@register_tool&quot;|</span> REG</span>
<span class="line">    TXT_TOOL <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;@register_tool&quot;|</span> REG</span>
<span class="line">    RM_TOOL <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;@register_tool&quot;|</span> REG</span>
<span class="line">    ETV_TOOL <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;@register_tool&quot;|</span> REG</span>
<span class="line"></span>
<span class="line">    <span class="token comment">%% Frontend hook subscriptions (core emits, plugins subscribe)</span></span>
<span class="line">    APP <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;emit()&quot;|</span> HOOKS</span>
<span class="line">    HOOKS <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;on()&quot;|</span> WGL_JS</span>
<span class="line">    HOOKS <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;on()&quot;|</span> TXT_JS</span>
<span class="line">    HOOKS <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;on()&quot;|</span> ETV_JS</span>
<span class="line"></span>
<span class="line">    <span class="token comment">%% URL routing</span></span>
<span class="line">    urls <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;registry&quot;|</span> REG</span>
<span class="line">    urls <span class="token arrow operator">--&gt;</span> core_views</span>
<span class="line"></span>
<span class="line">    <span class="token comment">%% Core dependencies</span></span>
<span class="line">    core_views <span class="token arrow operator">--&gt;</span> PR</span>
<span class="line">    PR <span class="token arrow operator">--&gt;</span> BD</span>
<span class="line">    PR <span class="token arrow operator">--&gt;</span> RF_PIPE</span>
<span class="line">    RF_PIPE <span class="token arrow operator">--&gt;</span> RF_BASE</span>
<span class="line">    RF_ETV <span class="token arrow operator">--&gt;</span> SW</span>
<span class="line">    RF_ETV <span class="token arrow operator">--&gt;</span> RF_BASE</span>
<span class="line">    core_views <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;get_tools()&quot;|</span> REG</span>
<span class="line">    HTML <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;iterates registry&quot;|</span> REG</span>
<span class="line"></span>
<span class="line">    <span class="token comment">%% Plugin backends</span></span>
<span class="line">    WGL_V <span class="token arrow operator">--&gt;</span> AV</span>
<span class="line">    AV <span class="token arrow operator">--&gt;</span><span class="token label property">|&quot;uses&quot;|</span> MASK</span>
<span class="line">    AV <span class="token arrow operator">-.-&gt;</span><span class="token label property">|&quot;reads from core&quot;|</span> BD</span>
<span class="line">    TXT_V <span class="token arrow operator">--&gt;</span> WC</span>
<span class="line">    ETV_V <span class="token arrow operator">--&gt;</span> ET_LOGIC</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="refiner-pipeline" tabindex="-1"><a class="header-anchor" href="#refiner-pipeline"><span>Refiner Pipeline</span></a></h2><p>Redaction boxes are refined by <code>RefinerPipeline</code> (<code>guesser_core/logic/refiners/pipeline.py</code>), which runs all registered refiners <strong>independently against the original detected box</strong> and then merges their proposals edge-by-edge.</p><h3 id="merge-strategy" tabindex="-1"><a class="header-anchor" href="#merge-strategy"><span>Merge strategy</span></a></h3><p>For each edge (left / right) independently:</p><ol><li>Collect all non-<code>None</code> proposals from refiners.</li><li>Pick the proposal with the <strong>highest confidence</strong>.</li><li>On a confidence tie, prefer the <strong>less aggressive</strong> shrink (left edge stays leftmost; right edge stays rightmost).</li><li>Safety bound: a proposal can only shrink the box, never expand it beyond the original detected extent.</li></ol><h3 id="registered-refiners-analyze-pdf" tabindex="-1"><a class="header-anchor" href="#registered-refiners-analyze-pdf"><span>Registered refiners (<code>/analyze-pdf</code>)</span></a></h3><table><thead><tr><th>Refiner</th><th>Confidence</th><th>Evidence</th><th>What it does</th></tr></thead><tbody><tr><td><code>EtvRefiner</code></td><td>0.9</td><td><code>fitz.Page</code>, image rect + dims</td><td>Finds words before/after box in embedded PDF text; measures space width; rejects proposals that change box width by &gt;25%</td></tr></tbody></table><p>The pipeline is built in <code>ProcessRedactions.py</code> as <code>_etv_pipeline = RefinerPipeline([EtvRefiner()])</code>.</p><h3 id="adding-a-new-refiner" tabindex="-1"><a class="header-anchor" href="#adding-a-new-refiner"><span>Adding a new refiner</span></a></h3><ol><li>Create a class anywhere that inherits <code>RedactionRefiner</code> from <code>guesser_core/logic/refiners/base.py</code>.</li><li>Implement <code>refine(box: DetectedBox, evidence: Any) -&gt; BoxProposal</code>.</li><li>Add an instance to the pipeline list in <code>guesser_core/logic/ProcessRedactions.py</code> and supply its evidence in the <code>evidence_map</code> passed to <code>pipeline.run()</code>.</li></ol><p>No changes to <code>base.py</code>, <code>pipeline.py</code>, or existing refiners are needed.</p><h2 id="frontend-plugin-integration-—-the-pdfhooks-bus" tabindex="-1"><a class="header-anchor" href="#frontend-plugin-integration-—-the-pdfhooks-bus"><span>Frontend plugin integration — the <code>PDFHooks</code> bus</span></a></h2><p><code>guesser_core/static/guesser_core/hooks.js</code> defines <code>window.PDFHooks</code> (<code>on</code> / <code>off</code> / <code>emit</code>). It is loaded <strong>first</strong>, before any other script. The core viewer emits lifecycle events; plugins subscribe. Handlers may be async (<code>emit</code> awaits them in registration order) and a throwing handler never breaks the core or other plugins.</p><table><thead><tr><th>Event</th><th>Emitted by</th><th>Payload</th><th>Example subscriber</th></tr></thead><tbody><tr><td><code>ui:ready</code></td><td><code>app.js</code> (end of init)</td><td>—</td><td><code>webgl_mask</code> wires its mask-toggle button</td></tr><tr><td><code>viewer:clear</code></td><td><code>pdf-viewer.js</code> (<code>goToPage</code>)</td><td>—</td><td><code>webgl_mask</code> tears down GL contexts</td></tr><tr><td><code>page:rendered</code></td><td><code>pdf-viewer.js</code> (<code>goToPage</code>)</td><td><code>{ pageContainer, pageNum }</code></td><td><code>webgl_mask</code> adds its overlay canvas; <code>text_tool</code> draws the SVG layer</td></tr><tr><td><code>pages:refresh</code></td><td><code>pdf-viewer.js</code> (<code>goToPage</code>)</td><td>—</td><td><code>webgl_mask</code> re-syncs visible mask canvases</td></tr><tr><td><code>document:loaded</code></td><td><code>pdf-viewer.js</code> (<code>loadDocument</code>)</td><td><code>{ file, isDefault }</code></td><td><code>webgl_mask</code> fetches masks; <code>embedded_text_viewer</code> fetches spans</td></tr><tr><td><code>zoom:changed</code></td><td><code>ui-events.js</code> (<code>updateCSSZoom</code>)</td><td><code>{ zoom }</code></td><td>(available for plugins that need zoom-aware redraws)</td></tr></tbody></table><p>The core never calls a plugin function by name and owns no plugin DOM. Plugins that contribute a subtoolbar register their toggle button with <code>window.registerSubtoolbar(button)</code> so the generic <code>openSubtoolbar</code> can manage it without naming the plugin.</p>`,19)])}var f=c(u,[[`render`,d]]);export{l as _pageData,f as default};