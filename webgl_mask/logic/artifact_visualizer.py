import os, sys
import numpy as np
from io import BytesIO
from PIL import Image
import base64

try:
    from guesser_core.logic.BoxDetector import find_redaction_boxes_in_image
except ImportError:
    # Standalone execution
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from BoxDetector import find_redaction_boxes_in_image

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

import fitz

# You can edit the source PDF path here
SOURCE_PDF = "efta00018586.pdf"

PAGE_W, PAGE_H = 816, 1056

def create_redaction_masks(pdf_path):
    print(f"\n--- Creating Redaction Masks for {os.path.basename(pdf_path)} ---")
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening PDF: {e}")
        return

    base = os.path.splitext(pdf_path)[0]
    found_any = False

    for page_index in range(len(doc)):
        page_num = page_index + 1

        # Use extracted image from PDF instead of rendering
        img_bytes = extract_page_image_bytes(doc, page_index)
        if not img_bytes:
            continue

        boxes, img_w, img_h = find_redaction_boxes_in_image(img_bytes)
        if not boxes:
            continue

        # Rendered grayscale as numpy array for sampling edge pixels
        with Image.open(BytesIO(img_bytes)) as pil_img:
            rendered = np.array(pil_img.convert("L"))

        # Black canvas: 0 = unredacted, 255 = redacted, gray = partial edge
        mask = np.zeros((img_h, img_w), dtype=np.uint8)

        for (x1, y1, x2, y2) in boxes:
            # Interior: uniform shade = 255 - lightest pixel inside box (box is black ~0, so ~255)
            interior_shade = 255 - int(np.max(rendered[y1:y2, x1:x2]))
            mask[y1:y2, x1:x2] = np.maximum(mask[y1:y2, x1:x2], interior_shade)

            # 1-px border: same logic — 255 - lightest pixel on that edge strip
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

        out_path = f"{base}_mask_p{page_num}.png"
        mask_pil = Image.fromarray(mask, "L")
        mask_pil.save(out_path)
        print(f"Saved mask for page {page_num} → {out_path}")
        found_any = True

    if not found_any:
        print("No redactions found.")

    doc.close()

def generate_mask_for_page(pdf_bytes, page_num):
    """
    Generates an 8-bit grayscale PNG mask for redactions on the given page.
    Returns the mask PNG bytes. 0 = unredacted (black), 255 = redacted (white).
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF: {e}")
        return None

    if page_num < 1 or page_num > len(doc):
        return None

    img_bytes = extract_page_image_bytes(doc, page_num - 1)

    if not img_bytes:
        doc.close()
        return None

    boxes, img_w, img_h = find_redaction_boxes_in_image(img_bytes)

    if not boxes:
        doc.close()
        return None

    mask = np.zeros((img_h, img_w), dtype=np.uint8)

    with Image.open(BytesIO(img_bytes)) as pil_img:
        rendered = np.array(pil_img.convert("L"))

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

    doc.close()

    out_io = BytesIO()
    mask_pil = Image.fromarray(mask, "L")
    mask_pil.save(out_io, format="PNG")
    return out_io.getvalue()

def generate_all_masks(pdf_bytes):
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF: {e}")
        return []
        
    masks = []
    for page_index in range(len(doc)):
        img_bytes = extract_page_image_bytes(doc, page_index)
        if not img_bytes:
            masks.append(None)
            continue
            
        boxes, img_w, img_h = find_redaction_boxes_in_image(img_bytes)
        if not boxes:
            masks.append(None)
            continue
            
        mask_b64 = generate_mask_from_image(img_bytes, boxes, img_w, img_h)
        masks.append(mask_b64)
        
    doc.close()
    return masks

def generate_mask_from_image(img_bytes, boxes, img_w, img_h):
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


if __name__ == "__main__":
    if os.path.exists(SOURCE_PDF):
        create_redaction_masks(SOURCE_PDF)
        print("Processing finished.")
    else:
        print(f"Error: Could not find '{SOURCE_PDF}'. Please ensure the file exists.")
