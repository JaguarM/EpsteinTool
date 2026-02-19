from logic.width_calculator import get_text_widths
import sys
import os

print(f"Current CWD: {os.getcwd()}")

def test_ligatures(font_name, font_file):
    print(f"\n--- Testing Ligatures with '{font_name}' ({font_file}) ---")
    try:
        # Measure 'fi' with ligatures ON (default)
        res_on = get_text_widths(["fi"], font_name=font_file, font_size=72, ligatures=True)
        # Measure 'fi' with ligatures OFF
        res_off = get_text_widths(["fi"], font_name=font_file, font_size=72, ligatures=False)
        
        # Check if we got valid results
        if not res_on or not res_off or 'width' not in res_on[0]:
            print(f"Error measuring widths: {res_on}")
            return

        w_on = res_on[0]['width']
        w_off = res_off[0]['width']
        
        print(f"Width ON : {w_on}")
        print(f"Width OFF: {w_off}")
        
        if w_on != w_off:
            print(f"PASS: Ligatures Verified for {font_name} (Width changed by {abs(w_on - w_off):.3f}px).")
        else:
            print(f"INFO: Ligatures had no effect for {font_name}. This is likely due to the font not supporting 'liga' feature for 'fi'.")
            
    except Exception as e:
        print(f"ERROR: {e}")

def test_kerning(font_name, font_file):
    print(f"\n--- Testing Kerning with '{font_name}' ({font_file}) ---")
    try:
        # Measure 'AV'
        res_on = get_text_widths(["AV"], font_name=font_file, font_size=72, kerning=True)
        res_off = get_text_widths(["AV"], font_name=font_file, font_size=72, kerning=False)
        
        w_on = res_on[0]['width']
        w_off = res_off[0]['width']
        
        print(f"Width ON : {w_on}")
        print(f"Width OFF: {w_off}")

        if w_on != w_off:
            print(f"PASS: Kerning Verified for {font_name} (Width changed by {abs(w_on - w_off):.3f}px).")
        else:
            print(f"FAIL/INFO: Kerning had no effect for {font_name}.")
    except Exception as e:
        print(f"ERROR: {e}")

# Test Times New Roman (Default)
test_ligatures("Times New Roman", "times.ttf")
test_kerning("Times New Roman", "times.ttf")

# Test Calibri (Known to have ligatures)
test_ligatures("Calibri", "calibri.ttf")
test_kerning("Calibri", "calibri.ttf")
