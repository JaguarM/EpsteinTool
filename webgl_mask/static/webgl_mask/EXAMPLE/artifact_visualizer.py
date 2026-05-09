"""
Thin CLI wrapper around the project's mask generation logic.
Imports build_mask_array from webgl_mask.logic.artifact_visualizer so
changes only need to be made in one place.
"""
import os
import sys
import fitz
import numpy as np
from io import BytesIO
from PIL import Image

# Add project root so we can import from the main app
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, _PROJECT_ROOT)

from webgl_mask.logic.artifact_visualizer import build_mask_array, get_grayscale_image_bytes

# You can edit the source PDF path here
SOURCE_PDF = "PDF.pdf"


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


if __name__ == "__main__":
    if os.path.exists(SOURCE_PDF):
        create_redaction_masks(SOURCE_PDF)
        print("Processing finished.")
    else:
        print(f"Error: Could not find '{SOURCE_PDF}'. Please ensure the file exists.")
