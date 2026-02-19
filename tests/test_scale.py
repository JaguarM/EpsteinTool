from logic.width_calculator import get_text_widths

def test_scale_factor():
    text = "Hello"
    
    # Measure with default scale (1.35)
    res_default = get_text_widths([text], scale_factor=1.35)[0]
    
    # Measure with 2.0 scale
    res_scaled = get_text_widths([text], scale_factor=2.7)[0] # 1.35 * 2
    
    print(f"Default (1.35): {res_default['width']}")
    print(f"Scaled (2.70): {res_scaled['width']}")
    
    # Check if scaled is roughly double
    ratio = res_scaled['width'] / res_default['width']
    print(f"Ratio: {ratio}")
    
    if abs(ratio - 2.0) < 0.1:
        print("PASS: Width scaled correctly.")
    else:
        print("FAIL: Width scaling incorrect.")

if __name__ == "__main__":
    test_scale_factor()
