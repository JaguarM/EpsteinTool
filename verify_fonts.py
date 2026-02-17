
import os
import sys

# Add the current directory to sys.path so we can import logic
sys.path.append(os.getcwd())

from logic.width_calculator import get_text_widths

def test_font_loading():
    print("Testing font loading...")
    
    # Test 1: Standard Times New Roman
    print("\nTest 1: Loading 'times.ttf'")
    results = get_text_widths(["Hello"], font_name="times.ttf")
    if results and "error" not in results[0]:
        print("SUCCESS: Loaded times.ttf")
        print(f"Width of 'Hello': {results[0]['width']}")
    else:
        print("FAILURE: Could not load times.ttf")
        print(f"Result: {results}")

    # Test 2: Arial (commonly available on both, or mapped)
    print("\nTest 2: Loading 'arial.ttf'")
    results = get_text_widths(["Hello"], font_name="arial.ttf")
    if results and "error" not in results[0]:
         print("SUCCESS: Loaded arial.ttf")
    else:
         print("WARNING: Could not load arial.ttf (might not be installed or in path)")
         print(f"Result: {results}")

if __name__ == "__main__":
    test_font_loading()
