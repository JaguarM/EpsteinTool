from __future__ import annotations
import traceback
from typing import Any

from .base import DetectedBox, RedactionRefiner


class RefinerPipeline:
    def __init__(self, refiners: list[RedactionRefiner]):
        self.refiners = refiners

    def run(self, box: DetectedBox, evidence_map: dict[str, Any]) -> DetectedBox:
        """
        Run each refiner against the original box independently.
        Merge proposals edge-by-edge: highest confidence wins.
        On confidence tie, prefer less shrinkage (conservative).
        Safety: proposals can only shrink the box, never expand it.
        """
        proposals = []
        for r in self.refiners:
            ev = evidence_map.get(r.name)
            try:
                proposals.append(r.refine(box, ev))
            except Exception:
                traceback.print_exc()

        new_x = box.x
        new_x2 = box.x + box.width

        left_proposals = [(p.x, p.confidence) for p in proposals if p.x is not None]
        if left_proposals:
            best_conf = max(conf for _, conf in left_proposals)
            # On confidence tie: least shrinkage = smallest x (left edge stays leftmost)
            best_x = min(x for x, conf in left_proposals if conf == best_conf)
            if best_x < new_x2:
                new_x = best_x

        right_proposals = [(p.x2, p.confidence) for p in proposals if p.x2 is not None]
        if right_proposals:
            best_conf = max(conf for _, conf in right_proposals)
            # On confidence tie: least shrinkage = largest x2 (right edge stays rightmost)
            best_x2 = max(x2 for x2, conf in right_proposals if conf == best_conf)
            if new_x < best_x2:
                new_x2 = best_x2

        return DetectedBox(
            page=box.page,
            x=new_x,
            y=box.y,
            width=new_x2 - new_x,
            height=box.height,
        )
