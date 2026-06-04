// etv-fetch.js — Embedded Text Viewer: span fetching and lifecycle hooks.
// Cross-module calls into text_tool (utbState, spanToUnified, renderAllTextLayers, etc.)
// only happen inside event handlers and timeouts, so the fact that text_tool scripts
// load after this one is safe.

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

    if (spans.length > 0) {
      const ptSizes = spans.map(s => s.fontSize * 0.75).sort((a, b) => a - b);
      const medianPt = ptSizes[Math.floor(ptSizes.length / 2)];
      const documentBasePt = Math.round(medianPt);

      const fontCounts = {};
      let maxCount = 0;
      let mostUsedFont = 'Times New Roman';

      spans.forEach(span => {
        const pt = span.fontSize * 0.75;
        let normalizedPt;
        if (Math.abs(pt - documentBasePt) <= 1.0) {
          normalizedPt = documentBasePt;
        } else {
          normalizedPt = Math.round(pt);
        }
        span.fontSize = normalizedPt / 0.75;

        const f = typeof normUtbFont === 'function' ? normUtbFont(span.font) : (span.font || 'Times New Roman');
        if (f) {
          fontCounts[f] = (fontCounts[f] || 0) + 1;
          if (fontCounts[f] > maxCount) {
            maxCount = fontCounts[f];
            mostUsedFont = f;
          }
        }
      });

      const fabricSel = document.getElementById('fabric-font-family');
      if (fabricSel && Array.from(fabricSel.options).find(o => o.value === mostUsedFont)) {
        fabricSel.value = mostUsedFont;
        if (typeof textOptions !== 'undefined') textOptions.fontFamily = mostUsedFont;
      }

      utbState.boxes.filter(b => b.type === 'redaction').forEach(box => {
        const pt = box.fontSize * 0.75;
        let normalizedPt;
        if (Math.abs(pt - documentBasePt) <= 1.0) {
          normalizedPt = documentBasePt;
        } else {
          normalizedPt = Math.round(pt);
        }

        let changed = false;
        if (box.fontSize !== normalizedPt / 0.75) {
          box.fontSize = normalizedPt / 0.75;
          changed = true;
        }
        if (box.fontFamily !== mostUsedFont) {
          box.fontFamily = mostUsedFont;
          changed = true;
        }

        if (changed && typeof renderBox === 'function') renderBox(box);
      });
    }

    utbState.boxes = utbState.boxes.filter(b => b.type !== 'embedded');

    spans.forEach(span => utbState.addBox(spanToUnified(span)));

    _utbFetchState.fetched = true;
    _utbFetchState.currentFile = file;

    renderAllTextLayers();
    utbConnectRedactionsToLines();

    if (typeof calculateAllWidths === 'function') {
      calculateAllWidths();
    }

  } catch (err) {
    console.warn('UTB: span fetch error', err);
  }
}


// ── Connect redaction boxes to embedded text lines ────────────

function utbConnectRedactionsToLines() {
  const embeddedBoxes = utbState.boxes.filter(b => b.type === 'embedded');
  const redactionBoxes = utbState.boxes.filter(b => b.type === 'redaction');

  redactionBoxes.forEach(rb => {
    if (rb.lineId !== null) return;

    const pageEmbedded = embeddedBoxes.filter(b => b.page === rb.page);
    let bestBox = null;
    let bestOverlap = 0;

    for (const eb of pageEmbedded) {
      const overlap = Math.min(rb.y + rb.h, eb.y + eb.h) - Math.max(rb.y, eb.y);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestBox = eb;
      }
    }

    if (!bestBox || bestOverlap < rb.h * 0.3) return;

    rb.lineId = bestBox.lineId;
    rb.y = bestBox.y;
    rb.h = bestBox.h;

    const lineBoxes = embeddedBoxes.filter(b => b.page === rb.page && b.lineId === bestBox.lineId);
    let hasUpper = false;
    if (typeof state !== 'undefined' && state.candidates && state.candidates.length > 0) {
      const lineText = lineBoxes.map(lb => lb.text || '').join(' ');
      const lineUpper = lineText.toUpperCase();
      for (const c of state.candidates) {
        const cWords = c.split(/\s+/).map(w => w.replace(/[^A-Za-z]/g, '').toUpperCase()).filter(w => w.length > 2);
        if (cWords.length === 0) continue;
        const phrasePattern = new RegExp('\\b' + cWords.join('\\s+') + '\\b');
        if (phrasePattern.test(lineUpper)) {
          hasUpper = true;
          break;
        }
      }
    }
    if (hasUpper) {
      rb.uppercase = true;
    }

    renderBox(rb);
  });
}


// ── Nearest-line helper (exposed so text-tool.js can use it) ──

window._utbFindNearestLine = function (pageNum, y, thresholdMultiplier = 2.0) {
  const pageBoxes = utbState.boxes.filter(b => b.page === pageNum && b.type === 'embedded');
  if (!pageBoxes.length) return null;

  let nearest = null;
  let minDist = Infinity;
  for (const b of pageBoxes) {
    const cy = b.y + b.h / 2;
    const d = Math.abs(cy - y);
    if (d < minDist) { minDist = d; nearest = b; }
  }
  return nearest && minDist < nearest.h * thresholdMultiplier ? nearest : null;
};


// ── Tool: add embedded text span ──────────────────────────────

window.addEmbeddedTextSpan = function (pageNum, x, y) {
  const nearest = window._utbFindNearestLine(pageNum, y);

  const newBox = utbState.addBox(new UnifiedTextBox({
    type: 'embedded',
    page: pageNum,
    text: 'Click to edit',
    lineId: nearest ? nearest.lineId : `manual_${Date.now()}`,
    x: x,
    y: nearest ? nearest.y : y - 10,
    w: 120,
    h: nearest ? nearest.h : 20,
    fontFamily: nearest ? nearest.fontFamily : (document.getElementById('fabric-font-family')?.value || 'Times New Roman'),
    fontSize: nearest ? nearest.fontSize : ((parseFloat(document.getElementById('fabric-font-size')?.value) || 12) / 0.75),
  }));

  renderBox(newBox);

  utbState.selectedId = newBox.id;
  selectBoxInSVG(newBox.id);
  if (typeof syncToolbarToBox === 'function') syncToolbarToBox(newBox);
};


// ── Lifecycle hooks ───────────────────────────────────────────

const _etvOrigLoadDocument = window.loadDocument;
if (typeof _etvOrigLoadDocument === 'function') {
  window.loadDocument = async function (...args) {
    utbState.reset();
    clearAllSVGLayers?.();
    _utbFetchState.fetched = false;
    await _etvOrigLoadDocument(...args);
    const file = typeof state !== 'undefined' ? (state.currentFile || null) : null;
    utbFetchSpans(file);
  };
}

document.getElementById('pdf-file')?.addEventListener('change', () => {
  _utbFetchState.fetched = false;
  utbState.reset();
  clearAllSVGLayers?.();
});

setTimeout(() => {
  if (!_utbFetchState.fetched) {
    utbFetchSpans(typeof state !== 'undefined' ? (state.currentFile || null) : null);
  }
}, 1500);


window.utbFetchSpans = utbFetchSpans;
window.utbConnectRedactionsToLines = utbConnectRedactionsToLines;
