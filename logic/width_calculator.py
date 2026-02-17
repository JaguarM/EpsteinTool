import os
from PIL import ImageFont

def get_text_widths(texts, font_name="times.ttf", font_size=12, force_uppercase=False):
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
    
    font = None
    loaded_font_name = font_name
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, font_size)
                loaded_font_name = path
                break
            except Exception:
                continue
                
    if font is None:
        # Fallback to default if load fails
        try:
             font = ImageFont.load_default()
             loaded_font_name = "default"
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
                # getlength is more accurate for recent Pillow versions
                # Scale by 1.35 to match PDF redaction box dimensions (approx difference between 72 DPI and 96 DPI)
                width = round(font.getlength(measure_text) * 1.35, 3)
                pd = {"text": text, "width": width} # Return original text but uppercase width
            except Exception as e:
                pd = {"text": text, "width": 0, "error": str(e)}
        results.append(pd)
        
    return results

def get_available_fonts():
    # rudimentary list of common fonts or scan directory
    # For now, return a static list of likely available fonts
    return [
        "times.ttf",
        "arial.ttf",
        "calibri.ttf",
        "cour.ttf",
        "verdana.ttf"
    ]
