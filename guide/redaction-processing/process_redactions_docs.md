# ProcessRedactions.py Documentation

[ProcessRedactions.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/ProcessRedactions.py) is the main handler script for calculating the coordinates and dimensions of redaction boxes found in PDF documents. It acts as the orchestrator by taking the base box detection from [BoxDetector.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/BoxDetector.py) and refining it with the text-width estimation from [SurroundingWordWidth.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/SurroundingWordWidth.py).

It can be run standalone to generate text file logs, or imported by other scripts (like [VisualizeRedactions.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/VisualizeRedactions.py) or [PrintRedactionsData.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/PrintRedactionsData.py)) to access its core extraction logic and coordinate data directly.

## Core Functions

### 1. [extract_redaction_data_from_pdf(doc)](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/ProcessRedactions.py#7-99)
This is the central logic function of the script. It takes a loaded `fitz.Document` (PyMuPDF) object as input and processes all pages to extract redaction box data.

**Returns:**
A list of dictionaries representing the pages that contain redactions.
```python
[
    {
        "page_num": 1,        # 1-indexed page number
        "page_index": 0,      # 0-indexed page index
        "boxes": [ ... ]      # List of redaction box data dictionaries
    },
    ...
]
```

**Box Data Structure ([boxes](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/BoxDetector.py#110-131) list):**
Each item inside the [boxes](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/BoxDetector.py#110-131) list is a dictionary containing the comprehensive calculations for a single redaction:
*   `original_box` (tuple): The [(x1, y1, x2, y2)](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/ProcessRedactions.py#100-132) pixel coordinates as originally detected by `BoxDetector`.
*   `final_box` (tuple): The [(x1, y1, x2, y2)](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/ProcessRedactions.py#100-132) pixel coordinates after being refined by `SurroundingWordWidth` (if the 25% tolerance check passes).
*   `source` (string): Indicates the primary source of the coordinates (`"BoxDetector"` or `"SurroundingWordWidth"`).
*   `source_x1` (string): The specific source logic used for the left edge (`x1`).
*   `source_x2` (string): The specific source logic used for the right edge (`x2`).
*   `img_rect` (fitz.Rect): The physical rectangle coordinates of the image where the redaction was found on the PDF page.
*   `px_to_pts_x` (float): The conversion ratio to turn X pixel coordinates into PDF points.
*   `px_to_pts_y` (float): The conversion ratio to turn Y pixel coordinates into PDF points.

### 2. [process_pdf(pdf_path)](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/ProcessRedactions.py#100-132)
This function takes a file path to a PDF, runs the extraction logic, and outputs the results as a human-readable log.

**Outputs:**
1.  **Terminal Output (Standard Out):** Prints each detected redaction to the console.
    *   *Example Output:* `Page 1 Redaction Box (X1:202.00, Y1:438, X2:324.53, Y2:454) [Source: SurroundingWordWidth] (Original X1:203, X2:321)`
2.  **`RedactionOutput.txt`:** Writes a text file in the working directory containing a complete log of all the lines printed to the console during execution across all PDFs processed.

## Modifiable Logic Parameters
*   **Tolerance Check (`diff_pct <= 0.25`):** [ProcessRedactions.py](file:///c:/Users/yanni/Desktop/EpsteinTool/guesser/logic/ProcessRedactions.py) will only use the `SurroundingWords` coordinates if the calculated width difference is less than or equal to `25%` of the originally detected `BoxDetector` width. Otherwise, it defaults back to the `BoxDetector` coordinates.
