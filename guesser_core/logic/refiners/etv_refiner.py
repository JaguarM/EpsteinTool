from __future__ import annotations
from typing import Any

from .base import DetectedBox, BoxProposal, RedactionRefiner
from guesser_core.logic.SurroundingWordWidth import estimate_widths_for_boxes


class EtvRefiner(RedactionRefiner):
    """
    Refines redaction box edges using embedded PDF text (ETV).
    Wraps SurroundingWordWidth.estimate_widths_for_boxes.

    Expected evidence dict:
        {
            "page":     fitz.Page,
            "img_rect": fitz.Rect,
            "img_w":    int,
            "img_h":    int,
            "img_bytes": bytes,   # optional, enables whitespace detection
        }
    """

    name = "etv"
    _confidence = 0.9
    _max_width_change = 0.25  # reject proposals that change width by more than 25%

    def refine(self, box: DetectedBox, evidence: Any) -> BoxProposal:
        if not evidence:
            return BoxProposal()

        boxes_px = [(box.x, box.y, box.x + box.width, box.y + box.height)]
        results = estimate_widths_for_boxes(
            evidence["page"],
            boxes_px,
            evidence["img_rect"],
            evidence["img_w"],
            evidence["img_h"],
            evidence.get("img_bytes"),
        )
        exp_x1, exp_x2, _ = results[0]

        if exp_x1 is None and exp_x2 is None:
            return BoxProposal()

        temp_x1 = exp_x1 if exp_x1 is not None else box.x
        temp_x2 = exp_x2 if exp_x2 is not None else box.x + box.width

        # Reject if proposed width change is too large — guards against bad ETV matches
        if box.width > 0:
            diff_pct = abs((temp_x2 - temp_x1) - box.width) / box.width
            if diff_pct > self._max_width_change:
                return BoxProposal()

        return BoxProposal(
            x=float(temp_x1) if exp_x1 is not None else None,
            x2=float(temp_x2) if exp_x2 is not None else None,
            confidence=self._confidence,
            source=self.name,
        )
