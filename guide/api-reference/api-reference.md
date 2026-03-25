# API Reference

The Django backend exposes 5 HTTP endpoints. All are served from the root URL path via the `guesser` app.

> **Note:** All POST endpoints use `@csrf_exempt` — no CSRF token is required. There is no authentication.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serves the single-page application |
| `POST` | `/analyze-pdf` | Upload a PDF or image for redaction analysis |
| `POST` | `/widths` | Calculate pixel widths for candidate text strings |
| `GET` | `/fonts-list` | List available font files |
| `GET` | `/mask/<page_num>` | Get a redaction mask PNG for a specific page |

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
  "suggested_scale": 178,
  "page_images": ["base64-encoded-PNG-string", null, "..."],
  "page_image_type": "image/png",
  "page_width": 816,
  "page_height": 1056,
  "num_pages": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `redactions` | array | Detected redaction boxes sorted by page, then y, then x |
| `spans` | array | Text spans with font metadata (PDF only, empty for images) |
| `suggested_scale` | int | Auto-calculated scale percentage for the width calculator |
| `page_images` | array | Base64-encoded page images (one per page, `null` if missing) |
| `page_image_type` | string | MIME type of the page images |
| `page_width` / `page_height` | int | Pixel dimensions of page images |
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
  "scale": 178,
  "kerning": true,
  "ligatures": true,
  "force_uppercase": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strings` | array | `[]` | Text strings to measure |
| `font` | string | `"times.ttf"` | Font filename from `assets/fonts/` |
| `size` | number | `12` | Font size in points |
| `scale` | number | `135` | Scale percentage (divided by 100 internally) |
| `kerning` | bool | `true` | Enable OpenType `kern` feature |
| `ligatures` | bool | `true` | Enable `liga`/`clig` features |
| `force_uppercase` | bool | `false` | Measure uppercase version of each string |

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
["times.ttf", "arial.ttf", "cour.ttf"]
```

---

## `GET /mask/<page_num>`

Generate and return a grayscale PNG mask for redacted regions on the given page.

### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page_num` | int (URL path) | 1-based page number |

### Prerequisites

A PDF must have been uploaded via `/analyze-pdf` first. The PDF bytes are held in server memory.

### Response — `200 OK`

- **Content-Type:** `image/png`
- **Body:** Raw PNG bytes (grayscale, `0` = unredacted, `255` = redacted)

### Errors

| Status | Reason |
|--------|--------|
| `400` | No PDF has been uploaded yet |
| `404` | No redactions detected on this page |
