from logic.width_calculator import get_text_widths
import sys
import os

print(f"Current CWD: {os.getcwd()}")

try:
    print("--- Ligature Test ---")
    res_on = get_text_widths(["fi"], font_name="times.ttf", font_size=72, ligatures=True)
    res_off = get_text_widths(["fi"], font_name="times.ttf", font_size=72, ligatures=False)
    
    w_on = res_on[0]['width']
    w_off = res_off[0]['width']
    
    print(f"Font Loaded (ON): {res_on[0].get('error', 'Success')}")
    print(f"Width ON: {w_on}")
    print(f"Width OFF: {w_off}")
    
    if w_on != w_off:
        print("PASS: Ligatures Verified.")
    else:
        print("FAIL: Widths are identical.")

    print("\n--- Kerning Test ---")
    res_k_on = get_text_widths(["AV"], font_name="times.ttf", font_size=72, kerning=True)
    res_k_off = get_text_widths(["AV"], font_name="times.ttf", font_size=72, kerning=False)
    
    k_on = res_k_on[0]['width']
    k_off = res_k_off[0]['width']
    
    print(f"Width ON: {k_on}")
    print(f"Width OFF: {k_off}")
    
    if k_on != k_off:
        print("PASS: Kerning Verified.")
    else:
        print("FAIL: Widths are identical.")

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
