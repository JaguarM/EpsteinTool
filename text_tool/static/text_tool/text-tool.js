// text-tool.js
// Tool actions and OCR integration for the Unified Text Box system.
// Span fetching and embedded-text lifecycle are handled by etv-fetch.js (embedded_text_viewer).


// ── Tool: add redaction box ───────────────────────────────────

window.handleManualAddBox = function (pageNum, x, y) {
  if (typeof createNewRedaction === 'function') {
    const nearestLine = window._utbFindNearestLine?.(pageNum, y, 2.0);
    const finalY = nearestLine ? nearestLine.y : y - 10;
    const finalH = nearestLine ? nearestLine.h : 20;
    const finalLineId = nearestLine ? nearestLine.lineId : null;
    const lineFont = nearestLine?.font;
    const lineFontSz = nearestLine?.fontSize;
    createNewRedaction(pageNum, x - 50, finalY, 100, finalH, finalLineId, lineFont, lineFontSz);
    return;
  }

  // Fallback: pure UTB creation (no redaction_matching plugin)
  const nearest = window._utbFindNearestLine?.(pageNum, y);
  const defaultFF = document.getElementById('fabric-font-family')?.value || 'Times New Roman';
  const defaultFS = (parseFloat(document.getElementById('fabric-font-size')?.value) || 12) / 0.75;

  const newBox = utbState.addBox(new UnifiedTextBox({
    type: 'redaction',
    page: pageNum,
    text: '',
    lineId: nearest ? nearest.lineId : null,
    x: x,
    y: nearest ? nearest.y : y - 10,
    w: nearest ? nearest.w : 100,
    h: nearest ? nearest.h : 20,
    fontFamily: nearest ? nearest.fontFamily : defaultFF,
    fontSize: nearest ? nearest.fontSize : defaultFS,
  }));

  renderBox(newBox);
  utbState.selectedId = newBox.id;
  selectBoxInSVG(newBox.id);
  if (typeof syncToolbarToBox === 'function') syncToolbarToBox(newBox);
};


// ── Tesseract OCR Integration ─────────────────────────────────

window.updateOCRButtonState = function () {
  const pageNum = typeof state !== 'undefined' ? state.currentPage : 1;
  const pageContainer = document.getElementById(`pageContainer${pageNum}`);
  const btn = document.getElementById('btn-run-ocr');

  if (!btn) return;

  const hasOCR = utbState.boxes.some(b => b.type === 'ocr' && b.page === pageNum);
  const isHidden = pageContainer ? pageContainer.classList.contains('hide-ocr') : false;

  if (hasOCR && !isHidden) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
};

const _utbOrigGoToPage = window.goToPage;
if (typeof _utbOrigGoToPage === 'function') {
  window.goToPage = async function (...args) {
    const res = await _utbOrigGoToPage(...args);
    if (typeof updateOCRButtonState === 'function') updateOCRButtonState();
    return res;
  };
}

window.handleRunOCR = async function (pageNum, silent = false) {
  if (typeof pageNum !== 'number') pageNum = typeof state !== 'undefined' ? state.currentPage : 1;
  const file = typeof state !== 'undefined' ? (state.currentFile || null) : null;
  const pageContainer = document.getElementById(`pageContainer${pageNum}`);

  const hasOCR = utbState.boxes.some(b => b.type === 'ocr' && b.page === pageNum);
  if (hasOCR) {
    if (pageContainer) {
      pageContainer.classList.toggle('hide-ocr');
    }
    if (typeof updateOCRButtonState === 'function') updateOCRButtonState();
    return;
  }

  const btn = document.getElementById('btn-run-ocr');
  if (btn && !silent) btn.style.opacity = '0.5';

  const fd = new FormData();
  fd.append('page_index', pageNum - 1);

  if (file) {
    fd.append('file', file);
  } else {
    fd.append('default', 'true');
  }

  try {
    const resp = await fetch('/tesseract-ocr/process/', { method: 'POST', body: fd });
    const data = await resp.json();

    if (!resp.ok || data.error) {
      throw new Error(data.error || data.detail || "OCR Request Failed");
    }

    if (data.words) {
      utbState.boxes = utbState.boxes.filter(b => !(b.type === 'ocr' && b.page === pageNum));

      try {
        const payload = {
          redactions: utbState.boxes.filter(b => b.type === 'redaction' && b.page === pageNum).map(b => ({
            id: b.id, x: b.x, y: b.y, width: b.w, height: b.h
          })),
          etv_words: utbState.boxes.filter(b => b.type === 'embedded' && b.page === pageNum).map(b => ({
            text: b.text, x: b.x, y: b.y, width: b.w, height: b.h, baseCharPositions: b.baseCharPositions
          })),
          ocr_words: data.words
        };

        const refineResp = await fetch('/refine-widths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (refineResp.ok) {
          const refineData = await refineResp.json();
          if (refineData.redactions) {
            for (const r of refineData.redactions) {
              const box = utbState.boxes.find(b => b.id === r.id);
              if (box) {
                box.x = r.x;
                box.w = r.width;
                box.isRefined = true;
                if (typeof renderBox === 'function') renderBox(box);
                if (typeof calculateWidthsForRedaction === 'function') {
                  await calculateWidthsForRedaction(box.id);
                }
              }
            }
            if (typeof updateAllMatchesView === 'function') {
              updateAllMatchesView(null);
            }
          }
        }
      } catch (err) {
        console.error('Error refining widths:', err);
      }

      data.words.forEach(w => {
        let finalY = w.y;
        let finalH = w.height;
        if (typeof window._utbFindNearestLine === 'function') {
          const nearest = window._utbFindNearestLine(pageNum, w.y + w.height / 2, 2.0);
          if (nearest) {
            finalY = nearest.y;
            finalH = nearest.h;
          }
        }

        utbState.addBox(new UnifiedTextBox({
          type: 'ocr',
          page: pageNum,
          text: w.text,
          x: w.x,
          y: finalY,
          w: w.width,
          h: finalH,
          fontSize: 12 / 0.75,
          fontFamily: 'Times New Roman',
          confidence: w.confidence
        }));
      });

      if (typeof renderAllTextLayers === 'function') {
        renderAllTextLayers();
      }

      if (pageContainer) {
        if (silent) pageContainer.classList.add('hide-ocr');
        else pageContainer.classList.remove('hide-ocr');
      }
      if (typeof updateOCRButtonState === 'function') updateOCRButtonState();
    }
  } catch (e) {
    console.error('OCR Error:', e);
    if (!silent) alert('OCR Error: ' + e.message);
  } finally {
    if (btn && !silent) btn.style.opacity = '1';
  }
};

document.getElementById('btn-run-ocr')?.addEventListener('click', () => window.handleRunOCR());
