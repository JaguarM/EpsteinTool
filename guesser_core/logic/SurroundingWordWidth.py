import numpy as np
import cv2

# --- VISUAL DEBUGGING ---
# Add custom letters to simulate what OCR might find that ETV missed.
# For example, if ETV is "nd" and OCR is "and", put "a" in DEBUG_EXTRA_TEXT_LEFT.
# The script will approximate the width of these letters and tighten the redaction box.
DEBUG_EXTRA_TEXT_LEFT = ""
DEBUG_EXTRA_TEXT_RIGHT = ""
# ------------------------

def estimate_widths_for_boxes(page, boxes, img_rect, img_w, img_h, base_image_bytes=None):
    """
    Measures width of text based on surrounding words.
    Returns a list of expected pixel widths corresponding to the input boxes.
    If an expected width cannot be calculated, the list contains None at that index.
    """
    img = None
    if base_image_bytes is not None:
        img_array = np.frombuffer(base_image_bytes, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_GRAYSCALE)
    words_pts = page.get_text("words")
    px_to_pts_x = img_rect.width / img_w
    px_to_pts_y = img_rect.height / img_h
    pts_to_px_x = 1.0 / px_to_pts_x
    pts_to_px_y = 1.0 / px_to_pts_y

    boxes_pts = []
    for b in boxes:
        boxes_pts.append({
            'x0': img_rect.x0 + b[0] * px_to_pts_x,
            'y0': img_rect.y0 + b[1] * px_to_pts_y,
            'x1': img_rect.x0 + b[2] * px_to_pts_x,
            'y1': img_rect.y0 + b[3] * px_to_pts_y,
            'bx1': b[0], 'by1': b[1], 'bx2': b[2], 'by2': b[3]
        })

    expected_widths = []

    for b_dict in boxes_pts:
        bx1, by1, bx2, by2 = b_dict['bx1'], b_dict['by1'], b_dict['bx2'], b_dict['by2']
        bx_pts, by_pts = b_dict['x0'], b_dict['y0']
        bx1_pts, by1_pts = b_dict['x1'], b_dict['y1']

        buckets = []
        for w in words_pts:
            wy0, wy1 = w[1], w[3]
            height_word = wy1 - wy0
            if height_word <= 0: continue

            overlap_y = max(0, min(by1_pts, wy1) - max(by_pts, wy0))
            if overlap_y / height_word >= 0.5:
                wy_mid = (wy0 + wy1) / 2
                matched_bucket = None
                for bucket in buckets:
                    if abs(bucket['mid'] - wy_mid) < 5:
                        matched_bucket = bucket
                        break
                if matched_bucket:
                    matched_bucket['words'].append(w)
                    matched_bucket['mid'] = sum((ww[1]+ww[3])/2 for ww in matched_bucket['words']) / len(matched_bucket['words'])
                else:
                    buckets.append({'mid': wy_mid, 'words': [w]})

        best_match = None
        best_dist_sum = float('inf')
        best_matches_count = 0
        best_line_words = []

        for bucket in buckets:
            line_words = bucket['words']
            line_words.sort(key=lambda w: w[0])

            word_before = None
            dist_before = float('inf')
            for w in line_words:
                if w[2] <= bx_pts + 5:
                    obstructed = False
                    for ob in boxes_pts:
                        if ob == b_dict: continue
                        y_overlap = max(0, min(by1_pts, ob['y1']) - max(by_pts, ob['y0']))
                        if y_overlap > 0:
                            if ob['x1'] > w[2] and ob['x0'] < bx_pts:
                                obstructed = True
                                break
                    if not obstructed:
                        dist = bx_pts - w[2]
                        if dist < dist_before:
                            dist_before = dist
                            word_before = w

            word_after = None
            dist_after = float('inf')
            for w in line_words:
                if w[0] >= bx1_pts - 5:
                    obstructed = False
                    for ob in boxes_pts:
                        if ob == b_dict: continue
                        y_overlap = max(0, min(by1_pts, ob['y1']) - max(by_pts, ob['y0']))
                        if y_overlap > 0:
                            if ob['x1'] > bx1_pts and ob['x0'] < w[0]:
                                obstructed = True
                                break
                    if not obstructed:
                        dist = w[0] - bx1_pts
                        if dist < dist_after:
                            dist_after = dist
                            word_after = w

            matches_count = (1 if word_before else 0) + (1 if word_after else 0)
            if matches_count > 0:
                dist_sum = (dist_before if word_before else 0) + (dist_after if word_after else 0)
                if matches_count > best_matches_count or (matches_count == best_matches_count and dist_sum < best_dist_sum):
                    best_matches_count = matches_count
                    best_dist_sum = dist_sum
                    best_match = (word_before, word_after)
                    best_line_words = line_words

        if best_match:
            word_before, word_after = best_match

            space_px = 9.5
            calculated_space_px = 0
            space_count = 0

            for i in range(len(best_line_words) - 1):
                w1 = best_line_words[i]
                w2 = best_line_words[i+1]
                gap_px = (w2[0] - w1[2]) * pts_to_px_x
                if 3 <= gap_px <= 11:
                    calculated_space_px += gap_px
                    space_count += 1

            if space_count > 0:
                avg_space_px = calculated_space_px / space_count
                if 3 <= avg_space_px <= 11:
                    space_px = avg_space_px

            def _is_touching_left():
                """Return True if dark pixels are found immediately left of the box."""
                if img is None:
                    return False
                x_start = max(0, int(bx1) - 5)
                x_end = max(0, int(bx1))
                if x_start >= x_end:
                    return False
                strip = img[int(by1):int(by2), x_start:x_end]
                return bool(np.any(strip < 230))

            def _is_touching_right():
                """Return True if dark pixels are found immediately right of the box."""
                if img is None:
                    return False
                x_start = min(int(img_w), int(bx2))
                x_end = min(int(img_w), int(bx2) + 5)
                if x_start >= x_end:
                    return False
                strip = img[int(by1):int(by2), x_start:x_end]
                return bool(np.any(strip < 230))

            expected_x1_px = None

            if word_before:
                # Trust the ETV directly: word_before right edge + one space.
                # The position may land inside the box when the box was painted over the space gap —
                # that is correct and intentional; do not clamp or override with pixel scans.
                word_before_x2_px = (word_before[2] - img_rect.x0) * pts_to_px_x
                debug_offset_left = len(DEBUG_EXTRA_TEXT_LEFT) * 6.5 if DEBUG_EXTRA_TEXT_LEFT else 0
                expected_x1_px = word_before_x2_px + space_px + debug_offset_left
            elif _is_touching_left():
                # No ETV word before the box but a letter is visually touching the left edge.
                expected_x1_px = bx1 - space_px

            expected_x2_px = None

            if word_after:
                # Trust the ETV directly: word_after left edge - one space.
                word_after_x1_px = (word_after[0] - img_rect.x0) * pts_to_px_x
                debug_offset_right = len(DEBUG_EXTRA_TEXT_RIGHT) * 6.5 if DEBUG_EXTRA_TEXT_RIGHT else 0
                expected_x2_px = word_after_x1_px - space_px - debug_offset_right
            elif _is_touching_right():
                # No ETV word after the box but a letter is visually touching the right edge.
                expected_x2_px = bx2 + space_px

            expected_height_px = None
            if best_line_words:
                heights_pts = [w[3] - w[1] for w in best_line_words if w[3] - w[1] > 0]
                if heights_pts:
                    expected_height_px = (sum(heights_pts) / len(heights_pts)) * pts_to_px_y

            expected_widths.append((expected_x1_px, expected_x2_px, expected_height_px))
        else:
            expected_widths.append((None, None, None))

    return expected_widths
