import fitz
import numpy as np
import cv2
import io
from PIL import Image

def process_pdf(pdf_bytes):
    """
    Process a PDF file (bytes) to detect black bars and extract font info.
    Returns:
        {
            "redactions": [ { "page": int, "width": float, "height": float, "area": float, "y": float, "x": float } ],
            "spans": [ { "page": int, "text": str, "font": { "size": float, "flags": int, "font": str } } ]
        }
    """
    redactions = []
    text_spans = []

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF stream: {e}")
        return {"error": str(e), "redactions": [], "spans": []}

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1

        # 1. Extract Text Spans for Font Detection
        # get_text("dict") returns a dictionary structure of the page content
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            if block.get("type") == 0:  # text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text_spans.append({
                            "page": page_num,
                            "text": span.get("text", "").strip(),
                            "font": {
                                "size": span.get("size", 0),
                                "flags": span.get("flags", 0),
                                "matched_font": span.get("font", "unknown")
                            }
                        })

        # 2. Detect Black Bars
        # Render page to image (pixmap) at 96 DPI (standard screen resolution, adjustable) or higher for better accuracy
        # The original code used 96 DPI.
        pix = page.get_pixmap(dpi=96)
        
        # Convert to numpy array
        img_array = np.frombuffer(pix.samples, dtype=np.uint8)
        
        if pix.n >= 3:
            img_array = img_array.reshape(pix.h, pix.w, pix.n)
            img_array = img_array[:, :, :3] # Take RGB
            open_cv_image = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        elif pix.n == 1:
            img_array = img_array.reshape(pix.h, pix.w)
            open_cv_image = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)
        else:
            continue # Skip unsupported

        # Convert to grayscale
        gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
        
        # Threshold to find black regions
        _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY_INV)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        valid_bars = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = cv2.contourArea(contour)
            bbox_area = w * h
            
            solidity = area / float(bbox_area) if bbox_area > 0 else 0
            
            # Criteria from original script: Area > 50, Solidity > 0.8
            if area > 50 and solidity > 0.8:
                valid_bars.append({
                    "page": page_num,
                    "x": x,
                    "y": y,
                    "width": w,
                    "height": h,
                    "area": area
                })

        # Sort bars: Top-to-bottom, Left-to-right
        valid_bars.sort(key=lambda b: (b["y"], b["x"]))
        redactions.extend(valid_bars)

    doc.close()
    return {"redactions": redactions, "spans": text_spans}
