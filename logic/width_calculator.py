try:
    import uharfbuzz as hb
except ImportError:
    hb = None
import os

def get_text_widths(texts, font_name="times.ttf", font_size=12, force_uppercase=False, scale_factor=1.35, kerning=True, ligatures=True):
    """
    Calculates pixel widths for a list of text strings data.
    """
    results = []
    
    # Try to locate the font
    # Common system font paths or local file
    font_paths = [
        font_name,
        os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', font_name),
        os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', font_name + '.ttf'),
        os.path.join('/usr/share/fonts/truetype/msttcorefonts/', font_name),
        os.path.join('/usr/share/fonts/truetype/msttcorefonts/', font_name + '.ttf'),
        "times.ttf" # Fallback to local
    ]
    
    font_path = None
    for path in font_paths:
        if os.path.exists(path):
            font_path = path
            break
            
    # HarfBuzz Implementation
    if hb and font_path:
        try:
            with open(font_path, 'rb') as f:
                font_data = f.read()
            face = hb.Face(font_data)
            font = hb.Font(face)
            upem = face.upem
            
            # Create features list
            features = {}
            if not ligatures:
                features["liga"] = False
                features["clig"] = False
                features["dlig"] = False
            else:
                 features["liga"] = True
                 features["clig"] = True
            
            if not kerning:
                features["kern"] = False
            
            for text in texts:
                if not text:
                    results.append({"text": text, "width": 0})
                    continue
                    
                measure_text = text.upper() if force_uppercase else text
                
                buf = hb.Buffer()
                buf.add_str(measure_text)
                buf.guess_segment_properties()
                
                hb.shape(font, buf, features)
                
                total_advance = sum(info.x_advance for info in buf.glyph_positions)
                
                # Convert font units to pixels
                # (units / upem) * font_size
                pixel_width = (total_advance / upem) * font_size * scale_factor
                
                results.append({"text": text, "width": round(pixel_width, 3)})
            return results
            
        except Exception as e:
            # Fallback to Pillow if HarfBuzz fails
            print(f"HarfBuzz failed: {e}, falling back to Pillow")
            pass

    # Fallback / Pillow Implementation (No Ligature/Kerning control usually)
    font = None
    if font_path:
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            pass
            
    if font is None:
        try:
             font = ImageFont.load_default()
        except:
             pass

    if font is None:
         return [{"text": t, "width": 0, "error": "Could not load font"} for t in texts]

    for text in texts:
        if not text:
            pd = {"text": text, "width": 0}
        else:
            try:
                measure_text = text.upper() if force_uppercase else text
                # Scale by 1.35 to match PDF redaction box dimensions
                width = round(font.getlength(measure_text) * scale_factor, 3)
                pd = {"text": text, "width": width}
            except Exception as e:
                pd = {"text": text, "width": 0, "error": str(e)}
        results.append(pd)
        
    return results


def get_available_fonts():
    # rudimentary list of common fonts or scan directory
    # For now, return a static list of likely available fonts
    return [
        "times.ttf",
        "cour.ttf",
        "arial.ttf",
        "calibri.ttf",
        "segoeui.ttf"
    ]
