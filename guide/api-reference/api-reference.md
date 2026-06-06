# API Reference

The Django backend exposes several HTTP endpoints organized into modular apps.

> **Note:** All POST endpoints use `@csrf_exempt` — no CSRF token is required. There is no authentication.

## Endpoints

### `guesser_core` (Base Viewer)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serves the single-page application |
| `POST` | `/analyze-pdf` | Upload a PDF or image for redaction analysis |
| `GET` | `/analyze-default` | Processes the bundled default PDF |

### `text_tool` (Typography Plugin)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/widths` | Calculate pixel widths for candidate text strings |
| `GET` | `/fonts-list` | List available font files |

### `webgl_mask` (GPU Visualization Plugin)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webgl/masks` | Generate all redaction masks for an uploaded PDF |
| `GET` | `/webgl/masks?default=true` | Generate all masks for the default PDF |

### `embedded_text_viewer` (Embedded Text Viewer Plugin)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/embedded-text-viewer/api/extract-spans` | Extract all text spans from an uploaded PDF |
| `GET` | `/embedded-text-viewer/api/extract-spans` | Extract spans from the bundled default PDF |

> **Note:** This endpoint is **optional** — if the `embedded_text_viewer` plugin folder is deleted, the endpoint is removed and the text overlay feature is disabled.

### `redaction_matching` (Name Matching Plugin)

Frontend-only — exposes **no HTTP endpoints**. All name-width matching runs client-side in `redaction_matching/static/redaction_matching/api.js` against the widths returned by `/widths`.

### `extracted_text` (Logic-only)

No HTTP endpoints. A pure-Python module (`extracted_text/logic/extract.py`) imported by `embedded_text_viewer.views`.

---

## `POST /analyze-pdf`

Upload a file (PDF or image) for redaction box detection and text span extraction.

### Request

- **Content-Type:** `multipart/form-data`
- **Body:** Form field `file` containing the uploaded file

Supported formats:
- PDF (`application/pdf`)
- Images: PNG, JPEG, TIFF, BMP, WebP

### Response — `200 OK`

