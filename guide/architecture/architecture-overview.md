# Epstein Unredactor — Architecture Overview

A Django web application that analyzes scanned PDF documents to detect black redaction bars, measures their pixel widths, and helps users identify which names could fit under each redaction by matching text widths. The project uses a multi-app "Plugin" architecture to isolate different features.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Web framework** | Django 6.0 | URL routing, template rendering, API views |
| **PDF parsing** | PyMuPDF (fitz) | Extract embedded images and text spans from PDFs |
| **Image analysis** | OpenCV + NumPy | Detect black rectangular redaction boxes in page images |
| **Text shaping** | uHarfBuzz (+ Pillow fallback) | Measure precise pixel widths of candidate names accounting for kerning and ligatures |
| **Mask generation** | Pillow + NumPy | Create grayscale mask PNGs marking redacted regions |
| **Frontend rendering** | Vanilla JS, Fabric.js, WebGL | PDF page display, text overlays, GPU-accelerated mask tinting |
| **Production server** | Gunicorn + Nginx | WSGI app server behind a reverse proxy with SSL |

## Directory Structure

```
EpsteinTool/
├── manage.py                       # Django entry point
├── requirements.txt                # Python dependencies
├── setup.sh                        # Production server setup (Linux)
├── run_app.sh / run_app.bat        # Local dev launchers
│
├── epstein_project/                # Django project config
│   ├── settings.py                 # INSTALLED_APPS (registers the 3 apps below)
│   ├── urls.py                     # Root URL conf
│   ├── wsgi.py / asgi.py
│
├── guesser_core/                   # Core App (Base Viewer & Redaction Processing)
│   ├── views.py                    # Root /, /analyze-pdf
│   ├── urls.py                     
│   ├── logic/                      
│   │   ├── BoxDetector.py          # Row-scan black box detection
│   │   ├── SurroundingWordWidth.py # Refine box edges using nearby text positions
│   │   └── ProcessRedactions.py    # Orchestrator: PDF → boxes → refined redactions
│   ├── templates/                  # Base index.html (dynamic hooks for plugins)
│   └── static/guesser_core/        # Base UI JS (pdf-viewer.js, app.js, api.js)
│
├── text_tool/                      # Plugin App (Font logic & Typography)
│   ├── views.py                    # /widths, /fonts-list
│   ├── urls.py
│   ├── logic/
│   │   ├── width_calculator.py     # HarfBuzz width measurement
│   │   └── extract_fonts.py        # Dominant font detection
│   ├── templates/                  # Toolbars injected into guesser_core UI
│   └── static/text_tool/           # text-tool.js (Fabric.js canvas wrapper)
│
├── webgl_mask/                     # Plugin App (Visual GPU Masks)
│   ├── views.py                    # /webgl/masks
│   ├── urls.py
│   ├── logic/
│   │   └── artifact_visualizer.py  # OpenCV -> grayscale mask PNG generator
│   ├── templates/                  # Toolbars injected into guesser_core UI
│   └── static/webgl_mask/          # webgl-mask.js (WebGL renderer)
│
├── embedded_text_viewer/           # Plugin App (Standalone Inline Text Overlay)
│   ├── views.py                    # /embedded-text-viewer/, /embedded-text-viewer/api/analyze
│   ├── urls.py
│   ├── logic/
│   │   ├── dependency/             # PyMuPDF span text extraction
│   │   └── data/                   # Formatting and Text overlay visualization
│   ├── templates/                  # Toolbar link and Standalone index preview
│   └── static/
│       └── embedded_text_viewer/   # UI app.js and CSS
│
├── assets/
│   ├── fonts/                      # .ttf font files for width calculation
│   ├── names/                      # Pre-built candidate name lists
│   └── pdfs/                       # Sample PDF documents
│
├── guide/                          # Documentation (you are here)
└── tests/                          # Test scripts
```

## Data Flow

```mermaid
flowchart TD
    A["User uploads PDF"] --> B["POST /analyze-pdf (guesser_core)"]
    B --> C{"Is image?"}
    C -->|Yes| D["process_image()"]
    C -->|No| E["process_pdf()"]

    E --> F["Extract embedded page images\n(PyMuPDF)"]
    F --> G["BoxDetector\nfind_redaction_boxes_in_image()"]
    G --> H["SurroundingWordWidth\nestimate_widths_for_boxes()"]
    H --> I["Return JSON:\nredactions + page images"]

    D --> G2["BoxDetector\nfind_redaction_boxes_in_image()"]
    G2 --> I2["Return JSON:\nredactions + page image"]

    I --> J["Frontend (pdf-viewer.js) renders pages"]
    I2 --> J
    
    J --> Y["Frontend calls async fetchMasksAsync()"]
    Y --> O["POST /webgl/masks (webgl_mask)"]
    O --> P["artifact_visualizer\ngenerate_all_masks()"]
    P --> Q["webgl-mask.js renders mask tint on canvas"]

    J --> K["User adds candidate names"]
    K --> L["POST /widths (text_tool)\n(HarfBuzz text shaping)"]
    L --> M["Compare widths vs\nredaction box widths"]
    M --> N["Highlight matching names"]
```

## Module Dependencies

```mermaid
graph TD
    subgraph "Django Project"
        urls["epstein_project/urls.py"]
    end

    subgraph "guesser_core (Core App)"
        PR["ProcessRedactions.py"]
        BD["BoxDetector.py"]
        SW["SurroundingWordWidth.py"]
        core_views["views.py"]
        HTML["index.html"]
        APP["app.js / pdf-viewer.js / api.js"]
    end

    subgraph "webgl_mask (Plugin)"
        WGL_V["views.py"]
        AV["artifact_visualizer.py"]
        WGL_JS["webgl-mask.js"]
        WGL_T["templates"]
    end

    subgraph "text_tool (Plugin)"
        TXT_V["views.py"]
        WC["width_calculator.py"]
        TXT_JS["text-tool.js"]
        TXT_T["templates"]
    end

    subgraph "embedded_text_viewer (Plugin)"
        ETV_V["views.py"]
        ETV_L["PyMuPDF logic"]
        ETV_JS["app.js"]
        ETV_T["templates"]
    end

    urls --> core_views
    urls --> WGL_V
    urls --> TXT_V
    urls --> ETV_V

    core_views --> PR
    PR --> BD
    PR --> SW
    
    WGL_V --> AV
    AV -.->|"reads from core"| BD

    TXT_V --> WC

    ETV_V --> ETV_L

    HTML -.->|"dynamically includes"| WGL_T
    HTML -.->|"dynamically includes"| TXT_T
    HTML -.->|"dynamically includes"| ETV_T
    APP -.->|"depends on"| WGL_JS
    APP -.->|"depends on"| TXT_JS
```
