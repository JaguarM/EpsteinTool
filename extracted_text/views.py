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
    try:
        font_name = str(data.get('font') or 'times.ttf')
        font_size = float(data.get('size') or 12)
        scale = float(data.get('scale') or 135)
        force_uppercase = bool(data.get('force_uppercase', False))
        kerning = bool(data.get('kerning', True))
        ligatures = bool(data.get('ligatures', True))
        use_calibration = bool(data.get('use_calibration', False))
        spans = data.get('spans', [])

        calibrations = None
        if use_calibration and spans:
            from .logic.calibrate import calibrate_document
            calibrations = calibrate_document(spans, font_name=font_name, scale=scale/100.0)

        widths = get_text_widths(texts, font_name, font_size, force_uppercase, scale / 100.0, kerning, ligatures)

        if calibrations and len(calibrations) > 0:
            cal = calibrations[0]
            widths = []
            for t in texts:
                cw = cal.predict_width(t.upper() if force_uppercase else t, font_size_pt=font_size, kerning=kerning, ligatures=ligatures)
                widths.append({"text": t, "width": cw})

        return JsonResponse({"results": widths})
    except Exception as e:
        import traceback
        with open('width_error.log', 'w') as f:
            f.write(traceback.format_exc())
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
        from .logic.extract import extract_pdf
        result = extract_pdf(pdf_bytes)
        return JsonResponse({"spans": result["spans"]})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
def calibrate_document_api(request):
    """Cluster spans into font groups, train per-char ratios, return all groups
    plus a span_group_indices array (parallel to input spans) for color-coding."""
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        spans = data.get('spans', [])
        font_name = data.get('font', 'times.ttf')
        scale = float(data.get('scale', 4.0 / 3.0))

        from .logic.calibrate import calibrate_document
        calibrations = calibrate_document(spans, font_name=font_name, scale=scale)

        if not calibrations:
            return JsonResponse({"detail": "No valid font groups found"}, status=400)

        # Map each input span to its group index via object identity
        span_to_group: dict[int, int] = {}
        for gi, cal in enumerate(calibrations):
            for sp in cal.group.spans:
                span_to_group[id(sp)] = gi
        span_group_indices = [span_to_group.get(id(sp), -1) for sp in spans]

        groups = []
        for cal in calibrations:
            r = cal.report()
            groups.append({
                "family":       cal.group.family,
                "weight":       cal.group.weight,
                "size_class":   cal.group.size_class,
                "span_count":   cal.group.count,
                "global_ratio": r["global_ratio"],
                "char_count":   r["char_count"],
                "char_ratios":  r["char_ratios"],
            })

        return JsonResponse({"groups": groups, "span_group_indices": span_group_indices})
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)


@csrf_exempt
def compare_geometry(request):
    """Predicts string bounding boxes and per-char geometry against HarfBuzz."""
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        spans = data.get('spans', [])
        font_name = data.get('font', 'times.ttf')
        scale = float(data.get('scale', 4.0/3.0))
        kerning = bool(data.get('kerning', True))
        ligatures = bool(data.get('ligatures', True))
        correction = float(data.get('correction', 1.0))
        use_calibration = bool(data.get('use_calibration', False))

        from .logic.calibrate import calibrate_document, GlyphCalibration, FontGroup

        calibrations = []
        if use_calibration:
            calibrations = calibrate_document(spans, font_name=font_name, scale=scale)

        raw_cal = GlyphCalibration(FontGroup("raw", "regular", 12.0, []), font_name=font_name, scale=scale)
        raw_cal.ratios = {}
        raw_cal.global_ratio = 1.0

        results = []
        for span in spans:
            text = span.get('text', '')
            actual_px = span.get('w', 0.0)
            span_font_size_pt = span.get("sizePt", span.get("fontSize", 12.0) / scale)

            raw_cal.ref_size_pt = span_font_size_pt
            hb_chars = raw_cal.predict_positions(text, font_size_pt=span_font_size_pt, kerning=kerning, ligatures=ligatures)

            width_px = 0.0
            if hb_chars:
                width_px = hb_chars[-1]['x'] + hb_chars[-1]['w']
                width_px *= correction
                for ch in hb_chars:
                    ch['x'] *= correction
                    ch['w'] *= correction

            calibrated_px = None
            if use_calibration and calibrations:
                cal_chars = calibrations[0].predict_positions(text, font_size_pt=span_font_size_pt, kerning=kerning, ligatures=ligatures)
                if cal_chars:
                    calibrated_px = (cal_chars[-1]['x'] + cal_chars[-1]['w']) * correction
                    for ch in cal_chars:
                        ch['x'] *= correction
                        ch['w'] *= correction
                    hb_chars = cal_chars

            comparison_px = calibrated_px if calibrated_px is not None else width_px
            error_px = comparison_px - actual_px
            error_pct = (error_px / actual_px * 100) if actual_px > 0 else 0

            results.append({
                "text": text,
                "actual_px": actual_px,
                "width_px": width_px,
                "calibrated_px": calibrated_px,
                "error_px": error_px,
                "error_pct": error_pct,
                "font": span.get('font', ''),
                "mapped_ttf": font_name,
                "page": span.get('page'),
                "x": span.get('x'),
                "y": span.get('y'),
                "chars": hb_chars,
            })

        return JsonResponse({"results": results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"detail": str(e)}, status=500)
