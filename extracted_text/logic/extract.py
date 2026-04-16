"""
extract.py — PDF image and text extraction

Given PDF bytes, extracts:
  - Page images  (cropped to 8.5×11, base64 PNG)
  - Text spans   (pixel coordinates in the image space)

Entry point:
    extract_pdf(pdf_bytes) -> dict

Returned dict:
    {
        "numPages":   int,
        "pageWidth":  816,
        "pageHeight": 1056,
        "pageImages": ["base64-png", ...],   # one per page, None if missing
        "spans":      [ <span>, ... ]
    }

Each span:
    {
        "page":     int,    # 1-based
        "text":     str,
        "x":        float,  # left edge in image pixels
        "y":        float,  # top  edge in image pixels
        "w":        float,  # width  in image pixels
        "h":        float,  # height in image pixels
        "fontSize": float,  # font size in image pixels
        "sizePt":   float,  # font size in PDF points
        "font":     str,    # raw PDF font name
        "flags":    int,    # PyMuPDF flag bits (bold=16, italic=2, ...)
        "lineId":   str,    # "page_lineNum" — spans on the same line share this
        "chars":    [{"c": str, "x": float, "w": float}, ...]  # per-char offsets
    }
"""

import fitz
import base64
from io import BytesIO
from PIL import Image

# Standard letter-size page dimensions at the viewer's internal resolution
PAGE_W = 816
PAGE_H = 1056


