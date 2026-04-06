from __future__ import annotations

import fitz

from unredact.types.file_types import FontRunReport, FontTextRun, Rect


def build_font_run_report(pdf_bytes: bytes) -> FontRunReport:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    runs: list[FontTextRun] = []

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        ph = page.rect.height
        rawdict = page.get_text("rawdict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

        for block in rawdict.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    if not text:
                        chars = span.get("chars", [])
                        if chars:
                            text = "".join(ch.get("c", "") for ch in chars)
                    if not text.strip():
                        continue

                    font_size_pt = float(span.get("size", 12.0))
                    origin = span.get("origin", (0.0, 0.0))
                    baseline_pdf = ph - float(origin[1])
                    bbox_raw = span.get("bbox")
                    if bbox_raw:
                        x0, _, x1, _ = bbox_raw
                        rect = Rect.new(x0, baseline_pdf - font_size_pt, x1, baseline_pdf)
                    else:
                        rect = Rect.new(
                            origin[0],
                            baseline_pdf - font_size_pt,
                            origin[0] + font_size_pt * len(text) * 0.55,
                            baseline_pdf,
                        )

                    runs.append(FontTextRun(
                        page_index=page_index,
                        text=text,
                        bbox=rect,
                        font_size_pt=font_size_pt,
                    ))

    doc.close()
    return FontRunReport(runs=runs)
