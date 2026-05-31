from __future__ import annotations
from typing import Any

from .base import DetectedBox, BoxProposal, RedactionRefiner


_SCALE_THRESHOLD = 700   # bbox x1 < this → treat as PDF points, scale to pixels
_PT_TO_PX = 816.0 / 612.0
_DEFAULT_SPACE_PX = 9.5


def _resolve_word_bbox(word: dict) -> tuple[float, float, float, float]:
    """Return (wx0, wy0, wx1, wy1) in pixel space for an ETV word dict."""
    if "bbox" in word and len(word["bbox"]) == 4:
        wx0, wy0, wx1, wy1 = word["bbox"]
        if wx1 < _SCALE_THRESHOLD:
            wx0 *= _PT_TO_PX; wy0 *= _PT_TO_PX
            wx1 *= _PT_TO_PX; wy1 *= _PT_TO_PX
    else:
        wx0 = word.get("x", 0)
        wy0 = word.get("y", 0)
        wx1 = wx0 + word.get("width", word.get("w", 0))
        wy1 = wy0 + word.get("height", word.get("h", 0))
    return wx0, wy0, wx1, wy1


def _find_ocr_match(
    etv_text: str,
    etv_x0: float, etv_y0: float,
    etv_x1: float, etv_y1: float,
    ocr_words: list[dict],
) -> tuple[float | None, float | None, str | None]:
    """
    Find an OCR word that:
      - contains etv_text (case-insensitive substring)
      - is strictly longer than etv_text  (OCR found extra letters)
      - spatially overlaps with the ETV word bbox

    Returns (ocr_x0, ocr_x1, ocr_text) or (None, None, None).
    """
    for ocr in ocr_words:
        ocr_text = ocr.get("text", "")
        if not (etv_text.lower() in ocr_text.lower() and len(ocr_text) > len(etv_text)):
            continue

        ox0 = ocr.get("x", 0)
        oy0 = ocr.get("y", 0)
        ox1 = ox0 + ocr.get("width", 0)
        oy1 = oy0 + ocr.get("height", 0)

        overlap_x = max(0.0, min(etv_x1, ox1) - max(etv_x0, ox0))
        overlap_y = max(0.0, min(etv_y1, oy1) - max(etv_y0, oy0))

        if overlap_x > 0 and overlap_y > 0:
            return ox0, ox1, ocr_text

    return None, None, None


class TesseractRefiner(RedactionRefiner):
    """
    Refines redaction box edges by comparing embedded text (ETV) against
    Tesseract OCR output. When Tesseract finds more letters than ETV at a
    box edge, the edge is shifted inward to exclude those extra letters.

    Expected evidence dict:
        {
            "etv_words": list[dict],  # ETV span words from the frontend
            "ocr_words": list[dict],  # from tesseract_runner.process_pdf_page_for_ocr
            "space_px":  float,       # optional, defaults to 9.5
        }
    """

    name = "tesseract"
    _confidence = 0.7  # lower than ETV — Tesseract is spatially less precise

    def refine(self, box: DetectedBox, evidence: Any) -> BoxProposal:
        if not evidence:
            return BoxProposal()

        etv_words: list[dict] = evidence.get("etv_words", [])
        ocr_words: list[dict] = evidence.get("ocr_words", [])
        space_px: float = evidence.get("space_px", _DEFAULT_SPACE_PX)

        if not ocr_words:
            return BoxProposal()

        rx, ry = box.x, box.y
        rx2, ry2 = rx + box.width, ry + box.height

        # Find the nearest ETV word on each side of the box
        word_before = None
        dist_before = float("inf")
        word_after = None
        dist_after = float("inf")

        for w in etv_words:
            wx0, wy0, wx1, wy1 = _resolve_word_bbox(w)

            # Vertically overlapping with the box
            if wy1 < ry or wy0 > ry2:
                continue

            if wx1 <= rx + 5:
                dist = rx - wx1
                if dist < dist_before:
                    dist_before = dist
                    word_before = w
            elif wx0 >= rx2 - 5:
                dist = wx0 - rx2
                if dist < dist_after:
                    dist_after = dist
                    word_after = w

        new_x = None
        new_x2 = None

        if word_before:
            wx0, wy0, wx1, wy1 = _resolve_word_bbox(word_before)
            before_text = word_before.get("text", "")
            words = before_text.split()
            last_word = words[-1] if words else before_text

            ocr_x0, ocr_x1, _ = _find_ocr_match(last_word, wx0, wy0, wx1, wy1, ocr_words)
            if ocr_x1 is not None and ocr_x1 > wx1:
                candidate = ocr_x1 + space_px
                # Only apply if the candidate falls inside the original box
                if rx <= candidate < rx2:
                    new_x = candidate

        if word_after:
            wx0, wy0, wx1, wy1 = _resolve_word_bbox(word_after)
            after_text = word_after.get("text", "")
            words = after_text.split()
            first_word = words[0] if words else after_text

            ocr_x0, ocr_x1, _ = _find_ocr_match(first_word, wx0, wy0, wx1, wy1, ocr_words)
            if ocr_x0 is not None and ocr_x0 < wx0:
                candidate = ocr_x0 - space_px
                # Only apply if the candidate falls inside the original box
                left_bound = new_x if new_x is not None else rx
                if left_bound < candidate <= rx2:
                    new_x2 = candidate

        if new_x is None and new_x2 is None:
            return BoxProposal()

        return BoxProposal(
            x=new_x,
            x2=new_x2,
            confidence=self._confidence,
            source=self.name,
        )
