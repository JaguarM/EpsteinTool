import json
from pathlib import Path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .logic.width_calculator import get_text_widths, get_available_fonts, get_justified_space_width


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
        space_width = data.get('space_width')
        if space_width is not None:
            space_width = float(space_width)

        calibrations = None
        if use_calibration and spans:
            from .logic.calibrate import calibrate_document
            calibrations = calibrate_document(spans, font_name=font_name, scale=scale/100.0)

        widths = get_text_widths(texts, font_name, font_size, force_uppercase, scale / 100.0, kerning, ligatures, space_width=space_width)

        if calibrations and len(calibrations) > 0:
            cal = calibrations[0]
            widths = []
            for t in texts:
                cw = cal.predict_width(t.upper() if force_uppercase else t, font_size_pt=font_size, kerning=kerning, ligatures=ligatures, line_space_px=space_width)
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
    """Predicts string widths using the text_tool (HarfBuzz/uharfbuzz) path and compares against PDF ground truth."""
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
        justify = bool(data.get('justify', False))
        space_width = data.get('space_width')
        if space_width is not None:
            space_width = float(space_width)
        force_uppercase = bool(data.get('force_uppercase', False))

        results = []
        for span in spans:
            text = span.get('text', '')
            actual_px = span.get('w', 0.0)
            sz_pt = span.get("sizePt", span.get("fontSize", 12.0 * scale) / scale)

            # When justify is enabled and the span has a container width (blockW),
            # compute the per-space width that makes the total match blockW.
            span_space_width = space_width
            justified_space_w = None
            if justify:
                block_w = actual_px
                if block_w and block_w > 0:
                    jsw = get_justified_space_width(
                        text, block_w, font_name, sz_pt,
                        force_uppercase, scale * correction,
                        kerning, ligatures,
                    )
                    if jsw is not None:
                        span_space_width = jsw
                        justified_space_w = jsw

            widths = get_text_widths(
                [text], font_name, sz_pt, force_uppercase,
                scale * correction, kerning, ligatures, space_width=span_space_width,
            )
            width_result = widths[0] if widths else {}
            comparison_px = width_result.get('width', 0.0)
            char_positions = width_result.get('chars', [])
            error_px = comparison_px - actual_px
            error_pct = (error_px / actual_px * 100) if actual_px > 0 else 0

            res = dict(span)
            res.update({
                "text": text,
                "actual_px": actual_px,
                "width_px": comparison_px,
                "calibrated_px": comparison_px,
                "error_px": error_px,
                "error_pct": error_pct,
                "font": span.get('font', ''),
                "mapped_ttf": font_name,
                "page": span.get('page', 0),
                "x": span.get('x', 0),
                "y": span.get('y', 0),
                "w": span.get('w', 0),
                "h": span.get('h', 0),
                "fontSize": span.get('fontSize'),
                "chars": char_positions,
            })
            if justified_space_w is not None:
                res["justified_space_w"] = round(justified_space_w, 4)
            results.append(res)

        return JsonResponse({"results": results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"detail": str(e)}, status=500)
