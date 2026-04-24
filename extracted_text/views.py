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
    """Predicts string bounding boxes and per-char geometry against Aspose Engine."""
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

        # We will point to EpsteinTool/assets/fonts for robust referencing
        from django.conf import settings
        from pathlib import Path
        BASE_DIR = Path(__file__).resolve().parent.parent
        font_path = BASE_DIR / "assets" / "fonts" / font_name
        
        from aspose.logic.shaper import HarfBuzzShaper
        from aspose.logic.layout_calculator import LayoutCalculator

        results = []
        for span in spans:
            text = span.get('text', '')
            actual_px = span.get('w', 0.0)
            sz_pt = span.get("sizePt", span.get("fontSize", 12.0 * scale) / scale)
            
            # Use Aspose layout calculation
            aspose_px = None
            aspose_chars = []
            try:
                shaper = HarfBuzzShaper(str(font_path))
                upem = shaper.get_upem()
                shaped = shaper.shape_text(text, kerning=kerning, ligatures=ligatures)
                lc = LayoutCalculator(sz_pt, upem)

                space_glyphs = shaper.shape_text(" ")
                space_id = space_glyphs[0]['glyph_id'] if space_glyphs else 3

                extra_per_gap = 0
                rem = 0

                # Default to PyMuPDF's individual span ink bounds if justify is not triggered
                if justify and span.get("blockW") and not span.get("isBlockEnd", False):
                    actual_px = span["blockW"]

                if justify and actual_px > 0:
                    container_twips = lc.points_to_twips(actual_px / (scale * correction))
                    justify_info = lc.calculate_justified_spaces(shaped, container_twips, space_id)
                    extra_per_gap = justify_info.get("extra_space_per_gap_twips", 0)
                    rem = justify_info.get("remainder", 0)

                cum_twips = 0

                for g in shaped:
                    char_str = text[g['cluster']] if g['cluster'] < len(text) else ""
                    
                    if char_str == '\t':
                        ch_twips = lc.calculate_tab_width_twips(cum_twips)
                    else:
                        advance = g['x_advance']
                        ch_twips = lc.points_to_twips(lc.advance_to_points(advance))
                    
                    if justify and g['glyph_id'] == space_id:
                        ch_twips += extra_per_gap
                        if rem > 0:
                            ch_twips += 1
                            rem -= 1
                            
                    x_px = (cum_twips / 20.0) * scale * correction
                    w_px = (ch_twips / 20.0) * scale * correction
                    
                    aspose_chars.append({
                        "c": char_str,
                        "x": round(x_px, 2),
                        "w": round(w_px, 2)
                    })
                    cum_twips += ch_twips

                aspose_px = (cum_twips / 20.0) * scale * correction

            except Exception as e:
                print(f"Aspose error on span '{text}': {e}")
                aspose_px = 0.0

            comparison_px = aspose_px if aspose_px is not None else 0.0
            error_px = comparison_px - actual_px
            error_pct = (error_px / actual_px * 100) if actual_px > 0 else 0

            res = dict(span)
            res.update({
                "text": text,
                "actual_px": actual_px,
                "width_px": comparison_px,  # Unified with Aspose tracking
                "calibrated_px": aspose_px,
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
                "chars": aspose_chars,      # Replaces older calibrated chars
            })
            results.append(res)

        return JsonResponse({"results": results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"detail": str(e)}, status=500)
