import uharfbuzz as hb
import os

font_paths = [
    "times.ttf",
    os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'times.ttf'),
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
    hb.shape(font, buf, features)
    return buf.glyph_infos, buf.glyph_positions

print("--- Ligatures ON ---")
infos, pos = shape("fi", {"liga": True, "clig": True})
for info in infos:
    print(f"Glyph: {info.codepoint}")

print("--- Ligatures OFF ---")
infos, pos = shape("fi", {"liga": False, "clig": False})
for info in infos:
    print(f"Glyph: {info.codepoint}")
