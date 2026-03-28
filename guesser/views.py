import os
from pathlib import Path
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

from .logic.ProcessRedactions import process_pdf, process_image
from .logic.width_calculator import get_text_widths, get_available_fonts
from .logic.extract_fonts import detect_dominant_font

IMAGE_MIME_TYPES = {'image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/bmp', 'image/webp'}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'}

def index(request):
    return render(request, 'guesser/index.html')

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

        if not is_image:
            font_info = detect_dominant_font(
                result.get("spans", []),
                get_available_fonts(),
                pdf_declared_fonts=result.get("pdf_fonts", []),
            )
            result["suggested_font"] = font_info["font_file"]
            # Only use detect_dominant_font's size as fallback when process_pdf
            # could not determine a body-text size.
            if not result.get("suggested_size"):
                result["suggested_size"] = font_info["font_size"]

        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)

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
        # Convert scale percentage to multiplier (135 -> 1.35)
        scale_factor = scale / 100.0
        widths = get_text_widths(texts, font_name, font_size, force_uppercase, scale_factor, kerning, ligatures)
        return JsonResponse({"results": widths})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)



def list_fonts(request):
    return JsonResponse(get_available_fonts(), safe=False)


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

        font_info = detect_dominant_font(
            result.get("spans", []),
            get_available_fonts(),
            pdf_declared_fonts=result.get("pdf_fonts", []),
        )
        result["suggested_font"] = font_info["font_file"]
        if not result.get("suggested_size"):
            result["suggested_size"] = font_info["font_size"]

        result["default_filename"] = _DEFAULT_PDF.name
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)
