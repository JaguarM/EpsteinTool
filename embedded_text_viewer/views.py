import json
from pathlib import Path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

BASE_DIR = Path(__file__).resolve().parent.parent


@csrf_exempt
def charpos(request):
    """
    Compute per-character pixel positions for ETV overlay rendering.

    Mirrors main.py /charpos: accepts spans + font settings, returns
    Aspose-shaped char positions in viewer-pixel space (816px canvas).
    """
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    spans       = data.get('spans', [])
    font_name   = data.get('font', 'times.ttf')
    scale       = float(data.get('scale', 4.0 / 3.0))
    kerning     = bool(data.get('kerning', True))
    ligatures   = bool(data.get('ligatures', True))
    correction  = float(data.get('correction', 1.0))
    justify     = bool(data.get('justify', False))

    font_path = BASE_DIR / "assets" / "fonts" / font_name

    try:
        from aspose.logic.shaper import HarfBuzzShaper
        from aspose.logic.layout_calculator import LayoutCalculator

        shaper = HarfBuzzShaper(str(font_path))
        upem = shaper.get_upem()
        space_glyphs = shaper.shape_text(" ")
        space_id = space_glyphs[0]['glyph_id'] if space_glyphs else 3
    except Exception as e:
        return JsonResponse({"detail": f"Font load error: {e}"}, status=500)

    results = []
    for span in spans:
        text    = span.get("text", "")
        sz_pt   = span.get("sizePt", span.get("fontSize", 12.0 * scale) / scale)
        actual_px = span.get("w", 0.0)

        try:
            shaped = shaper.shape_text(text, kerning=kerning, ligatures=ligatures)
            lc = LayoutCalculator(sz_pt, upem)

            if justify and span.get("blockW") and not span.get("isBlockEnd", False):
                actual_px = span["blockW"]

            extra_per_gap = 0
            rem = 0
            if justify and actual_px > 0:
                container_twips = lc.points_to_twips(actual_px / (scale * correction))
                justify_info = lc.calculate_justified_spaces(shaped, container_twips, space_id)
                extra_per_gap = justify_info.get("extra_space_per_gap_twips", 0)
                rem = justify_info.get("remainder", 0)

            chars = []
            cum_twips = 0
            for g in shaped:
                char_str = text[g['cluster']] if g['cluster'] < len(text) else ""

                if char_str == '\t':
                    ch_twips = lc.calculate_tab_width_twips(cum_twips)
                else:
                    ch_twips = lc.points_to_twips(lc.advance_to_points(g['x_advance']))

                if justify and g['glyph_id'] == space_id:
                    ch_twips += extra_per_gap
                    if rem > 0:
                        ch_twips += 1
                        rem -= 1

                x_px = (cum_twips / 20.0) * scale * correction
                w_px = (ch_twips  / 20.0) * scale * correction

                chars.append({"c": char_str, "x": round(x_px, 2), "w": round(w_px, 2)})
                cum_twips += ch_twips

            results.append({
                "text":     text,
                "font":     font_name,
                "fontSize": span.get("fontSize"),
                "chars":    chars,
                "actual_px": actual_px,
                "page": span.get("page", 0),
                "x":    span.get("x", 0),
                "y":    span.get("y", 0),
                "w":    span.get("w", 0),
                "h":    span.get("h", 0),
            })
        except Exception as e:
            results.append({
                "text":     text,
                "chars":    [],
                "actual_px": actual_px,
                "page": span.get("page", 0),
                "x":    span.get("x", 0),
                "y":    span.get("y", 0),
            })

    return JsonResponse({"results": results})
