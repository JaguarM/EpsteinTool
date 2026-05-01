// unified-text-box.js
// Single source-of-truth data model for all text on the page.
// Replaces etvState.spans[] and state.redactions[] with one array.

let _utbIdCounter = 0;
function nextUtbId() { return `utb-${++_utbIdCounter}`; }

class UnifiedTextBox {
  constructor(data) {
    this.id          = data.id || nextUtbId();
    this.type        = data.type || 'embedded'; // 'embedded' | 'redaction' | 'harfbuzz'
    this.page        = data.page || 1;
    this.text        = data.text || '';
    this.lineId      = data.lineId || null;

    // Spatial (document pixel space — 816×1056 base)
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.w = data.w || 0;
    this.h = data.h || 0;

    // Typography
    this.fontFamily    = data.fontFamily || 'Times New Roman';
    this.fontSize      = data.fontSize   || 12;
    this.sizePt        = data.sizePt     || null;  // PDF points (for HarfBuzz calls)
    this.bold          = data.bold       || false;
    this.italic        = data.italic     || false;
    this.underline     = data.underline  || false;
    this.strikethrough = data.strikethrough || false;
    this.letterSpacing = data.letterSpacing || 0;
    this.color         = data.color      || null;  // null = per-type default

    // Justification
    this.kerning   = data.kerning   || false;
    this.ligatures = data.ligatures || false;
    this.justify   = data.justify   || false;
    this.spaceWidth = data.spaceWidth || null; // null = HarfBuzz auto

    // Per-character positioning: [{c, x, w}] offsets relative to box.x
    this.baseCharPositions = data.baseCharPositions || null;

    // Micro-typography: index → delta px (overrides applied on top of baseCharPositions)
    this.charAdvances = data.charAdvances || {};

    // Redaction-only fields
    this.widths     = data.widths     || {};  // candidate → pixel width
    this.labelText  = data.labelText  || '';
    this.tolerance  = data.tolerance  || 3;
    this.manualLabel = data.manualLabel || false;

    // Render font override (e.g. 'times.ttf') — null = use fontFamily
    this.renderFont = data.renderFont || null;
  }
}


// ── Global State ──────────────────────────────────────────────

const utbState = {
  boxes: [],          // UnifiedTextBox[]
  selectedId: null,   // id of currently selected box
  microTypoId: null,  // id of box in micro-typography mode
  microTypoCharIdx: null,

  addBox(data) {
    const box = data instanceof UnifiedTextBox ? data : new UnifiedTextBox(data);
    this.boxes.push(box);
    return box;
  },

  getBox(id) {
    return this.boxes.find(b => b.id === id) || null;
  },

  removeBox(id) {
    const idx = this.boxes.findIndex(b => b.id === id);
    if (idx !== -1) this.boxes.splice(idx, 1);
  },

  updateBox(id, patch) {
    const box = this.getBox(id);
    if (box) Object.assign(box, patch);
    return box;
  },

  getPageBoxes(pageNum) {
    return this.boxes.filter(b => b.page === pageNum);
  },

  reset() {
    this.boxes        = [];
    this.selectedId   = null;
    this.microTypoId  = null;
    this.microTypoCharIdx = null;
  },
};


// ── Conversion helpers ────────────────────────────────────────

/**
 * Convert a server-side ETV span dict (from /api/extract-spans) to UnifiedTextBox.
 * Span schema: {page, text, x, y, w, h, fontSize, sizePt, font, flags,
 *               lineId, chars:[{c,x,w}], fontWeight, fontStyle, ...}
 */
function spanToUnified(span) {
  const font = span.font || '';
  const isBold   = /bold/i.test(font)           || span.fontWeight === 'bold'  || !!(span.flags & 16);
  const isItalic = /italic|oblique/i.test(font) || span.fontStyle  === 'italic' || !!(span.flags & 2);

  return new UnifiedTextBox({
    type:    'embedded',
    page:    span.page,
    text:    span.text,
    lineId:  span.lineId || null,
    x: span.x, y: span.y, w: span.w, h: span.h,
    fontFamily:   normUtbFont(font) || 'Times New Roman',
    fontSize:     span.fontSize,
    sizePt:       span.sizePt || null,
    bold:         isBold,
    italic:       isItalic,
    letterSpacing: parseFloat(span.letterSpacing) || 0,
    color:        span.color || null,
    baseCharPositions: span.chars?.length ? span.chars : null,
  });
}

