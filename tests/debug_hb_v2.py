import uharfbuzz as hb
import os

font_paths = [
    "calibri.ttf",
    os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'calibri.ttf'),
]

font_path = None
for path in font_paths:
    if os.path.exists(path):
        font_path = path
        break

print(f"Using font: {font_path}")

if not font_path:
    print("No font found")
    exit(1)

with open(font_path, 'rb') as f:
    font_data = f.read()

face = hb.Face(font_data)
font = hb.Font(face)

def shape(text, features):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    # buf.set_script("Latn") # Should correspond to 'latn'
    # buf.set_language("en") 
    
    # Try explicitly setting direction and script just in case
    # buf.direction = 'ltr' 
    # But guess_segment_properties usually does this well.

    hb.shape(font, buf, features)
    return buf.glyph_infos, buf.glyph_positions

print("--- Ligatures ON (fi) ---")
infos, pos = shape("fi", {"liga": True, "clig": True})
for info in infos:
    print(f"Glyph: {info.codepoint}")

print("--- Ligatures OFF (fi) ---")
infos, pos = shape("fi", {"liga": False, "clig": False})
for info in infos:
    print(f"Glyph: {info.codepoint}")
    
print("--- Ligatures ON (ffi) ---")
infos, pos = shape("ffi", {"liga": True, "clig": True})
print(f"Count: {len(infos)}")

print("--- Ligatures OFF (ffi) ---")
infos, pos = shape("ffi", {"liga": False, "clig": False})
print(f"Count: {len(infos)}")
