import fitz
import numpy as np
import cv2

def find_redaction_boxes_in_image(image_bytes):
    """
    Decodes image bytes and finds pure black rectangular boxes (>= 17x10).
    Uses a row-by-row scan algorithm handles crosses and ladders by tracking contained runs.
    """
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    
    if img is None:
        return [], 0, 0
        
    if len(img.shape) == 2:
        gray = img
    elif img.shape[2] == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    elif img.shape[2] == 4:
        gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    else:
        gray = img
        
    # threshold for pure black
    mask = gray < 10
    
    boxes = []
    active_runs = {} # (sx, ex) -> {'start_y': y, 'history': []}
    
    height = mask.shape[0]
    
    for y in range(height):
        row_mask = mask[y]
        
        # pad with False to easily find runs using np.diff
        padded = np.concatenate(([False], row_mask, [False]))
        diff = np.diff(padded.astype(np.int8))
        
        run_starts = np.where(diff == 1)[0]
        run_ends = np.where(diff == -1)[0]
        
        current_segments = []
        for sx, ex in zip(run_starts, run_ends):
            if ex - sx >= 17:
                current_segments.append((sx, ex))
                
        next_active_runs = {}
        claimed_current = set()
        
        for run, run_data in active_runs.items():
            sx, ex = run
            survives = False
            survived_csx, survived_cex = None, None
            for (csx, cex) in current_segments:
                # The active run survives if it is mostly contained within a current segment
                if csx <= sx + 2 and cex >= ex - 2:
                    survives = True
                    survived_csx = csx
                    survived_cex = cex
                    break
            
            if survives:
                last_hx, last_hex = run_data['history'][-1]
                if abs((survived_cex - survived_csx) - (last_hex - last_hx)) <= 6:
                    claimed_current.add((survived_csx, survived_cex))
                new_history = run_data['history'] + [(survived_csx, survived_cex)]
                next_active_runs[run] = {'start_y': run_data['start_y'], 'history': new_history}
            else:
                start_y = run_data['start_y']
                h = y - start_y
                if h >= 10:
                    # Filter out circular hole-punches by checking if the top and bottom edges are tapered.
                    core_x = max(hx for hx, _ in run_data['history'])
                    core_ex = min(hex for _, hex in run_data['history'])
                    
                    if core_ex - core_x >= 17:
                        width = int(core_ex - core_x)
                        missing_top = width - int(np.sum(mask[start_y - 1, core_x:core_ex])) if start_y > 0 else width
                        missing_bottom = width - int(np.sum(mask[y, core_x:core_ex])) if y < height else width
                        
                        # If BOTH ends are tapered (small missing pixels, but not 0 since otherwise it would have continued) 
                        if missing_top <= width * 0.3 and missing_bottom <= width * 0.3:
                            pass # Reject tapered shape (circle)
                        else:
                            boxes.append((int(core_x), start_y, int(core_ex), start_y + h))
                    
        for c_run in current_segments:
            if c_run not in claimed_current and c_run not in next_active_runs:
                next_active_runs[c_run] = {'start_y': y, 'history': [(c_run[0], c_run[1])]}
                
        active_runs = next_active_runs
        
    for run, run_data in active_runs.items():
        sx, ex = run
        start_y = run_data['start_y']
        h = height - start_y
        if h >= 10:
            core_x = max(hx for hx, _ in run_data['history'])
            core_ex = min(hex for _, hex in run_data['history'])
            
            if core_ex - core_x >= 17:
                width = int(core_ex - core_x)
                missing_top = width - int(np.sum(mask[start_y - 1, core_x:core_ex])) if start_y > 0 else width
                missing_bottom = width
                if missing_top <= width * 0.3 and missing_bottom <= width * 0.3:
                    pass
                else:
                    boxes.append((int(core_x), start_y, int(core_ex), start_y + h))
            
    def clean_overlapping_boxes(raw_boxes):
        cleaned = []
        for i, (ax1, ay1, ax2, ay2) in enumerate(raw_boxes):
            new_ay2 = ay2
            aw = ax2 - ax1
            for j, (bx1, by1, bx2, by2) in enumerate(raw_boxes):
                if i == j: continue
                bw = bx2 - bx1
                # If B starts during A
                if ay1 < by1 < ay2:
                    # If B horizontally mostly contains A 
                    if bx1 <= ax1 + 2 and bx2 >= ax2 - 2:
                        # If B is significantly wider (it's the 'base' of the intersecting T)
                        if bw >= aw + 10:
                            # If they end at roughly the same Y (upward T)
                            if abs(ay2 - by2) <= 5:
                                if by1 < new_ay2:
                                    new_ay2 = by1
            if new_ay2 - ay1 >= 10:
                cleaned.append((ax1, ay1, ax2, new_ay2))
        return cleaned

    boxes = clean_overlapping_boxes(boxes)
    # Deduplicate and sort
    final_boxes = sorted(list(set(boxes)), key=lambda b: (b[1], b[0]))
    return final_boxes, img.shape[1], img.shape[0]

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
            wx0, wy0, wx1, wy1, text, block_no, line_no, word_no = w
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
            expected_x1_px = None
            
            if word_before:
                # Word before right edge + space
                word_before_x2_px = (word_before[2] - img_rect.x0) * pts_to_px_x
                expected_x1_px = word_before_x2_px + space_px
                
                # Check if expected_x1_px is in a completely white area
                in_white = True
                if bx1 <= expected_x1_px <= bx2:
                    in_white = False
                for w in best_line_words:
                    w_x0_px = (w[0] - img_rect.x0) * pts_to_px_x
                    w_x2_px = (w[2] - img_rect.x0) * pts_to_px_x
                    if w_x0_px <= expected_x1_px <= w_x2_px:
                        in_white = False
                        break
                
                # If white area, move expected_x1_px closer (right) to next text or redaction
                if in_white:
                    next_boundary = bx1 if bx1 > expected_x1_px else None
                    for w in best_line_words:
                        w_x0_px = (w[0] - img_rect.x0) * pts_to_px_x
                        if w_x0_px > expected_x1_px:
                            if next_boundary is None or w_x0_px < next_boundary:
                                next_boundary = w_x0_px
                    
                    if img is not None:
                        start_x = max(0, int(expected_x1_px))
                        end_x = int(bx1)
                        if start_x < end_x:
                            for x in range(start_x, end_x):
                                col = img[int(by1):int(by2), x]
                                if np.any(col < 250):
                                    if next_boundary is None or x < next_boundary:
                                        next_boundary = x
                                    break

                    if next_boundary is not None:
                        expected_x1_px = next_boundary
            
            expected_x2_px = None
            if word_after:
                # Word after left edge - space
                word_after_x1_px = (word_after[0] - img_rect.x0) * pts_to_px_x
                expected_x2_px = word_after_x1_px - space_px
                
                # Check if expected_x2_px is in a completely white area
                in_white = True
                if bx1 <= expected_x2_px <= bx2:
                    in_white = False
                for w in best_line_words:
                    w_x0_px = (w[0] - img_rect.x0) * pts_to_px_x
                    w_x2_px = (w[2] - img_rect.x0) * pts_to_px_x
                    if w_x0_px <= expected_x2_px <= w_x2_px:
                        in_white = False
                        break
                        
                # If white area, move expected_x2_px closer (left) to next text or redaction
                if in_white:
                    next_boundary = bx2 if bx2 < expected_x2_px else None
                    for w in best_line_words:
                        w_x2_px = (w[2] - img_rect.x0) * pts_to_px_x
                        if w_x2_px < expected_x2_px:
                            if next_boundary is None or w_x2_px > next_boundary:
                                next_boundary = w_x2_px
                                
                    if img is not None:
                        start_x = min(int(img_w) - 1, int(expected_x2_px))
                        end_x = int(bx2)
                        if start_x > end_x:
                            for x in range(start_x, end_x, -1):
                                col = img[int(by1):int(by2), x]
                                if np.any(col < 255):
                                    if next_boundary is None or x > next_boundary:
                                        next_boundary = x
                                    break
                                    
                    if next_boundary is not None:
                        expected_x2_px = next_boundary
            
            expected_widths.append((expected_x1_px, expected_x2_px))
        else:
            expected_widths.append((None, None))
            
    return expected_widths

