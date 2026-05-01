// text-tool.js
// Bootstrap / integration layer for the Unified Text Box system.
// Wires span fetching into utbState, and hooks into the existing
// pdf-viewer.js lifecycle (loadDocument, goToPage).

// ── Span fetching ─────────────────────────────────────────────

const _utbFetchState = {
  fetched: false,
  currentFile: null,
};

async function utbFetchSpans(file) {
  if (_utbFetchState.fetched && _utbFetchState.currentFile === file) return;

  try {
    let resp;
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      resp = await fetch('/embedded-text-viewer/api/extract-spans', { method: 'POST', body: fd });
    } else {
      resp = await fetch('/embedded-text-viewer/api/extract-spans');
    }
    if (!resp.ok) return;

    const data = await resp.json();
    const spans = data.spans || [];

    // Remove old embedded boxes so we don't double-render after re-fetch
    utbState.boxes = utbState.boxes.filter(b => b.type !== 'embedded');

    spans.forEach(span => utbState.addBox(spanToUnified(span)));

    _utbFetchState.fetched     = true;
    _utbFetchState.currentFile = file;

    // Render on all currently visible pages
    renderAllTextLayers();

    // Connect redaction boxes to their nearest text lines
    utbConnectRedactionsToLines();

  } catch (err) {
    console.warn('UTB: span fetch error', err);
  }
}


// ── Connect redaction UTB boxes to embedded text lines ────────

function utbConnectRedactionsToLines() {
  const embeddedBoxes = utbState.boxes.filter(b => b.type === 'embedded');
  const redactionBoxes = utbState.boxes.filter(b => b.type === 'redaction');

  redactionBoxes.forEach(rb => {
    if (rb.lineId !== null) return; // already connected

    const pageEmbedded = embeddedBoxes.filter(b => b.page === rb.page);
    let bestBox    = null;
    let bestOverlap = 0;

    for (const eb of pageEmbedded) {
      const overlap = Math.min(rb.y + rb.h, eb.y + eb.h) - Math.max(rb.y, eb.y);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestBox     = eb;
      }
    }

    if (!bestBox || bestOverlap < rb.h * 0.3) return;

    rb.lineId = bestBox.lineId;
    rb.y      = bestBox.y;
    rb.h      = bestBox.h;

    renderBox(rb);
  });
}


// ── Tool: add embedded text span ─────────────────────────────

/**
 * Create a new 'embedded' box at the given page coordinates.
 * Snaps to the nearest ETV line for font/size/position.
 */
window.addEmbeddedTextSpan = function(pageNum, x, y) {
  const nearest = _utbFindNearestLine(pageNum, y);

  const newBox = utbState.addBox(new UnifiedTextBox({
    type:       'embedded',
    page:       pageNum,
    text:       'Click to edit',
    lineId:     nearest ? nearest.lineId : `manual_${Date.now()}`,
    x:          x,
    y:          nearest ? nearest.y      : y - 10,
    w:          120,
    h:          nearest ? nearest.h      : 20,
    fontFamily: nearest ? nearest.fontFamily : (document.getElementById('fabric-font-family')?.value || 'Times New Roman'),
    fontSize:   nearest ? nearest.fontSize   : ((parseFloat(document.getElementById('fabric-font-size')?.value) || 12) / 0.75),
  }));

  renderBox(newBox);

  // Select the new box and open toolbar
  utbState.selectedId = newBox.id;
  selectBoxInSVG(newBox.id);
  if (typeof syncToolbarToBox === 'function') syncToolbarToBox(newBox);
};

function _utbFindNearestLine(pageNum, y, thresholdMultiplier = 2.0) {
  const pageBoxes = utbState.boxes.filter(b => b.page === pageNum && b.type === 'embedded');
  if (!pageBoxes.length) return null;

  let nearest  = null;
  let minDist  = Infinity;
  for (const b of pageBoxes) {
    const cy = b.y + b.h / 2;
    const d  = Math.abs(cy - y);
    if (d < minDist) { minDist = d; nearest = b; }
  }
  return nearest && minDist < nearest.h * thresholdMultiplier ? nearest : null;
}


// ── Tool: add redaction box ───────────────────────────────────
// Delegates to api.js createNewRedaction which creates UTB boxes directly.
window.handleManualAddBox = function(pageNum, x, y) {
  if (typeof createNewRedaction === 'function') {
    const nearestLine = _utbFindNearestLine(pageNum, y, 2.0);
    const finalY      = nearestLine ? nearestLine.y      : y - 10;
    const finalH      = nearestLine ? nearestLine.h      : 20;
    const finalLineId = nearestLine ? nearestLine.lineId : null;
    const lineFont    = nearestLine?.font;
    const lineFontSz  = nearestLine?.fontSize;
    createNewRedaction(pageNum, x - 50, finalY, 100, finalH, finalLineId, lineFont, lineFontSz);
    return;
  }

  // Fallback: pure UTB creation (no redaction_matching plugin)
  const nearest = _utbFindNearestLine(pageNum, y);
  const defaultFF = document.getElementById('fabric-font-family')?.value || 'Times New Roman';
  const defaultFS = (parseFloat(document.getElementById('fabric-font-size')?.value) || 12) / 0.75;

  const newBox = utbState.addBox(new UnifiedTextBox({
    type:       'redaction',
    page:       pageNum,
    text:       '',
    lineId:     nearest ? nearest.lineId : null,
    x:          x,
    y:          nearest ? nearest.y      : y - 10,
    w:          nearest ? nearest.w      : 100,
    h:          nearest ? nearest.h      : 20,
    fontFamily: nearest ? nearest.fontFamily : defaultFF,
    fontSize:   nearest ? nearest.fontSize   : defaultFS,
  }));

  renderBox(newBox);
  utbState.selectedId = newBox.id;
  selectBoxInSVG(newBox.id);
  if (typeof syncToolbarToBox === 'function') syncToolbarToBox(newBox);
};


// ── Lifecycle hooks ───────────────────────────────────────────

// After a PDF is loaded (loadDocument completes), fetch spans
const _origLoadDocument = window.loadDocument;
if (typeof _origLoadDocument === 'function') {
  window.loadDocument = async function(...args) {
    utbState.reset();
    clearAllSVGLayers?.();
    _utbFetchState.fetched = false;
    await _origLoadDocument(...args);
    const file = typeof state !== 'undefined' ? (state.currentFile || null) : null;
    utbFetchSpans(file);
  };
}

// File input change → reset and re-fetch
document.getElementById('pdf-file')?.addEventListener('change', () => {
  _utbFetchState.fetched = false;
  utbState.reset();
  clearAllSVGLayers?.();
});

// Auto-fetch spans for the default PDF on load
setTimeout(() => {
  if (!_utbFetchState.fetched) {
    utbFetchSpans(typeof state !== 'undefined' ? (state.currentFile || null) : null);
  }
}, 1500);


// ── Expose globals ────────────────────────────────────────────

window.utbFetchSpans               = utbFetchSpans;
window.utbConnectRedactionsToLines = utbConnectRedactionsToLines;
