import fitz
import numpy as np
import cv2
import base64
import os, sys
from collections import Counter
from io import BytesIO
from PIL import Image

try:
    from .BoxDetector import find_redaction_boxes_in_image
    from .SurroundingWordWidth import estimate_widths_for_boxes
    from .artifact_visualizer import generate_mask_from_image
except ImportError:
    # Standalone execution — add this directory to sys.path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from BoxDetector import find_redaction_boxes_in_image
    from SurroundingWordWidth import estimate_widths_for_boxes
    from artifact_visualizer import generate_mask_from_image






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

    page_images = {}      # page_num -> base64 PNG, one per page
    mask_images = {}      # page_num -> base64 mask PNG (or None)
    pdf_font_pages = {}   # basefont_name -> number of pages it appears on
    page_scale_ratio = None  # img_px / page_pt, determined from first placed image

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1

        # 0. Collect declared fonts for fallback detection (works even on image-only pages)
        try:
            for font_tuple in page.get_fonts(full=False):
                basefont = font_tuple[3] if len(font_tuple) > 3 else ""
                if basefont and basefont not in ("", "unknown"):
                    pdf_font_pages[basefont] = pdf_font_pages.get(basefont, 0) + 1
        except Exception as e:
            print(f"Error collecting declared fonts on page {page_num}: {e}")

        # 1. Extract Text Spans for Font Detection
        try:
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
        except Exception as e:
            print(f"Error extracting text spans on page {page_num}: {e}")

        # 2. Extract images and perform redaction box detection
        try:
            image_list = doc.get_page_images(page_index)
            if not image_list:
                continue
                
            for img_info in image_list:
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    if not base_image: continue
                    
                    image_ext = base_image.get("ext", "").lower()
                    if image_ext not in ('png', 'tiff', 'tif'):
                        continue
                    
                    img_bytes = base_image["image"]


                    # Crop excess bottom pixels based on the explicitly expected 8.5x11 page ratio
                    try:
                        with Image.open(BytesIO(img_bytes)) as pil_img:
                            if pil_img.mode not in ("RGB", "RGBA", "L"):
                                pil_img = pil_img.convert("RGB")
                            w, h = pil_img.size
                            # Enforce standard 8.5x11 (1056/816) aspect ratio for the embedded images
                            expected_h = int(round(w * (1056.0 / 816.0)))
                            if h > expected_h:
                                pil_img = pil_img.crop((0, 0, w, expected_h))
                                out_io = BytesIO()
                                pil_img.save(out_io, format="PNG")
                                img_bytes = out_io.getvalue()
                    except Exception as e:
                        print(f"Error checking/cropping image dimensions on page {page_num}: {e}")

                    # Capture the first valid image on each page
                    if page_num not in page_images:
                        page_images[page_num] = base64.b64encode(img_bytes).decode()

                    boxes, img_w, img_h = find_redaction_boxes_in_image(img_bytes)

                    # Generate mask for this page if not already done
                    if page_num not in mask_images:
                        mask_images[page_num] = generate_mask_from_image(img_bytes, boxes, img_w, img_h)

                    if not boxes: continue
                    
                    image_rects = page.get_image_rects(xref)
                    if not image_rects: continue
                    img_rect = image_rects[0]

                    if page_scale_ratio is None and img_rect.width > 0:
                        page_scale_ratio = img_w / img_rect.width
                    
                    expected_widths = estimate_widths_for_boxes(page, boxes, img_rect, img_w, img_h, img_bytes)
                    
                    for i, box in enumerate(boxes):
                        bx1, by1, bx2, by2 = box
                        expected_data = expected_widths[i]
                        
                        final_x1 = float(bx1)
                        final_x2 = float(bx2)
                        
                        if expected_data[0] is not None or expected_data[1] is not None:
                            expected_x1, expected_x2 = expected_data
                            
                            temp_x1 = expected_x1 if expected_x1 is not None else float(bx1)
                            temp_x2 = expected_x2 if expected_x2 is not None else float(bx2)
                            
                            bw = bx2 - bx1
                            new_w = temp_x2 - temp_x1
                            
                            # Check if within 25% range
                            diff_pct = abs(new_w - bw) / bw
                            if diff_pct <= 0.25:
                                final_x1 = temp_x1
                                final_x2 = temp_x2

                        w = final_x2 - final_x1
                        h = by2 - by1
                        area = w * h
                        
                        redactions.append({
                            "page": page_num,
                            "x": float(final_x1),
                            "y": float(by1),
                            "width": float(w),
                            "height": float(h),
                            "area": float(area),
                        })
                        
                except Exception as e:
                    print(f"Error processing image xref {xref} on page {page_num}: {e}")
        except Exception as e:
            print(f"Error extracting images on page {page_num}: {e}")

    # Sort redactions: Top-to-bottom, Left-to-right
    redactions.sort(key=lambda b: (b["page"], b["y"], b["x"]))

    # suggested_scale: converts font advances (in pt) to image pixel widths.
    # Width calculator: pixel_width = (advance/upem) * font_size_pt * (scale/100)
    # Actual pixel width in embedded image: (advance/upem) * font_size_pt * (img_px / page_pt)
    # Therefore scale/100 = img_px / page_pt  →  scale = round(100 * img_px / page_pt)
    # For standard 816 px / 612 pt letter pages this is 133.
    ratio = page_scale_ratio if page_scale_ratio is not None else (816.0 / 612.0)
    suggested_scale = round(100 * ratio)

    # suggested_size: mode of body-text span sizes, rounded to nearest 0.5 pt.
    # Filter to spans >= 20 chars to exclude headers, labels, page numbers;
    # fall back to all spans when the PDF has only short word-level spans.
    def _body_sizes(spans, min_len):
        return [
            round(s["font"]["size"] * 2) / 2
            for s in spans
            if len(s.get("text", "")) >= min_len and s["font"]["size"] > 0
        ]

    sizes = _body_sizes(text_spans, 20) or _body_sizes(text_spans, 1)
    suggested_size = Counter(sizes).most_common(1)[0][0] if sizes else 12.0

    # Sort declared fonts by number of pages they appear on (most common first)
    pdf_fonts = sorted(pdf_font_pages, key=pdf_font_pages.get, reverse=True)

    num_pages = len(doc)
    doc.close()
    return {
        "redactions": redactions,
        "spans": text_spans,
        "pdf_fonts": pdf_fonts,
        "suggested_scale": suggested_scale,
        "suggested_size": suggested_size,
        "page_images": [page_images.get(i + 1) for i in range(num_pages)],
        "mask_images": [mask_images.get(i + 1) for i in range(num_pages)],
        "page_image_type": "image/png",
        "page_width": 816,
        "page_height": 1056,
        "num_pages": num_pages,
    }


def process_image(image_bytes, mime_type="image/png"):
    """
    Process a raw image file (PNG, JPEG, TIFF, …) to detect redaction boxes.
    Returns the same structure as process_pdf but without text span data.
    """
    try:
        img_array = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            return {"error": "Could not decode image", "redactions": [], "spans": []}

        img_h, img_w = img.shape[:2]

        boxes, _, _ = find_redaction_boxes_in_image(image_bytes)

        redactions = []
        for box in boxes:
            bx1, by1, bx2, by2 = box
            w = float(bx2 - bx1)
            h = float(by2 - by1)
            redactions.append({
                "page": 1,
                "x": float(bx1),
                "y": float(by1),
                "width": w,
                "height": h,
                "area": w * h,
            })
        redactions.sort(key=lambda b: (b["y"], b["x"]))

        page_image_b64 = base64.b64encode(image_bytes).decode()

        return {
            "redactions": redactions,
            "spans": [],
            "suggested_scale": 178,
            "page_images": [page_image_b64],
            "page_image_type": mime_type,
            "page_width": img_w,
            "page_height": img_h,
            "num_pages": 1,
        }
    except Exception as e:
        return {"error": str(e), "redactions": [], "spans": []}
