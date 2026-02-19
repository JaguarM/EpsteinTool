from logic.width_calculator import get_text_widths

def test_force_uppercase():
    text = "Hello"
    
    # Measure normal
    res_normal = get_text_widths([text], force_uppercase=False)[0]
    
    # Measure uppercase
    res_upper = get_text_widths([text], force_uppercase=True)[0]
    
    # Measure manual uppercase
    res_manual_upper = get_text_widths([text.upper()], force_uppercase=False)[0]
    
    print(f"Normal: {res_normal['width']}")
    print(f"Force Upper: {res_upper['width']}")
    print(f"Manual Upper: {res_manual_upper['width']}")
    
    if res_upper['width'] == res_manual_upper['width']:
        print("PASS: Force uppercase matches manual uppercase.")
    else:
        print("FAIL: Width mismatch.")

    if res_upper['width'] > res_normal['width']:
        print("PASS: Uppercase is wider than lowercase (usually).")

if __name__ == "__main__":
    test_force_uppercase()
