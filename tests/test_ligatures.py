from PIL import ImageFont
import os

try:
    font_path = "times.ttf"
    if not os.path.exists(font_path):
        # Fallback for Windows
        font_path = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'times.ttf')
        
    font = ImageFont.truetype(font_path, 72)
    
    # Measure 'fi' with default (usually ligatures on if supported)
    default_w = font.getlength("fi")
    
    # Measure 'fi' with ligatures explicitly OFF
    # Note: feature tags must be bytes or string depending on Pillow version/bindings, usually string.
    # standard tags are 'liga', 'clig', 'dlig', 'hlig', 'calt' etc.
    # To disable, use '-tag' syntax if supported by set_variation_axis? No, features argument.
    
    # Pillow 10+ supports features argument in getlength.
    # features can be a list of strings "liga=0" or "-liga".
    
    # Let's try to disable standard ligatures
    try:
        no_liga_w = font.getlength("fi", features=["-liga", "-clig", "-dlig"])
        print(f"Default Width: {default_w}")
        print(f"No Ligatures Width: {no_liga_w}")
        
        if default_w != no_liga_w:
            print("SUCCESS: Ligatures are working and affect width.")
        else:
            print("FAILURE: Widths are identical. Ligatures might not be supported by this font/engine.")

    except TypeError as e:
        print(f"ERROR: getlength does not support 'features' argument: {e}")
except Exception as e:
    print(f"ERROR: {e}")
