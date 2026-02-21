import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'guesser'))
from logic.width_calculator import get_text_widths

print("Lowercase cour.ttf:")
print(get_text_widths(["hello", "world"], font_name="cour.ttf", force_uppercase=False, kerning=True))

print("Uppercase cour.ttf:")
print(get_text_widths(["hello", "world"], font_name="cour.ttf", force_uppercase=True, kerning=True))

print("No kerning cour.ttf:")
print(get_text_widths(["hello", "world"], font_name="cour.ttf", force_uppercase=False, kerning=False))
