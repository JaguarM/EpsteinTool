import os
import numpy as np
import cv2
from io import BytesIO
from PIL import Image
import base64
import fitz

# You can edit the source PDF path here
SOURCE_PDF = "efta00018586.pdf"

PAGE_W, PAGE_H = 816, 1056



def get_grayscale_image_bytes(doc, page_index, image_index=0):
    """
    Extracts the base image natively as a grayscale PNG, bypassing ICC profile
    issues that occur with PIL's loading of raw embedded JPEGs, and bypassing
    PDF page scaling offsets.
    """
    try:
        image_list = doc.get_page_images(page_index)
        if not image_list or image_index >= len(image_list):
            return None
        xref = image_list[image_index][0]
        pix = fitz.Pixmap(doc, xref)
        
        # Force strict 8-bit grayscale to avoid any ICC color shifts later
        if pix.n > 1 or (pix.colorspace and pix.colorspace.name != fitz.csGRAY.name):
            try:
                gray_pix = fitz.Pixmap(fitz.csGRAY, pix)
                pix = gray_pix
            except Exception:
                pass # fallback if csGRAY conversion fails

        image_bytes = pix.tobytes("png")
        return image_bytes
    except Exception as e:
        print(f"Error extracting image {image_index} from page {page_index}: {e}")
    return None

def dilate(m):
    """Expand a boolean mask by 1 pixel in all 4 directions."""
    d = m.copy()
    d[1:] |= m[:-1]
    d[:-1] |= m[1:]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def remove_circles(rendered, black_mask):
    """
    Runs Hough Circle Transform on the rendered grayscale to detect hole punches
    and zeroes out those regions in black_mask.
    """
    blurred = cv2.GaussianBlur(rendered, (9, 9), 2)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=30,
        param1=100,  # upper Canny threshold
        param2=30,   # accumulator threshold — lower = more sensitive
        minRadius=8,
        maxRadius=20,
    )
    if circles is None:
        return black_mask

    reject = np.zeros(rendered.shape, dtype=np.uint8)
    for cx, cy, r in np.round(circles[0]).astype(int):
        cv2.circle(reject, (cx, cy), r + 2, 1, thickness=cv2.FILLED)
    return black_mask & (reject == 0)


def filter_components(black_mask):
    """
    Uses OpenCV contours to remove thin lines (bbox width < 17 or height < 10).
    Circle removal is handled separately via Hough before this step.
    """
    img = black_mask.astype(np.uint8) * 255

    # Remove thin text protrusions from redaction edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    img = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    result = np.zeros_like(img)
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 17 or h < 10:
            continue

        # Reject thin strokes (lines, border outlines) regardless of overall shape.
        # area/perimeter ≈ thickness/2 for any thin shape; solid redaction blocks
        # have a much higher ratio. Threshold of 5 ≈ rejects anything < ~10px thick.
        area = cv2.contourArea(cnt)
        perimeter = cv2.arcLength(cnt, True)
        if perimeter > 0 and area / perimeter < 2:
            continue

        cv2.drawContours(result, [cnt], -1, 255, thickness=cv2.FILLED)

    return result.astype(bool)


def build_mask_array(rendered):
    """
    Given a grayscale uint8 numpy array, returns a uint8
    mask: 255 = redacted interior, 0 = clear, mid-gray = border indicator.
    Returns None if no redactions are found after filtering.
    """
    black_mask = rendered <= 0
    black_mask = remove_circles(rendered, black_mask)
    black_mask = filter_components(black_mask)
    if not np.any(black_mask):
        return None

    outer1 = dilate(black_mask)
    border1 = outer1 & ~black_mask
    border2 = dilate(outer1) & ~outer1

    m = np.zeros(rendered.shape, dtype=np.uint8)
    m[black_mask] = 255
    _apply_edge_lines(m, border1, border2, outer1, black_mask, rendered)
    return m


def _apply_edge_lines(m, border1, border2, outer1, black_mask, rendered):
    """
    Splits the border rings into horizontal-edge pixels (black above/below) and
    vertical-edge pixels (black left/right), then scans each set independently.
    Each contiguous run gets one uniform value: 255 - max(rendered[run]).
    Top/bottom edges use two rings (border1 + border2); left/right use one.
    No pixel is touched by both scans, so uniformity is preserved.
    """
    # Ring 1: pixels directly adjacent to black_mask vertically → top/bottom row 1
    h_border1 = border1 & (
        np.roll(black_mask, 1, axis=0) | np.roll(black_mask, -1, axis=0)
    )
    v_border1 = border1 & ~h_border1

    # Ring 2 (top/bottom only): pixels directly adjacent to outer1 vertically → top/bottom row 2
    h_border2 = border2 & (
        np.roll(outer1, 1, axis=0) | np.roll(outer1, -1, axis=0)
    )

    # Horizontal scan on both h_border rings independently
    for h_border in (h_border1, h_border2):
        for y in range(h_border.shape[0]):
            row = h_border[y]
            if not np.any(row):
                continue
            padded = np.concatenate(([False], row, [False]))
            diff = np.diff(padded.astype(np.int8))
            for sx, ex in zip(np.where(diff == 1)[0], np.where(diff == -1)[0]):
                val = 255 - int(rendered[y, sx:ex].max())
                m[y, sx:ex] = val

    # Vertical scan on v_border1 (left/right edges stay at 1 ring)
    for x in range(v_border1.shape[1]):
        col = v_border1[:, x]
        if not np.any(col):
            continue
        padded = np.concatenate(([False], col, [False]))
        diff = np.diff(padded.astype(np.int8))
        for sy, ey in zip(np.where(diff == 1)[0], np.where(diff == -1)[0]):
            val = 255 - int(rendered[sy:ey, x].max())
            m[sy:ey, x] = val


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

        img_bytes = get_grayscale_image_bytes(doc, page_index)
        if not img_bytes:
            continue

        with Image.open(BytesIO(img_bytes)) as pil_img:
            rendered = np.array(pil_img.convert("L"))

        mask = build_mask_array(rendered)
        if mask is None:
            continue

        out_path = f"{base}_mask_p{page_num}.png"
        Image.fromarray(mask, "L").save(out_path)
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
        doc.close()
        return None

    img_bytes = get_grayscale_image_bytes(doc, page_num - 1)

    if not img_bytes:
        doc.close()
        return None

    with Image.open(BytesIO(img_bytes)) as pil_img:
        rendered = np.array(pil_img.convert("L"))

    mask = build_mask_array(rendered)

    doc.close()

    if mask is None:
        return None

    out_io = BytesIO()
    Image.fromarray(mask, "L").save(out_io, format="PNG")
    return out_io.getvalue()


def generate_all_masks(pdf_bytes):
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF: {e}")
        return []

    masks = []
    for page_index in range(len(doc)):
        img_bytes = get_grayscale_image_bytes(doc, page_index)
        if not img_bytes:
            masks.append(None)
            continue

        mask_b64 = generate_mask_from_image(img_bytes)
        masks.append(mask_b64)

    doc.close()
    return masks


def generate_mask_from_image(img_bytes):
    """Generate a base64-encoded grayscale mask PNG from an extracted page image.
    Returns base64 string or None if no redactions found."""
    try:
        with Image.open(BytesIO(img_bytes)) as pil_img:
            rendered = np.array(pil_img.convert("L"))

        mask = build_mask_array(rendered)
        if mask is None:
            return None

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