/**
 * Convert an existing redaction dict (from state.redactions[]) to UnifiedTextBox.
 * Redaction schema: {page, x, y, width, height, lineId, settings:{fontFamily, fontSize, ...},
 *                    widths:{}, labelText, manualLabel}
 */
function redactionToUnified(r, legacyIdx) {
  const s = r.settings || {};
  return new UnifiedTextBox({
    type:    'redaction',
    page:    r.page,
    text:    r.labelText || '',
    lineId:  r.lineId || null,
    x: r.x, y: r.y, w: r.width, h: r.height,
    fontFamily:   s.fontFamily  || 'Times New Roman',
    fontSize:     s.fontSize    || 12,
    bold:         !!s.bold,
    italic:       !!s.italic,
    letterSpacing: parseFloat(s.letterSpacing) || 0,
    color:        s.color || null,
    kerning:      !!s.kern,
    ligatures:    !!s.lig,
    widths:       r.widths      || {},
    labelText:    r.labelText   || '',
    tolerance:    s.tol         || 3,
    manualLabel:  r.manualLabel || false,
    // keep a back-reference so redaction matching code can sync
    _legacyIdx:   legacyIdx,
  });
}

/**
 * Normalize a raw PDF font name to a CSS-safe family string.
 * Mirrors normFont() in embedded-text-viewer.js.
 */
function normUtbFont(name) {
  if (!name) return '';
  const n  = name.replace(/^[A-Z]{6}\+/, '').split(',')[0].trim();
  const lc = n.toLowerCase().replace(/[\s\-_]/g, '');
  if (lc.includes('times'))   return 'Times New Roman';
  if (lc.includes('arial'))   return 'Arial';
  if (lc.includes('courier')) return 'Courier New';
  if (lc.includes('verdana')) return 'Verdana';
  if (lc.includes('calibri')) return 'Calibri';
  if (lc.includes('segoe'))   return 'Segoe UI';
  return n;
}

// Expose globals
window.UnifiedTextBox     = UnifiedTextBox;
window.utbState           = utbState;
window.spanToUnified      = spanToUnified;
window.redactionToUnified = redactionToUnified;
window.normUtbFont        = normUtbFont;


// ── Adapter functions for legacy consumers ────────────────────

/**
 * Find the nearest embedded text line to a Y coordinate on a page.
 * Drop-in replacement for findNearestETVLine().
 * Returns { y, h, lineId, font, fontSize } or null.
 */
function utbFindNearestLine(pageNum, y, threshold = 2.0) {
  const pageBoxes = utbState.boxes.filter(b => b.page === pageNum && b.type === 'embedded');
  if (!pageBoxes.length) return null;

  let nearest = null;
  let minDist = Infinity;
  for (const b of pageBoxes) {
    const cy = b.y + b.h / 2;
    const d  = Math.abs(cy - y);
    if (d < minDist) { minDist = d; nearest = b; }
  }
  if (!nearest || minDist > nearest.h * threshold) return null;

  return {
    y:        nearest.y,
    h:        nearest.h,
    lineId:   nearest.lineId,
    font:     nearest.fontFamily,
    fontSize: nearest.fontSize,
  };
}

/**
 * Get an etvState.spans-compatible array for legacy consumers (/widths endpoint).
 * Returns embedded boxes with the schema the backend expects.
 */
function utbGetSpansCompat() {
  return utbState.boxes
    .filter(b => b.type === 'embedded')
    .map(b => ({
      page:     b.page,
      text:     b.text,
      x:        b.x,
      y:        b.y,
      w:        b.w,
      h:        b.h,
      lineId:   b.lineId,
      chars:    b.baseCharPositions,
      fontSize: b.fontSize,
      font:     b.fontFamily,
    }));
}

window.utbFindNearestLine = utbFindNearestLine;
window.utbGetSpansCompat  = utbGetSpansCompat;
