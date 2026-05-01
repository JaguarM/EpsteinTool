// text-tool.js
// Bootstrap / integration layer for the Unified Text Box system.
// Wires span fetching and redaction data into utbState, and hooks
// into the existing pdf-viewer.js lifecycle (loadDocument, goToPage).

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

    // Connect redaction boxes to their ETV lines
    utbConnectRedactionsToLines();

  } catch (err) {
    console.warn('UTB: span fetch error', err);
  }
}


// ── Redaction ingestion ───────────────────────────────────────

/**
 * Convert the legacy state.redactions[] into UnifiedTextBox entries.
 * Called after loadDocument populates state.redactions.
 */
function utbIngestRedactions() {
  if (typeof state === 'undefined' || !state.redactions) return;

  // Remove old redaction boxes
  utbState.boxes = utbState.boxes.filter(b => b.type !== 'redaction');

  state.redactions.forEach((r, idx) => {
    utbState.addBox(redactionToUnified(r, idx));
  });

  renderAllTextLayers();
}


// ── Connect redaction UTB boxes to ETV lines ──────────────────

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

    // Sync back to legacy state.redactions[] if present
    if (rb._legacyIdx !== undefined && typeof state !== 'undefined' && state.redactions[rb._legacyIdx]) {
      state.redactions[rb._legacyIdx].lineId = rb.lineId;
      state.redactions[rb._legacyIdx].y      = rb.y;
      state.redactions[rb._legacyIdx].height = rb.h;
    }

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
// Delegates to api.js's createNewRedaction so the legacy redaction
// matching system still works, then syncs into utbState.
window.handleManualAddBox = function(pageNum, x, y) {
  // Use UTB line snapping for redaction creation
  {
    const nearestLine = utbFindNearestLine(pageNum, y, 2.0);
    const finalY      = nearestLine ? nearestLine.y      : y - 10;
    const finalH      = nearestLine ? nearestLine.h      : 20;
    const finalLineId = nearestLine ? nearestLine.lineId : null;
    const lineFont    = nearestLine?.font;
    const lineFontSz  = nearestLine?.fontSize;
    if (typeof createNewRedaction === 'function') {
      createNewRedaction(pageNum, x - 50, finalY, 100, finalH, finalLineId, lineFont, lineFontSz);
      // utbIngestRedactions() will be called by the monkey-patched injectRedactionOverlays
      return;
    }
  }

  // Fallback: pure UTB creation (no legacy state)
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

// After a PDF is loaded (loadDocument completes), ingest redactions and fetch spans
const _origLoadDocument = window.loadDocument;
if (typeof _origLoadDocument === 'function') {
  window.loadDocument = async function(...args) {
    utbState.reset();
    clearAllSVGLayers?.();
    _utbFetchState.fetched = false;
    await _origLoadDocument(...args);
    utbIngestRedactions();
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

// Auto-fetch spans for the default PDF on load (after embedded-text-viewer also does this)
setTimeout(() => {
  if (!_utbFetchState.fetched) {
    utbFetchSpans(typeof state !== 'undefined' ? (state.currentFile || null) : null);
  }
}, 1500);


// ── Monkey-patches: keep utbState in sync with legacy redaction system ───────

// After injectRedactionOverlays() re-builds the legacy DOM overlays, also
// refresh the UTB redaction boxes so the SVG layer stays current.
(function patchInjectRedactionOverlays() {
  const _orig = window.injectRedactionOverlays;
  if (typeof _orig !== 'function') {
    // Not yet defined — set up a deferred patch applied after scripts load
    document.addEventListener('DOMContentLoaded', () => _applyInjectPatch(), { once: true });
    setTimeout(_applyInjectPatch, 200);
    return;
  }
  _applyInjectPatch();

  function _applyInjectPatch() {
    const orig = window.injectRedactionOverlays;
    if (!orig || orig._utbPatched) return;
    window.injectRedactionOverlays = function(...args) {
      orig(...args);
      utbIngestRedactions();
    };
    window.injectRedactionOverlays._utbPatched = true;
  }
})();

// After updateAllMatchesView() sets r.labelText, push text changes to UTB boxes.
(function patchUpdateAllMatchesView() {
  function _applyPatch() {
    const orig = window.updateAllMatchesView;
    if (!orig || orig._utbPatched) return;
    window.updateAllMatchesView = function(onlyIdx) {
      orig(onlyIdx);
      // Sync updated labelText values to UTB redaction boxes
      if (typeof state === 'undefined' || !state.redactions) return;
      state.redactions.forEach((r, idx) => {
        if (onlyIdx !== undefined && onlyIdx !== null && onlyIdx !== idx) return;
        const box = utbState.boxes.find(b => b.type === 'redaction' && b._legacyIdx === idx);
        if (box && box.text !== r.labelText) {
          box.text = r.labelText;
          renderBox(box);
        }
      });
    };
    window.updateAllMatchesView._utbPatched = true;
  }
  setTimeout(_applyPatch, 300);
})();

// After selectRedaction() highlights the legacy overlay, also select the UTB box.
(function patchSelectRedaction() {
  function _applyPatch() {
    const orig = window.selectRedaction;
    if (!orig || orig._utbPatched) return;
    window.selectRedaction = async function(idx) {
      await orig(idx);
      const box = utbState.boxes.find(b => b.type === 'redaction' && b._legacyIdx === idx);
      if (box) {
        utbState.selectedId = box.id;
        selectBoxInSVG(box.id);
        if (typeof syncToolbarToBox === 'function') syncToolbarToBox(box);
      }
    };
    window.selectRedaction._utbPatched = true;
  }
  setTimeout(_applyPatch, 300);
})();


// ── Expose globals ────────────────────────────────────────────

window.utbFetchSpans               = utbFetchSpans;
window.utbIngestRedactions         = utbIngestRedactions;
window.utbConnectRedactionsToLines = utbConnectRedactionsToLines;
