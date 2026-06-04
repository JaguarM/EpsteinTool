import numpy as np
import cv2


def _is_glyph_col(col, dark_thresh=160, min_dark_px=2, max_dark_frac=0.8):
    """
    True if a pixel column looks like part of a letter rather than the box's own
    edge or blank paper.

    A glyph darkens at least `min_dark_px` rows but fewer than `max_dark_frac` of
    the column. Redaction boxes are painted taller than the text they hide, so
    the box's anti-aliased edge runs dark down the *whole* column, whereas a
    letter — or the sliver of one poking past the paint — only darkens the text
    rows in the middle. Flat background has no dark rows at all. This height test
    separates a poking glyph from the box edge far more reliably than pixel
    darkness alone (the box's own AA can be as dark as ink).
    """
    n_dark = int(np.count_nonzero(col < dark_thresh))
    return min_dark_px <= n_dark < max_dark_frac * len(col)


def _content_edge(img, ink_edge_px, direction, y0, y1, bound_px):
    """
    Walk outward from a box's ink edge through contiguous glyph ink and return
    the refined edge (in image px).

    BoxDetector reports the *pure-black* extent of the redaction, but the true
    visual extent is sometimes a hair wider: a glyph of the hidden text can poke
    past the paint (e.g. the left bowl of an "S" sticking out of the box). This
    walk, starting just outside the ink edge, absorbs every column that looks
    like such a poking glyph (including its faint anti-aliased fringe) and stops
    at the first column that does not — so a poking letter is kept whole, while
    the empty inter-word gap (and any neighbouring word beyond it) is left out.

    direction: -1 refines the left edge (scan leftwards, returns the new x0);
               +1 refines the right edge (scan rightwards, returns the new x1).
    bound_px:  near edge of the neighbouring word; the scan never crosses it, so
               a box that physically touches the next word can't swallow it.
    """
    if img is None:
        return float(ink_edge_px)
    h, w = img.shape[:2]
    y0 = max(0, int(y0))
    y1 = min(h, int(y1))
    if y1 - y0 < 2:
        return float(ink_edge_px)

    edge = float(ink_edge_px)
    x = int(round(ink_edge_px))
    while True:
        col_x = x - 1 if direction < 0 else x
        if col_x < 0 or col_x >= w:
            break
        if direction < 0 and col_x < int(bound_px):
            break
        if direction > 0 and col_x >= int(bound_px):
            break

        if not _is_glyph_col(img[y0:y1, col_x]):
            break  # box-edge anti-alias or background whitespace -> stop

        if direction < 0:
            edge = float(col_x)
            x = col_x
        else:
            edge = float(col_x + 1)
            x = col_x + 1
    return edge


def _next_word_edge(img, start_px, direction, y0, y1, bound_px):
    """
    Scan outward from a box's content edge, across the inter-word whitespace, and
    return the near ink edge (px) of the next word's glyphs — or None if no word
    is reached before bound_px.

    This is found from PIXELS on purpose: when a redaction covers the first
    letter of the following word, PyMuPDF's text layer reports only the visible
    fragment ("nd" for "and") sitting where the fragment starts, not where the
    word visually begins. Locating the word by its ink avoids that error. The
    box's own full-height anti-aliased edge is skipped by the same glyph test, so
    a box flush against the next word is still measured.
    """
    if img is None:
        return None
    h, w = img.shape[:2]
    y0 = max(0, int(y0))
    y1 = min(h, int(y1))
    if y1 - y0 < 2:
        return None

    col_x = int(round(start_px)) if direction > 0 else int(round(start_px)) - 1
    while 0 <= col_x < w:
        if direction > 0 and col_x >= int(bound_px):
            return None
        if direction < 0 and col_x < int(bound_px):
            return None
        if _is_glyph_col(img[y0:y1, col_x]):
            return float(col_x + 1) if direction < 0 else float(col_x)
        col_x += direction
    return None


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

            # Near edge of each neighbouring (non-redacted) word in image px, or
            # the page border when there is none on that side.
            left_bound = (word_before[2] - img_rect.x0) * pts_to_px_x if word_before else 0.0
            right_bound = (word_after[0] - img_rect.x0) * pts_to_px_x if word_after else float(img_w)

            # Average inter-word space on this line, in image px (clamped to a
            # sane range so a sparse line can't produce a wild value).
            gaps = [(best_line_words[i + 1][0] - best_line_words[i][2]) * pts_to_px_x
                    for i in range(len(best_line_words) - 1)]
            gaps = [g for g in gaps if 3 <= g <= 11]
            space_px = sum(gaps) / len(gaps) if gaps else 5.0
            space_px = min(max(space_px, 3.0), 8.0)

            # Inset the vertical band so the box's own top/bottom corners are not
            # mistaken for edge content.
            y0_scan = int(by1) + 2
            y1_scan = int(by2) - 2

            # Pixel extent of the box: its ink plus any glyph of the hidden text
            # that pokes past the paint (e.g. the bowl of an "S"), stopping at the
            # inter-word whitespace.
            content_x1 = _content_edge(img, bx1, -1, y0_scan, y1_scan, left_bound)
            content_x2 = _content_edge(img, bx2, +1, y0_scan, y1_scan, right_bound)

            # Where the box was painted over the inter-word space, its edge sits
            # past the hidden text inside that gap. We can't see the covered
            # letters, but we can locate the next word by its pixels and back off
            # one space to reconstruct the true edge. The redaction edge is the
            # innermost of the painted extent and "neighbour minus a space", so a
            # poking glyph still wins (it is real ink) while a box that overran
            # the gap is pulled back.
            nbr_l = _next_word_edge(img, content_x1, -1, y0_scan, y1_scan,
                                    (left_bound - 6.0) if word_before else (content_x1 - 14.0))
            nbr_r = _next_word_edge(img, content_x2, +1, y0_scan, y1_scan,
                                    (right_bound + 6.0) if word_after else (content_x2 + 14.0))

            expected_x1_px = content_x1
            if nbr_l is not None:
                expected_x1_px = max(content_x1, nbr_l + space_px)

            expected_x2_px = content_x2
            if nbr_r is not None:
                expected_x2_px = min(content_x2, nbr_r - space_px)

            expected_height_px = None
            if best_line_words:
                heights_pts = [w[3] - w[1] for w in best_line_words if w[3] - w[1] > 0]
                if heights_pts:
                    expected_height_px = (sum(heights_pts) / len(heights_pts)) * pts_to_px_y

            expected_widths.append((expected_x1_px, expected_x2_px, expected_height_px))
        else:
            expected_widths.append((None, None, None))

    return expected_widths
