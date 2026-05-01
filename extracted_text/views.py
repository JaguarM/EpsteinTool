import json
from pathlib import Path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .logic.width_calculator import get_text_widths, get_available_fonts


@csrf_exempt
def calculate_widths(request):
    """Deprecated: /widths is now served by text_tool. This view is kept as a fallback."""
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    texts = data.get('strings', [])
    try:
        font_name = str(data.get('font') or 'times.ttf')
        font_size = float(data.get('size') or 12)
        scale = float(data.get('scale') or 135)
        force_uppercase = bool(data.get('force_uppercase', False))
        kerning = bool(data.get('kerning', True))
        ligatures = bool(data.get('ligatures', True))
        space_width = data.get('space_width')
        if space_width is not None:
            space_width = float(space_width)

        widths = get_text_widths(texts, font_name, font_size, force_uppercase,
                                  scale / 100.0, kerning, ligatures, space_width=space_width)
        return JsonResponse({"results": widths})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


def list_fonts(_request):
    """Deprecated: /fonts-list is now served by text_tool."""
    return JsonResponse(get_available_fonts(), safe=False)


_DEFAULT_PDF = Path(__file__).resolve().parent.parent / 'assets' / 'pdfs' / 'times' / 'efta00018586.pdf'


@csrf_exempt
def extract_spans(request):
    """
    Extracts every embedded text span from a PDF and returns their coordinates
    in the 816×1056 viewer pixel space.

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
        from .logic.extract import extract_pdf
        result = extract_pdf(pdf_bytes)
        return JsonResponse({"spans": result["spans"]})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)
