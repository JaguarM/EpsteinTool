import fitz
import json
from pathlib import Path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .logic.width_calculator import get_text_widths, get_available_fonts


@csrf_exempt
def calculate_widths(request):
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)
    texts = data.get('strings', [])
    font_name = data.get('font', 'times.ttf')
    font_size = data.get('size', 12)
    force_uppercase = data.get('force_uppercase', False)
    scale = data.get('scale', 135)
    kerning = data.get('kerning', True)
    ligatures = data.get('ligatures', True)
    try:
        widths = get_text_widths(texts, font_name, font_size, force_uppercase, scale / 100.0, kerning, ligatures)
        return JsonResponse({"results": widths})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


def list_fonts(_request):
    return JsonResponse(get_available_fonts(), safe=False)


_DEFAULT_PDF = Path(__file__).resolve().parent.parent / 'assets' / 'pdfs' / 'times' / 'efta00018586.pdf'


@csrf_exempt
def extract_spans(request):
    """
    Extracts every embedded text span from a PDF and returns their coordinates
    translated into the 816x1056 cropped-image pixel space used by the main viewer.

    POST: receives a PDF file upload in request.FILES['file']
    GET:  processes the bundled default PDF (for auto-load)
    """
    if request.method == "GET":
        if not _DEFAULT_PDF.exists():
            return JsonResponse({"detail": "Default PDF not found"}, status=404)
        pdf_bytes = _DEFAULT_PDF.read_bytes()
    elif request.method == "POST":
        if "file" not in request.FILES:
            return JsonResponse({"detail": "No file uploaded"}, status=400)
        pdf_bytes = request.FILES["file"].read()
    else:
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        return JsonResponse({"spans": _extract_pixel_spans(pdf_bytes)})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


def _extract_pixel_spans(pdf_bytes: bytes) -> list[dict]:
    """
    Core logic: parse PDF, find the primary image on each page, and convert
    every text span's bbox from PDF points to cropped-image pixel coordinates.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    all_spans = []

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)

        # --- Determine the scale from PDF points -> image pixels -----------
        image_list = doc.get_page_images(page_index)
        if not image_list:
            continue

        # Use the first (primary) image on the page, same as guesser_core
        xref = image_list[0][0]
        base_image = doc.extract_image(xref)
        if not base_image:
            continue

        img_w = base_image["width"]

        image_rects = page.get_image_rects(xref)
        if not image_rects:
            continue
        img_rect = image_rects[0]

        # Scale factor: image pixels per PDF point.
        # Use the X-axis ratio for BOTH axes — the image has uniform DPI (96 px/pt × 72/96),
        # but some PDFs have an unusual page height (e.g. 810 pts instead of 792 pts for
        # letter size), which makes img_rect.height wrong for vertical scaling.
        # Using scale_x for scale_y avoids the resulting ~1.023× vertical stretch.
        scale_x = img_w / img_rect.width if img_rect.width else 1.0
        scale_y = scale_x * (2045 / 2044)

        # Cropped height: same 816x1056 crop the core viewer applies
        expected_h = int(round(img_w * (1056.0 / 816.0)))

        # --- Extract text spans using rawdict for character-level data ----
        rawdict = page.get_text(
            "rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE
        )

        page_raw_spans = []
        for block in rawdict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    if not text:
                        chars = span.get("chars", [])
                        if chars:
                            text = "".join(ch.get("c", "") for ch in chars)
                    if not text.strip():
                        continue

                    font_name = span.get("font", "unknown")
                    font_size_pt = float(span.get("size", 12.0))
                    bbox_raw = span.get("bbox")

                    if not bbox_raw:
                        continue

                    # Translate PDF-point bbox to image-pixel coordinates
                    px_x0 = (bbox_raw[0] - img_rect.x0) * scale_x
                    px_y0 = (bbox_raw[1] - img_rect.y0) * scale_y
                    px_x1 = (bbox_raw[2] - img_rect.x0) * scale_x
                    px_y1 = (bbox_raw[3] - img_rect.y0) * scale_y

                    # Skip spans that fall entirely below the crop line
                    if px_y0 >= expected_h:
                        continue

                    # Clamp bottom edge to the crop boundary
                    if px_y1 > expected_h:
                        px_y1 = expected_h

                    # Font size in image-pixel units
                    px_font_size = font_size_pt * scale_y

                    page_raw_spans.append(
                        {
                            "page": page_index + 1,
                            "lineId": None, # Will be assigned below
                            "text": text,
                            "x": round(px_x0, 2),
                            "y": round(px_y0, 2),
                            "w": round(px_x1 - px_x0, 2),
                            "h": round(px_y1 - px_y0, 2),
                            "fontSize": round(px_font_size, 2),
                            "font": font_name,
                        }
                    )

        # --- Group Spans into Shared lineIds by Vertical Proximity (3px tolerance) ---
        if page_raw_spans:
            # Sort by top coordinate (y) to facilitate single-pass clustering
            page_raw_spans.sort(key=lambda s: s["y"])
            
            line_counter = 1
            last_y = page_raw_spans[0]["y"]
            
            for s in page_raw_spans:
                # If current span is far from the previous baseline, start a new line
                if abs(s["y"] - last_y) > 3.0:
                    line_counter += 1
                    last_y = s["y"]
                
                s["lineId"] = f"{page_index+1}_{line_counter}"

            all_spans.extend(page_raw_spans)

    doc.close()
    return all_spans
