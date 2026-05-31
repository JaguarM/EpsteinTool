import os
import json
from pathlib import Path
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .logic.ProcessRedactions import process_pdf, process_image
from .logic.refiners.base import DetectedBox
from .logic.refiners.pipeline import RefinerPipeline
from .logic.refiners.tesseract_refiner import TesseractRefiner

IMAGE_MIME_TYPES = {'image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/bmp', 'image/webp'}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'}

from guesser_core.registry import PDFToolRegistry

_ocr_pipeline = RefinerPipeline([TesseractRefiner()])


def index(request):
    tools = PDFToolRegistry.get_tools()
    context = {
        'tools': tools,
        'show_text_options_bar': any(t.shows_text_options_bar for t in tools.values()),
        'has_any_sidebar': any(t.sidebar for t in tools.values()),
    }
    return render(request, 'guesser_core/index.html', context)

@csrf_exempt
def analyze_pdf(request):
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if 'file' not in request.FILES:
        return JsonResponse({"detail": "No file uploaded"}, status=400)

    file = request.FILES['file']
    if file.name == '':
        return JsonResponse({"detail": "No file selected"}, status=400)

    try:
        file_bytes = file.read()
        mime = (file.content_type or '').lower()
        ext = os.path.splitext(file.name or '')[1].lower()
        is_image = mime in IMAGE_MIME_TYPES or ext in IMAGE_EXTENSIONS

        result = process_image(file_bytes, mime or 'image/png') if is_image else process_pdf(file_bytes)

        if "error" in result:
            return JsonResponse({"detail": result["error"]}, status=500)

        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)




# ---------------------------------------------------------------------------
# Default PDF auto-load
# ---------------------------------------------------------------------------
_DEFAULT_PDF = Path(__file__).resolve().parent.parent / 'assets' / 'pdfs' / 'times' / 'efta00018586.pdf'

def analyze_default(request):
    """GET endpoint that processes the bundled default PDF and returns the
    same JSON payload as /analyze-pdf, allowing the frontend to auto-load
    on startup without a user file-upload."""
    if request.method != 'GET':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not _DEFAULT_PDF.exists():
        return JsonResponse({"detail": f"Default PDF not found: {_DEFAULT_PDF}"}, status=404)

    try:
        file_bytes = _DEFAULT_PDF.read_bytes()
        result = process_pdf(file_bytes)

        if "error" in result:
            return JsonResponse({"detail": result["error"]}, status=500)

        result["default_filename"] = _DEFAULT_PDF.name
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
def analyze_refine_widths(request):
    """POST endpoint to refine redaction widths using OCR extra-letter detection."""
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        redactions = data.get("redactions", [])
        etv_words = data.get("etv_words", [])
        ocr_words = data.get("ocr_words", [])

        # Measure space width from character-position data when available
        space_px = 9.5
        spaces = []
        for w in etv_words:
            if "baseCharPositions" in w and w["baseCharPositions"]:
                spaces.extend(
                    cp.get("w", 0) for cp in w["baseCharPositions"] if cp.get("c") == " "
                )
        if spaces:
            space_px = sum(spaces) / len(spaces)

        evidence = {
            "etv_words": etv_words,
            "ocr_words": ocr_words,
            "space_px": space_px,
        }

        refined_redactions = []
        for r in redactions:
            detected = DetectedBox(
                page=r.get("page", 1),
                x=float(r.get("x", 0)),
                y=float(r.get("y", 0)),
                width=float(r.get("width", 0)),
                height=float(r.get("height", 0)),
            )
            refined = _ocr_pipeline.run(detected, {"tesseract": evidence})

            updated = dict(r)
            updated["x"] = refined.x
            updated["width"] = refined.width
            refined_redactions.append(updated)

        return JsonResponse({"redactions": refined_redactions})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"detail": str(e)}, status=500)
