# SurroundingWordWidth.py Documentation

[SurroundingWordWidth.py](../../guesser_core/logic/SurroundingWordWidth.py) refines the horizontal edges of detected redaction boxes...

## Core Function

### `estimate_widths_for_boxes(page, boxes, img_rect, img_w, img_h, base_image_bytes=None)`

**Inputs:**
- `page` — a `fitz.Page` object (PyMuPDF) for text word extraction
- `boxes` — list of `(x1, y1, x2, y2)` tuples in pixel coordinates (from BoxDetector)
- `img_rect` — `fitz.Rect` of the embedded image on the PDF page (in PDF points)
- `img_w`, `img_h` — pixel dimensions of the source image
- `base_image_bytes` — optional raw image bytes for sub-pixel edge scanning

**Output:**
A list of `(expected_x1, expected_x2)` tuples, one per input box. Each value is either a refined pixel coordinate or `None` if no refinement was possible for that edge.

---

## Algorithm

### 1. Coordinate Conversion

The function computes conversion ratios between pixel space and PDF point space:

```python
px_to_pts_x = img_rect.width / img_w
px_to_pts_y = img_rect.height / img_h
pts_to_px_x = 1.0 / px_to_pts_x
```

Each box is converted to point coordinates (`boxes_pts`) for comparison with text word positions.

### 2. Word Bucketing by Line

For each box, all text words on the page (from `page.get_text("words")`) are grouped into horizontal "line buckets" based on their vertical midpoint:

- A word is considered on the same line as the box if ≥ 50% of its height overlaps vertically with the box
- Words are grouped into buckets where their y-midpoints are within 5 points of each other
- The bucket midpoint is recalculated as new words join

### 3. Finding Nearest Words (Before & After)

For each line bucket, the algorithm finds:

- **`word_before`**: the word whose right edge is closest to (and left of) the box's left edge
- **`word_after`**: the word whose left edge is closest to (and right of) the box's right edge

**Obstruction detection:** A word is rejected if another redaction box lies between it and the current box on the same line. This prevents measuring through an intermediate redaction.

The best line bucket is chosen by:
1. Maximum number of matches (prefer having both before + after)
2. Minimum total distance (tiebreaker)

### 4. Average Space Calculation

The average inter-word space on the best matching line is calculated by measuring gaps between consecutive words:

```python
gap_px = (w2_x0 - w1_x2) * pts_to_px_x
```

Only gaps between 3 and 11 pixels are included. The result defaults to 9.5 px if no valid gaps are found.

### 5. Edge Refinement

#### Left edge (`expected_x1`)
- Start with: `word_before_right_edge + average_space`
- If this position falls in a white area (not inside the box nor any word), scan rightward for the nearest content boundary:
  - Check word positions and other box edges
  - If base image bytes are provided, do a column-by-column pixel scan looking for dark pixels (< 250 luminance)
- Snap to the nearest boundary found

#### Right edge (`expected_x2`)
- Start with: `word_after_left_edge - average_space`
- Same white-area scanning logic but in the leftward direction (pixels < 255 luminance)

### 6. Return

Returns `(expected_x1, expected_x2)` for each box. The caller (ProcessRedactions) applies a 25% tolerance check before using these refined values.

---

## Constraints & Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Vertical overlap threshold | 50% | Minimum word-box vertical overlap to be on the same line |
| Line bucket tolerance | 5 pts | Maximum y-midpoint distance to group words into a line |
| Inter-word gap range | 3–11 px | Valid range for space width calculation |
| Default space width | 9.5 px | Used when no valid gaps are found |
| Obstruction tolerance | 0 pts | Any intervening box blocks the word-to-box connection |
| Dark pixel threshold (left) | < 250 | Luminance below which a pixel is considered "content" |
| Dark pixel threshold (right) | < 255 | Slightly stricter for right-edge scanning |
