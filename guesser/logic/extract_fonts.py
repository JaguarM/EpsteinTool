"""
Font detection module for PDF analysis.
Detects the dominant font in a PDF from pre-extracted text spans and maps it
to an available .ttf file in assets/fonts/.

Also usable as a standalone script to scan a directory tree for font metadata.
"""

import os

# Maps font name keywords (lowercase) to .ttf filenames in assets/fonts/.
# Evaluated in order; first match wins.
# NOTE: "roman" is intentionally omitted — it is a generic style suffix used by
# many non-Times fonts (e.g. "Garamond-Roman", "HelveticaNeue-Roman") and would
# cause widespread false positives.  "times" alone is sufficient to match every
# legitimate Times New Roman variant (TimesNewRomanPSMT, Times-Roman, TimesMT…).
FONT_MAP = [
    (["times"],    "times.ttf"),
    (["courier"],  "courier_new.ttf"),
    (["arial"],    "arial.ttf"),
    (["calibri"],  "calibri.ttf"),
]

# Minimum character count before a font is considered significant
MIN_CHARS = 35


def _map_pdf_font_to_file(pdf_font_name, available_fonts):
    """Map a PDF internal font name to a .ttf filename from available_fonts."""
    low = pdf_font_name.lower()
    for keywords, ttf_file in FONT_MAP:
        if any(kw in low for kw in keywords):
            if ttf_file in available_fonts:
                return ttf_file
    return None


def detect_dominant_font(text_spans, available_fonts, pdf_declared_fonts=None):
    """
    Detect the dominant font from a list of text spans, with a fallback to
    the PDF's declared font list for image-based (scanned) PDFs that have no
    extractable text.

    Parameters
    ----------
    text_spans : list of dict
        Each span has the structure produced by ProcessRedactions.process_pdf:
        {"page": int, "text": str, "font": {"size": float, "flags": int, "matched_font": str}}
    available_fonts : list of str
        .ttf filenames present in assets/fonts/ (from width_calculator.get_available_fonts).
        Only files in this list can be returned as font_file.
    pdf_declared_fonts : list of str | None
        Base-font names declared in the PDF (from page.get_fonts()), sorted by
        number of pages they appear on (most common first).  Used as a fallback
        when text-span analysis cannot identify a mappable font.

    Returns
    -------
    dict with keys:
        font_file     : str | None  – e.g. "times.ttf", or None if no match found
        font_size     : float       – dominant size in points (12.0 when unknown)
        pdf_font_name : str         – raw PDF font name (e.g. "TimesNewRomanPSMT")
    """
    font_char_counts = {}   # pdf_font_name -> total char count
    font_size_chars = {}    # pdf_font_name -> {size -> char count}

    for span in text_spans:
        text = span.get("text", "")
        font_info = span.get("font", {})
        pdf_font = font_info.get("matched_font", "")
        size = font_info.get("size", 0)
        if not pdf_font or not text:
            continue
        n = len(text)
        font_char_counts[pdf_font] = font_char_counts.get(pdf_font, 0) + n
        if pdf_font not in font_size_chars:
            font_size_chars[pdf_font] = {}
        font_size_chars[pdf_font][size] = font_size_chars[pdf_font].get(size, 0) + n

    # Only consider fonts with enough characters to be significant body text
    candidates = {k: v for k, v in font_char_counts.items() if v >= MIN_CHARS}

    if candidates:
        # Dominant font = most characters
        dominant_pdf_font = max(candidates, key=candidates.get)
        sizes = font_size_chars.get(dominant_pdf_font, {})
        dominant_size = float(max(sizes, key=sizes.get)) if sizes else 12.0
        font_file = _map_pdf_font_to_file(dominant_pdf_font, available_fonts)

        # If the dominant font name doesn't map to any available file, still try
        # the declared-font fallback before giving up.
        if font_file is not None:
            return {"font_file": font_file, "font_size": dominant_size, "pdf_font_name": dominant_pdf_font}

    # Fallback: iterate declared PDF fonts in frequency order and return the
    # first one that maps to an available .ttf.  This handles image-based PDFs
    # where get_text() yields no spans but fonts are still declared in the PDF.
    if pdf_declared_fonts:
        for declared_name in pdf_declared_fonts:
            fallback_file = _map_pdf_font_to_file(declared_name, available_fonts)
            if fallback_file:
                return {"font_file": fallback_file, "font_size": 12.0, "pdf_font_name": declared_name}

    return {"font_file": None, "font_size": 12.0, "pdf_font_name": ""}


# ---------------------------------------------------------------------------
# Standalone script — scan a directory tree for font metadata
# ---------------------------------------------------------------------------

def extract_specific_fonts(base_dir, target_folders):
    """
    Scan specified folders inside base_dir for PDF files, extract font metadata,
    and print fonts matching Times New Roman, Courier New, Calibri, or Arial.
    """
    try:
        import fitz
    except ImportError:
        print("PyMuPDF (fitz) is required for standalone scanning.")
        return

    target_font_keywords = ["times", "courier", "calibri", "arial"]

    print(f"Starting font metadata extraction in {base_dir}...\n")

    for folder in target_folders:
        folder_path = os.path.join(base_dir, folder)
        if not os.path.exists(folder_path):
            print(f"Warning: Directory '{folder_path}' does not exist. Skipping.")
            continue

        print(f"--- Processing Directory: {folder_path} ---")

        for root, _, files in os.walk(folder_path):
            for file in files:
                if not file.lower().endswith(".pdf"):
                    continue
                pdf_path = os.path.join(root, file)
                try:
                    doc = fitz.open(pdf_path)

                    # Build character counts per font name from span data
                    font_counts = {}
                    for page in doc:
                        for block in page.get_text("dict").get("blocks", []):
                            if block.get("type") == 0:
                                for line in block.get("lines", []):
                                    for span in line.get("spans", []):
                                        f_name = span.get("font", "")
                                        if f_name:
                                            font_counts[f_name] = (
                                                font_counts.get(f_name, 0)
                                                + len(span.get("text", ""))
                                            )

                    found_target_fonts = set()
                    for page_num in range(len(doc)):
                        for font in doc.get_page_fonts(page_num):
                            font_name = font[3] if len(font) > 3 and font[3] else ""
                            font_lower = font_name.lower()
                            if any(kw in font_lower for kw in target_font_keywords):
                                if font_counts.get(font_name, 0) >= MIN_CHARS:
                                    found_target_fonts.add(
                                        (font[2], font_name, font[5] if len(font) > 5 else "N/A")
                                    )

                    doc.close()

                    if not found_target_fonts:
                        continue

                    print(f"\nFile: {file}")
                    best_font = max(
                        (f_name for _, f_name, _ in found_target_fonts),
                        key=lambda n: font_counts.get(n, 0),
                    )
                    for f_type, f_name, f_enc in sorted(found_target_fonts):
                        chars = font_counts.get(f_name, 0)
                        tag = " [PRIMARY FONT]" if f_name == best_font else ""
                        print(f"  - Font: {f_name} ({chars} chars) (Type: {f_type}, Encoding: {f_enc}){tag}")

                except Exception as e:
                    print(f"Error processing {pdf_path}: {e}")


if __name__ == "__main__":
    base_directory = r"c:\Users\yanni\Desktop\FontMetadata"
    target_directories = [
        r"assets\times",
        r"assets\calibri",
        r"assets\courier",
        r"assets\Arial",
    ]
    extract_specific_fonts(base_directory, target_directories)