```json
{
  "redactions": [
    {
      "page": 1,
      "x": 203.0,
      "y": 438.0,
      "width": 121.53,
      "height": 16.0,
      "area": 1944.48
    }
  ],
  "spans": [
    {
      "page": 1,
      "text": "Confidential",
      "font": {
        "size": 12.0,
        "flags": 0,
        "matched_font": "TimesNewRomanPSMT"
      }
    }
  ],
  "pdf_fonts": ["TimesNewRomanPSMT", "TimesNewRomanPS-BoldMT"],
  "suggested_scale": 133,
  "suggested_size": 12.0,
  "suggested_font": "times.ttf",
  "page_images": ["base64-encoded-PNG-string", null, "..."],
  "page_image_type": "image/png",
  "page_width": 816,
  "page_height": 1056,
  "num_pages": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `redactions` | array | Detected redaction boxes sorted by page, then y, then x. Coordinates are in the embedded image's pixel space. |
| `spans` | array | Text spans with font metadata (PDF only, always `[]` for images) |
| `pdf_fonts` | array | Base-font names declared in the PDF, sorted by number of pages they appear on (most common first). `[]` for images. |
| `suggested_scale` | int | Recommended "Scale %" for the width calculator. `133` for standard 816 px / 612 pt letter pages. See [Scale & Size Detection](../redaction-processing/scale-and-size-detection.md). |
| `suggested_size` | float | Dominant body-text font size in points, detected from text spans. `12.0` when unknown. |
| `suggested_font` | str \| null | `.ttf` filename of the dominant font (e.g. `"times.ttf"`). `null` if the font could not be matched to an available file. |
| `page_images` | array | Base64-encoded PNG for each page (one per page, `null` if no embedded image found on that page) |
| `page_image_type` | string | MIME type of the page images — always `"image/png"` |
| `page_width` / `page_height` | int | Pixel dimensions of the page images (816 × 1056 for standard PDFs; actual image dimensions for raw image uploads) |
| `num_pages` | int | Total number of pages |

### Errors

| Status | Reason |
|--------|--------|
| `400` | No file uploaded or no file selected |
| `500` | Processing error (detail in response body) |

---

## `POST /widths`

Calculate pixel widths for a list of text strings using HarfBuzz text shaping.

### Request

- **Content-Type:** `application/json`

```json
{
  "strings": ["Jeffrey Epstein", "Ghislaine Maxwell"],
  "font": "times.ttf",
  "size": 12,
  "scale": 133,
  "kerning": true,
  "force_uppercase": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strings` | array | `[]` | Text strings to measure |
| `font` | string | `"times.ttf"` | Font filename from `assets/fonts/` |
| `size` | number | `12` | Font size in points |
| `scale` | number | `135` | Scale percentage (divided by 100 internally to get `scale_factor`) |
| `kerning` | bool | `true` | Enable OpenType `kern` feature |
| `force_uppercase` | bool | `false` | Measure uppercase version of each string |

The width formula applied by the backend is:

```
pixel_width = (advance / upem) × size × (scale / 100)
```

With `scale = 133` and `size` set to the document's body-text size, this matches the pixel-space width of that text as it appears in the embedded page images.

### Response — `200 OK`

```json
{
  "results": [
    { "text": "Jeffrey Epstein", "width": 89.472 },
    { "text": "Ghislaine Maxwell", "width": 107.136 }
  ]
}
```

---

## `GET /fonts-list`

Returns a JSON array of available `.ttf` font filenames from `assets/fonts/`.

### Response — `200 OK`

```json
["times.ttf", "arial.ttf", "courier_new.ttf", "calibri.ttf"]
```

---

## `POST /webgl/masks`

Asynchronously generates redaction masks for an entire document. This is separated from `/analyze-pdf` to improve response times for the main layout.

### Request

- **Content-Type:** `multipart/form-data`
- **Body:** Form field `file` containing the same PDF previously sent to `/analyze-pdf`.

### Response — `200 OK`

```json
{
  "mask_images": [
    "base64-encoded-PNG-mask-string",
    null,
    "base64-encoded-PNG-mask-string"
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `mask_images` | array | Array of base64-encoded grayscale PNG masks (one per page). `null` suggests no redactions on that page. |

---

## `GET /webgl/masks?default=true`

Utility endpoint to fetch masks for the bundled default demonstration PDF.

### Response — `200 OK`

Returns the same schema as `POST /webgl/masks`.

---

## `POST /embedded-text-viewer/api/extract-spans`

Extract all text spans from an uploaded PDF. Used by `etv-fetch.js` to populate the SVG text overlay.

### Request

- **Content-Type:** `multipart/form-data`
- **Body:** Form field `file` containing the uploaded PDF

### Response — `200 OK`

```json
{
  "spans": [
    {
      "page": 1,
      "text": "IN THE CIRCUIT COURT",
      "x": 245.33,
      "y": 112.67,
      "w": 326.00,
      "h": 16.00,
      "fontSize": 16.00,
      "sizePt": 12.0,
      "font": "TimesNewRomanPSMT",
      "flags": 0,
      "lineId": "1_3",
      "chars": [{"c": "I", "x": 0.0, "w": 8.2}]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `page` | int | 1-based page number |
| `text` | string | Full text content of the span |
| `x`, `y` | float | Top-left position in document pixel space (816×1056 base) |
| `w`, `h` | float | Width and height of the span bounding box |
| `fontSize` | float | Font size in CSS pixels |
| `sizePt` | float | Font size in PDF points |
| `font` | string | Base font name from the PDF (e.g. `"TimesNewRomanPSMT"`) |
| `flags` | int | PyMuPDF font flags bitmask |
| `lineId` | string | Groups spans on the same horizontal text line (e.g. `"1_3"`) |
| `chars` | array | Per-character data: `c` (character), `x` (x offset within span), `w` (advance width) |

### Errors

| Status | Reason |
|--------|--------|
| `400` | No file uploaded or no file selected |
| `500` | Processing error (detail in response body) |

---

## `GET /embedded-text-viewer/api/extract-spans`

Utility endpoint to extract spans from the bundled default demonstration PDF.

### Response — `200 OK`

Returns the same schema as `POST /embedded-text-viewer/api/extract-spans`.

