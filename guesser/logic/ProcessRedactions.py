import fitz
import numpy as np
import cv2
import base64
import os, sys
from io import BytesIO
from PIL import Image

try:
    from .BoxDetector import find_redaction_boxes_in_image
    from .SurroundingWordWidth import estimate_widths_for_boxes
except ImportError:
    # Standalone execution — add this directory to sys.path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from BoxDetector import find_redaction_boxes_in_image
    from SurroundingWordWidth import estimate_widths_for_boxes

def extract_page_image_bytes(doc, page_index, image_index=0):
    """
    Locates images and extracts their raw bytes using doc.get_page_images(page_index).
    Returns the image bytes of the specified image index, or None if not found.
    """
    try:
        image_list = doc.get_page_images(page_index)
        if not image_list or image_index >= len(image_list):
            return None
        xref = image_list[image_index][0]
        base_image = doc.extract_image(xref)
        if base_image:
            return base_image["image"]
    except Exception as e:
        print(f"Error extracting image {image_index} from page {page_index}: {e}")
    return None

def _generate_mask_from_image(img_bytes, boxes, img_w, img_h):
    """Generate a base64-encoded grayscale mask PNG from detected redaction boxes.
    Returns base64 string or None if no boxes."""
    if not boxes:
        return None
    try:
        with Image.open(BytesIO(img_bytes)) as pil_img:
            rendered = np.array(pil_img.convert("L"))
        mask = np.zeros((img_h, img_w), dtype=np.uint8)
        for (x1, y1, x2, y2) in boxes:
            interior_shade = 255 - int(np.max(rendered[y1:y2, x1:x2]))
            mask[y1:y2, x1:x2] = np.maximum(mask[y1:y2, x1:x2], interior_shade)
            if y1 > 0:
                shade = 255 - int(np.max(rendered[y1 - 1, x1:x2]))
                mask[y1 - 1, x1:x2] = np.maximum(mask[y1 - 1, x1:x2], shade)
            if y2 < img_h:
                shade = 255 - int(np.max(rendered[y2, x1:x2]))
                mask[y2, x1:x2] = np.maximum(mask[y2, x1:x2], shade)
            if x1 > 0:
                shade = 255 - int(np.max(rendered[y1:y2, x1 - 1]))
                mask[y1:y2, x1 - 1] = np.maximum(mask[y1:y2, x1 - 1], shade)
            if x2 < img_w:
                shade = 255 - int(np.max(rendered[y1:y2, x2]))
                mask[y1:y2, x2] = np.maximum(mask[y1:y2, x2], shade)
        out_io = BytesIO()
        Image.fromarray(mask, "L").save(out_io, format="PNG")
        return base64.b64encode(out_io.getvalue()).decode()
    except Exception as e:
        print(f"Error generating mask: {e}")
        return None


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


                    # Capture the first valid image on each page
                    if page_num not in page_images:
                        page_images[page_num] = base64.b64encode(img_bytes).decode()

                    boxes, img_w, img_h = find_redaction_boxes_in_image(img_bytes)

                    # Generate mask for this page if not already done
                    if page_num not in mask_images:
                        mask_images[page_num] = _generate_mask_from_image(img_bytes, boxes, img_w, img_h)

                    if not boxes: continue
                    
                    image_rects = page.get_image_rects(xref)
                    if not image_rects: continue
                    img_rect = image_rects[0]
                    
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

    # Calculate suggested scale for pixel-space width matching (816×1056 px coordinates).
    # Width calculator outputs (advance/upem)*font_size*scale. To match pixel widths at 96 dpi
    # the scale must include (96/72)² = (816/612)² ≈ 1.778 relative to a 12 pt baseline.
    suggested_scale = 178
    if text_spans:
        font_sizes = [span["font"]["size"] for span in text_spans if span["font"]["size"] > 0]
        if font_sizes:
            median_size = sorted(font_sizes)[len(font_sizes) // 2]
            suggested_scale = round((median_size / 12.0) * (816 / 612) ** 2 * 100)

    # Sort declared fonts by number of pages they appear on (most common first)
    pdf_fonts = sorted(pdf_font_pages, key=pdf_font_pages.get, reverse=True)

    num_pages = len(doc)
    doc.close()
    return {
        "redactions": redactions,
        "spans": text_spans,
        "pdf_fonts": pdf_fonts,
        "suggested_scale": suggested_scale,
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