def process_pdf(pdf_bytes):
    """
    Process a PDF file (bytes) to detect black bars and extract font info.
    Returns:
        {
            "redactions": [ { "page": int, "width": float, "height": float, "area": float, "y": float, "x": float } ],
            "spans": [ { "page": int, "text": str, "font": { "size": float, "flags": int, "font": str } } ]
        }
    """
    redactions = []
    text_spans = []

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"Error opening PDF stream: {e}")
        return {"error": str(e), "redactions": [], "spans": []}

    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1

        # 1. Extract Text Spans for Font Detection
        try:
            page_dict = page.get_text("dict")
            for block in page_dict.get("blocks", []):
                if block.get("type") == 0:  # text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text_spans.append({
                                "page": page_num,
                                "text": span.get("text", "").strip(),
                                "font": {
                                    "size": span.get("size", 0),
                                    "flags": span.get("flags", 0),
                                    "matched_font": span.get("font", "unknown")
                                }
                            })
        except Exception as e:
            print(f"Error extracting text spans on page {page_num}: {e}")

        # 2. Extract images and perform redaction box detection
        try:
            image_list = page.get_images(full=True)
            if not image_list:
                continue
                
            for img_info in image_list:
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    if not base_image: continue
                    
                    image_ext = base_image.get("ext", "").lower()
                    if image_ext not in ('png', 'tiff', 'tif'):
                        continue
                    
                    img_bytes = base_image["image"]
                    boxes, img_w, img_h = find_redaction_boxes_in_image(img_bytes)
                    if not boxes: continue
                    
                    image_rects = page.get_image_rects(xref)
                    if not image_rects: continue
                    img_rect = image_rects[0]
                    
                    expected_widths = estimate_widths_for_boxes(page, boxes, img_rect, img_w, img_h, img_bytes)
                    
                    for i, box in enumerate(boxes):
                        bx1, by1, bx2, by2 = box
                        expected_data = expected_widths[i]
                        
                        final_x1 = float(bx1)
                        final_x2 = float(bx2)
                        
                        if expected_data[0] is not None or expected_data[1] is not None:
                            expected_x1, expected_x2 = expected_data
                            
                            temp_x1 = expected_x1 if expected_x1 is not None else float(bx1)
                            temp_x2 = expected_x2 if expected_x2 is not None else float(bx2)
                            
                            bw = bx2 - bx1
                            new_w = temp_x2 - temp_x1
                            
                            # Check if within 25% range
                            diff_pct = abs(new_w - bw) / bw
                            if diff_pct <= 0.25:
                                final_x1 = temp_x1
                                final_x2 = temp_x2

                        w = final_x2 - final_x1
                        h = by2 - by1
                        area = w * h
                        
                        redactions.append({
                            "page": page_num,
                            "x": float(final_x1),
                            "y": float(by1),
                            "width": float(w),
                            "height": float(h),
                            "area": float(area)
                        })
                        
                except Exception as e:
                    print(f"Error processing image xref {xref} on page {page_num}: {e}")
        except Exception as e:
            print(f"Error extracting images on page {page_num}: {e}")

    # Sort redactions: Top-to-bottom, Left-to-right
    redactions.sort(key=lambda b: (b["page"], b["y"], b["x"]))

    doc.close()
    return {"redactions": redactions, "spans": text_spans}
