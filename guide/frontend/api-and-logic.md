# API & Candidate Logic — `api.js`

[api.js](https://github.com/JaguarM/EpsteinTool/blob/main/redaction_matching/static/redaction_matching/api.js) manages the candidate name list, sends width calculation requests to the backend, renders the candidates table, and matches candidate widths against redaction box widths.

## Candidate Management

### `addName()`
Reads from the name input field, adds to `state.candidates` if not a duplicate, then triggers width recalculation.

### `processPaste()`
Reads multi-line text from the paste textarea, adds each non-empty, non-duplicate line to `state.candidates`.

### `clearAll()`
Prompts confirmation, then clears all candidates and re-renders.

### `removeName(name)`
Removes a specific candidate and triggers recalculation.

## Width Calculation

### `calculateAllWidths()`
Sends one `POST /widths` request per redaction (in parallel via `Promise.all`), using each redaction's individual `settings` (font, size, scale, kerning, ligatures).

### `calculateWidthsForRedaction(idx)`
Sends a single width calculation request for the candidate list using the settings of redaction `idx`. Stores results in `redaction.widths[candidateName] = measuredWidth`.

## Rendering

### `renderCandidates()`
Renders the paginated candidates table in the sidebar. Shows name, measured width, and a delete button. Supports sorting by name or width.

### `selectRedaction(idx)`
Selects a redaction by index: navigates to its page, updates the settings controls, highlights the redaction overlay and the match table row, then re-renders candidates.

### `updateAllMatchesView(onlyIdx?)`
Re-renders the "All Matches" table. For each redaction, finds candidates whose width is within the tolerance. Updates the overlay label text (unless manually overridden). Shows match count summary.

## Helper

### `getFontFamily(fontName)`
Maps font filenames to CSS font-family strings:
- `times` → `"Times New Roman", serif`
- `arial` → `Arial, sans-serif`
- `calibri` → `Calibri, sans-serif`
- `cour` → `"Courier New", monospace`
