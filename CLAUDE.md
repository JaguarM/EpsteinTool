# EpsteinTool — AI Working Guide

## What this project does

A Django web app that analyzes scanned PDFs to find black redaction bars and guess which names fit underneath them. It measures the pixel width of each redacted area, then computes the rendered width of candidate names using the document's actual font, and highlights matches.

Live at **unbarpdf.com**.

---

## Stack

| Layer | Technology |
|---|---|
| Web framework | Django 6.0 + SQLite |
| PDF parsing | PyMuPDF (`fitz`) |
| Image processing | OpenCV + NumPy + Pillow |
| Font shaping / width | uharfbuzz (HarfBuzz Python bindings) |
| Server | gunicorn + nginx + systemd |
| Frontend | Vanilla JS + CSS (no build step, no bundler) |

---

## Directory layout

```
EpsteinTool/
  epstein_project/        # Django project (settings, root URLs, wsgi/asgi)
  guesser_core/           # Core app — ALWAYS installed; never remove
  redaction_matching/     # Plugin — sidebar name-matching tool
  embedded_text_viewer/   # Plugin — extracted text overlay on PDF
  text_tool/              # Plugin — text editing / measurement
  webgl_mask/             # Plugin — WebGL-based mask visualization
  extracted_text/         # Plugin — text extraction backend
  assets/
    fonts/                # .ttf files used for width calculations
    pdfs/times/           # Default PDF (efta00018586.pdf) auto-loaded on startup
  db.sqlite3              # SQLite database (no meaningful data; migrations only)
  requirements.txt
  run_app.sh              # Dev launcher (activates venv, runs manage.py runserver 5000)
  setup.sh                # Production install (apt, nginx, systemd, certbot)
  epsteintool.service     # Systemd unit file
```

---

## Plugin system — how to add or understand a tool

`guesser_core` provides a minimal plugin registry. Any Django app placed in the project root is auto-discovered by `settings.py` (it scans for directories with `apps.py`) and auto-routed by `epstein_project/urls.py`.

**To register a tool**, create a `tool.py` in your app:

```python
from guesser_core.base import PDFTool
from guesser_core.registry import register_tool

@register_tool
class MyTool(PDFTool):
    name = 'my_tool'                                     # required, unique
    url_prefix = 'my-tool/'                              # for include()
    url_module  = 'my_tool.urls'                         # dotted path
    toolbar_button = 'my_tool/toolbar_button.html'       # template
    options_bar    = 'my_tool/options_bar.html'
    sidebar        = 'my_tool/sidebar_tools.html'
    shows_text_options_bar = True    # include shared text_options_bar.html
    has_sidebar_toggle = True
    styles  = [{'path': 'my_tool/styles.css'}]
    scripts_before_viewer = [{'path': 'my_tool/api.js', 'version': 'v=1'}]
    scripts_after_app     = [{'path': 'my_tool/logic.js'}]
```

`PDFTool` attributes (all optional except `name`):

| Attribute | Default | Purpose |
|---|---|---|
| `name` | — | Registry key; must be unique |
| `url_prefix` | `''` | Path prefix for URL include |
| `url_module` | `None` | Dotted module path to urls.py |
| `styles` | `()` | List of `{'path': '...'}` CSS dicts |
| `toolbar_button` | `None` | Template path for toolbar icon |
| `options_bar` | `None` | Template path for top options bar |
| `sidebar` | `None` | Template path for sidebar panel |
| `shows_text_options_bar` | `False` | Show shared text options bar |
| `has_sidebar_toggle` | `False` | Add sidebar toggle button |
| `scripts_before_viewer` | `()` | JS injected before the PDF viewer |
| `scripts_after_app` | `()` | JS injected after app.js |

The `tool.py` file is imported at startup via Django's app registry, so the `@register_tool` decorator fires automatically. No manual registration step required.

---

## Core data flow

```
User uploads PDF
      │
      ▼
POST /analyze-pdf
      │
      ▼
guesser_core/views.py → process_pdf(pdf_bytes)
      │
      ├─ PyMuPDF: extract text spans (for font detection)
      ├─ PyMuPDF: extract embedded PNG/TIFF images per page
      ├─ BoxDetector.find_redaction_boxes_in_image()   ← OpenCV row-scan
      ├─ RefinerPipeline.run()                         ← ETV refiner narrows each box
      └─ Returns JSON:
            {
              redactions: [{page, x, y, width, height, area}, ...],
              spans: [{page, text, font: {size, flags, matched_font}}, ...],
              pdf_fonts: ['TimesNewRoman', ...],      # most-common-first
              suggested_scale: 133,                  # px-per-pt ratio * 100
              suggested_size: 12.0,                  # body text pt size (mode)
              page_images: ['base64...', ...],       # one PNG per page
              page_image_type: 'image/png',
              page_width: 816, page_height: 1056,
              num_pages: N,
            }
      │
      ▼
Frontend renders page images + overlays redaction boxes
      │
User enters candidate names
      │
      ▼
JS calls measurement APIs → compares candidate width to redaction width
      │
Matches highlighted in UI
```

There is also `GET /analyze-default` which processes the bundled PDF at `assets/pdfs/times/efta00018586.pdf` and returns the same JSON — used for auto-load on startup.

---

## Key logic files

### `guesser_core/logic/BoxDetector.py`

