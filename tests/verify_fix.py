from logic.width_calculator import get_text_widths
import sys

try:
    print("Testing Ligatures with 'fi'...")
    # Measure 'fi' with ligatures ON (default)
    res_on = get_text_widths(["fi"], font_name="times.ttf", font_size=20, ligatures=True)
    width_on = res_on[0]['width']
    
    # Measure 'fi' with ligatures OFF
    res_off = get_text_widths(["fi"], font_name="times.ttf", font_size=20, ligatures=False)
    width_off = res_off[0]['width']
    
    print(f"Ligatures ON width: {width_on}")
    print(f"Ligatures OFF width: {width_off}")
    
    if width_on != width_off:
        print("PASS: Ligatures affect width.")
    else:
        print("FAIL: Ligatures do not affect width (or font doesn't support them).")
        
    print("\nTesting Kerning with 'AV'...")
    # Measure 'AV' with kerning ON (default)
    res_kern_on = get_text_widths(["AV"], font_name="times.ttf", font_size=20, kerning=True)
    width_kern_on = res_kern_on[0]['width']
    
    # Measure 'AV' with kerning OFF
    res_kern_off = get_text_widths(["AV"], font_name="times.ttf", font_size=20, kerning=False)
    width_kern_off = res_kern_off[0]['width']
    
    print(f"Kerning ON width: {width_kern_on}")
    print(f"Kerning OFF width: {width_kern_off}")
    
    if width_kern_on != width_kern_off:
        print("PASS: Kerning affects width.")
    else:
        print("FAIL: Kerning does not affect width (or font doesn't support it).")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
