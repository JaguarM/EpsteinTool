import os
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json

from .logic.ProcessRedactions import process_pdf, process_image
from .logic.width_calculator import get_text_widths, get_available_fonts

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