`find_redaction_boxes_in_image(image_bytes)` → `(boxes, img_w, img_h)`

Finds pure-black (pixel value < 10) rectangular runs ≥ 17 px wide and ≥ 10 px tall. Uses a row-by-row scan with `active_runs` tracking: a run at y survives to y+1 only if a current segment at y+1 contains it (within ±2 px tolerance). This handles crosses and ladder patterns. Returns `boxes` as `[(x1, y1, x2, y2), ...]` in image pixel coordinates.

### `guesser_core/logic/ProcessRedactions.py`

`process_pdf(pdf_bytes)` — main entry point. Crops images to 8.5×11 aspect ratio before processing. Computes `suggested_scale` (px-per-pt ratio) from the first image rect found. Computes `suggested_size` as the mode of body-text font sizes (spans with ≥ 20 chars, else ≥ 1 char).

`process_image(image_bytes, mime_type)` — same pipeline for standalone image uploads. Always returns `suggested_scale: 178` (no page rect available).

### `guesser_core/logic/refiners/`

A `RefinerPipeline` runs a list of `Refiner` subclasses in sequence. Each refiner can adjust the `DetectedBox` coordinates. Currently one refiner is active:

- `EtvRefiner` — uses the embedded text viewer's span data to align the detected box more precisely with surrounding text baselines.

`DetectedBox` dataclass: `page, x, y, width, height`.

### `guesser_core/logic/shaper.py` — `HarfBuzzShaper`

Wraps `uharfbuzz` to measure rendered text width. Initialized with a font `.ttf` path. `shape_text(text, kerning, ligatures)` returns a list of glyph dicts with `x_advance`, `glyph_id`, `cluster`. Used to compute pixel width of a candidate name at a given font size and scale.

### `guesser_core/logic/SurroundingWordWidth.py`

`estimate_widths_for_boxes(page, boxes, img_rect, img_w, img_h)` — uses PyMuPDF's `page.get_text("words")` to find words immediately to the left and right of each redaction box, then infers the expected redaction width from the gap between them.

### `guesser_core/logic/layout_calculator.py`

Layout math for converting between image pixel coordinates and PDF point coordinates.

### `guesser_core/logic/line_breaker.py`

Handles text that wraps across lines inside a single redaction region.

### `guesser_core/logic/masking.py`

Utilities for generating or manipulating pixel masks over redacted regions.

---

## Running locally

```bash
cd /home/jaguarm/EpsteinTool

# First time
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate

# Every time
source venv/bin/activate
python3 manage.py runserver 5000
# → http://localhost:5000
```

The app auto-loads the default PDF on startup (`GET /analyze-default`).

---

## URL structure

| URL | Handler | Purpose |
|---|---|---|
| `/` | `guesser_core.views.index` | Main page |
| `/analyze-pdf` | `guesser_core.views.analyze_pdf` | POST: upload PDF or image |
| `/analyze-default` | `guesser_core.views.analyze_default` | GET: process bundled PDF |
| `/<plugin>/…` | per-plugin urls.py | Plugin-specific API endpoints |

Plugin URL prefixes are declared on the tool class (`url_prefix`) and registered automatically at startup.

---

## Frontend architecture

No build step. Each page load gets:
1. `guesser_core/static/guesser_core/styles.css` + per-plugin CSS
2. Scripts injected in order: `scripts_before_viewer` (per-plugin) → `pdf-viewer.js` → `state.js` → `app.js` → `ui-events.js` → `scripts_after_app` (per-plugin)

State is managed in `state.js`. The PDF viewer renders page images (base64 PNG from the backend) and overlays redaction boxes as DOM elements. Plugin scripts interact with the state object.

---

## Adding a font

1. Drop the `.ttf` into `assets/fonts/`.
2. It becomes available to `HarfBuzzShaper` by path.
3. The frontend lists available fonts from the `pdf_fonts` array returned by the backend and lets the user pick.

Fonts currently bundled: Arial, Calibri, Courier New, Segoe UI, Times New Roman, Verdana.

---

## Key invariants

- **Page images are always PNG** at 816×1056 px (8.5×11 in @ 96 dpi). Images taller than this are cropped before processing to avoid FDLE TIFF artefacts.
- **Coordinates**: `BoxDetector` returns image pixel coords. `ProcessRedactions` converts to PDF point coords only for display; all internal logic works in pixels.
- **`suggested_scale`** is the ratio `img_px_width / page_pt_width × 100`, stored as an integer. The frontend uses it to convert HarfBuzz advances (design units) to pixel widths.
- **`suggested_size`** is the mode body-text font size in pt. The frontend pre-fills the font size input with this value.
- **Gemini concurrency**: if using the automation toolkit to drive Gemini against this project, always set `max_concurrency=1` on the orchestrator to avoid CDP race conditions.
- **No authentication**. The app is intentionally open — it only reads uploaded files, writes nothing to the database from user input.

---

## Tests

Test files (`tests.py` in each app) are Django stubs with no test cases yet. To run what exists:

```bash
python3 manage.py test
```

---

## Production deploy

Deployed at `unbarpdf.com`. See `setup.sh` for the full nginx + gunicorn + systemd + certbot install procedure. The systemd unit is in `epsteintool.service`. The service runs as `www-data` from `/var/www/epsteintool`.