def extract_pdf(pdf_bytes: bytes) -> dict:
    """Extract page images and text spans from PDF bytes."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    num_pages = doc.page_count
    page_images = []
    all_spans = []

    for page_index in range(num_pages):
        page = doc.load_page(page_index)
        page_num = page_index + 1

        img_result = _get_page_image(doc, page_index)
        if img_result is None:
            page_images.append(None)
            continue

        img_bytes, img_w, img_h, img_rect = img_result
        page_images.append(base64.b64encode(img_bytes).decode())
        all_spans.extend(_extract_spans(page, page_num, img_w, img_h, img_rect))

    doc.close()
    return {
        "numPages":   num_pages,
        "pageWidth":  PAGE_W,
        "pageHeight": PAGE_H,
        "pageImages": page_images,
        "spans":      all_spans,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_page_image(doc: fitz.Document, page_index: int):
    """
    Extract the largest embedded raster image from a PDF page (by placement
    area), crop it to a standard 8.5×11 aspect ratio, and return
    (png_bytes, img_w, img_h, img_rect).

    img_h is the *original* (pre-crop) image height in pixels; this is used
    by _extract_spans to derive an independent scale_y that matches the PDF
    coordinate space, rather than assuming the image is perfectly square.

    Returns None if no suitable image is found.
    """
    image_list = doc.get_page_images(page_index)
    if not image_list:
        return None

    page = doc.load_page(page_index)

    # Select the image with the largest placement area on the page.
    best_xref = None
    best_rect = None
    best_area = -1.0
    for img_info in image_list:
        xref = img_info[0]
        rects = page.get_image_rects(xref)
        if not rects:
            continue
        area = rects[0].width * rects[0].height
        if area > best_area:
            best_area = area
            best_xref = xref
            best_rect = rects[0]

    if best_xref is None:
        return None

    base_image = doc.extract_image(best_xref)
    if not base_image:
        return None

    # Accept both lossless and JPEG — PIL handles all correctly
    if base_image.get("ext", "").lower() not in ("png", "tiff", "tif", "jpeg", "jpg"):
        return None

    img_bytes = base_image["image"]
    img_w = base_image["width"]
    img_h = base_image["height"]   # original height before any crop

    # Crop to standard 8.5 × 11 letter-size ratio
    with Image.open(BytesIO(img_bytes)) as pil:
        if pil.mode not in ("RGB", "RGBA", "L"):
            pil = pil.convert("RGB")
        w, h = pil.size
        target_h = int(round(w * (PAGE_H / PAGE_W)))
        if h > target_h:
            pil = pil.crop((0, 0, w, target_h))
        buf = BytesIO()
        pil.save(buf, format="PNG")
        img_bytes = buf.getvalue()

    return img_bytes, img_w, img_h, best_rect


def _extract_spans(page: fitz.Page, page_num: int,
                   img_w: int, img_h: int, img_rect: fitz.Rect) -> list:
    """
    Extract all text spans from a PDF page and convert their coordinates from
    PDF points to image pixels (the same space as the page image).

    Scale logic:
      - scale_x = original_image_width  / img_rect.width
      - scale_y = original_image_height / img_rect.height

    Using the actual image dimensions in both axes avoids the drift that arises
    when the PDF page height differs from the standard 792 pt (e.g. 810 pt
    scans).  The two scales are typically equal for standard-letter PDFs but
    can diverge for non-standard page sizes or images with slightly different
    aspect ratios.
    """
    scale_x = img_w / img_rect.width  if img_rect.width  else 1.0
    scale_y = img_h / img_rect.height if img_rect.height else scale_x
    max_y = int(round(img_w * (PAGE_H / PAGE_W)))  # bottom of the cropped image

    rawdict = page.get_text("rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    spans = []

    for block in rawdict.get("blocks", []):
        if block.get("type") != 0:   # 0 = text block
            continue
        for line in block.get("lines", []):
            # Merge adjacent spans on the same line that share font/size/flags/color.
            # PDFs often split a single visual run into many tiny spans; merging them
            # gives calibration more characters per training sample and avoids
            # spurious per-span coordinate noise.
            merged_spans = []
            for span in line.get("spans", []):
                if not merged_spans:
                    merged_spans.append(span.copy())
                    continue
                last = merged_spans[-1]

                if (span.get("font") == last.get("font") and
                    abs(span.get("size", 12) - last.get("size", 12)) <= 1.0 and
                    span.get("flags") == last.get("flags") and
                    span.get("color") == last.get("color")):

                    b1 = last.get("bbox")
                    b2 = span.get("bbox")
                    if b1 and b2:
                        last["bbox"] = (
                            min(b1[0], b2[0]), min(b1[1], b2[1]),
                            max(b1[2], b2[2]), max(b1[3], b2[3]),
                        )
                    last["chars"] = last.get("chars", []) + span.get("chars", [])
                else:
                    merged_spans.append(span.copy())

            for span in merged_spans:
                bbox = span.get("bbox")
                if not bbox:
                    continue

                # Convert PDF-point bbox to image-pixel coordinates
                x0 = (bbox[0] - img_rect.x0) * scale_x
                y0 = (bbox[1] - img_rect.y0) * scale_y
                x1 = (bbox[2] - img_rect.x0) * scale_x
                y1 = (bbox[3] - img_rect.y0) * scale_y

                # Skip spans below the crop boundary; clamp the bottom edge
                if y0 >= max_y:
                    continue
                y1 = min(y1, max_y)

                # Map Helvetica → Calibri for consistent browser rendering
                font = span.get("font", "unknown")
                if "helvetica" in font.lower():
                    font = "Calibri"

                # Per-character x-offsets and advance widths relative to span
                raw_chars = span.get("chars", [])
                chars = []
                built_text_chars = []
                em_px = span.get("size", 12.0) * scale_x

                for ci, ch in enumerate(raw_chars):
                    if not (ch.get("bbox") and ch.get("c")):
                        continue
                    rel_x = (ch["bbox"][0] - img_rect.x0) * scale_x - x0
                    # Advance = distance to next char's x; last char → span right edge
                    if ci < len(raw_chars) - 1 and raw_chars[ci + 1].get("bbox"):
                        adv = (raw_chars[ci + 1]["bbox"][0] - ch["bbox"][0]) * scale_x
                    else:
                        adv = x1 - ((ch["bbox"][0] - img_rect.x0) * scale_x)

                    c_char = ch["c"]
                    # Classify unusually wide spaces as tabs (advance > 0.8 em)
                    if c_char == " " and adv > (em_px * 0.8):
                        c_char = "\t"

                    built_text_chars.append(c_char)
                    chars.append({
                        "c": c_char,
                        "x": round(rel_x, 2),
                        "w": round(adv, 2),
                    })

                text = "".join(built_text_chars)
                if not text.strip():
                    continue

                size_pt = span.get("size", 12.0)

                entry = {
                    "page":     page_num,
                    "text":     text,
                    "x":        round(x0, 2),
                    "y":        round(y0, 2),
                    "w":        round(x1 - x0, 2),
                    "h":        round(y1 - y0, 2),
                    "fontSize": round(size_pt * scale_y, 2),
                    "sizePt":   round(size_pt, 4),
                    "font":     font,
                    "flags":    span.get("flags", 0),
                    "lineId":   None,  # assigned below
                }
                if chars:
                    entry["chars"] = chars
                spans.append(entry)

    # Group spans into lines by vertical proximity (3 px tolerance)
    if spans:
        spans.sort(key=lambda s: s["y"])
        line_num = 1
        last_y = spans[0]["y"]
        for s in spans:
            if abs(s["y"] - last_y) > 3.0:
                line_num += 1
                last_y = s["y"]
            s["lineId"] = f"{page_num}_{line_num}"

    return spans
