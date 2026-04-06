from __future__ import annotations

from unredact.dependency.pdf_annotator import PdfAnnotator
from unredact.types.file_types import FontRunReport
from unredact.types.text_overlay import TextOverlay
from unredact.types.visualizer_config import VisualizerConfig


class VisualizationData:
    def render(self, pdf_bytes: bytes, font_runs: FontRunReport, cfg: VisualizerConfig) -> bytes:
        overlays = [
            TextOverlay(
                page_index=run.page_index,
                text=run.text,
                font_size_pt=run.font_size_pt,
                x=run.bbox.x0,
                y=run.bbox.y1,
            )
            for run in font_runs.runs
            if run.text.strip()
        ]
        return PdfAnnotator().annotate(pdf_bytes, overlays, cfg.text_color)
