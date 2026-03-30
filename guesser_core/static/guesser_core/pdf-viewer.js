/* =========================================================
      PDF Viewer — single-page, PNG-based (no PDF.js)
      The server extracts the original 816×1056 px embedded
      image and returns it as base64.  All coordinates are in
      that pixel space throughout.
      ========================================================= */

// Maps a .ttf filename (from the server) to the CSS font family name used in
// the Fabric text-annotation toolbar.  Only the four supported fonts.
function ttfToFabricFont(ttfName) {
  const map = {
    'times.ttf': 'Times New Roman',
    'courier_new.ttf': 'Courier New',
    'arial.ttf': 'Arial',
    'calibri.ttf': 'Calibri',
  };
  return map[ttfName] || null;
}

async function handleFileUpload(e) {
  const file = els.pdfFile.files[0] || (e && e.dataTransfer && e.dataTransfer.files[0]);
  if (!file) return;

  const ext = (file.name || '').split('.').pop().toLowerCase();
  state.hasPdf = (ext === 'pdf');

  els.titleElem.textContent = file.name;
  state.redactions = [];
  state.selectedRedactionIdx = null;
  state.pageImages = [];
  state.numPages = 0;
  els.allMatchesCard.style.display = 'none';
  if (typeof resetFabricCanvases === 'function') resetFabricCanvases();

  try {
    const fd = new FormData();
    fd.append('file', file);

    const resp = await fetch('/analyze-pdf', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error((await resp.json()).detail);
    const data = await resp.json();

    const imgType = data.page_image_type || 'image/png';
    state.pageImages = (data.page_images || []).map(b64 =>
      b64 ? `data:${imgType};base64,${b64}` : null
    );
    state.maskImages = (data.mask_images || []).map(b64 =>
      b64 ? `data:image/png;base64,${b64}` : null
    );
    state.numPages = data.num_pages || state.pageImages.length || 1;
    state.pageWidth = data.page_width || 816;
    state.pageHeight = data.page_height || 1056;

    els.pageCountElem.textContent = `/ ${state.numPages}`;
    els.pageInputElem.value = 1;
    els.pageInputElem.max = state.numPages;

    await goToPage(1);
    renderThumbnails();

    // Auto-font detection from server
    const autoScale = data.suggested_scale || 178;
    const autoSize = data.suggested_size || 12;
    const autoFont = data.suggested_font || null;

    els.calcScale.value = autoScale;
    els.size.value = autoSize;
    if (autoFont) {
      // Calculation font dropdown
      const opt = Array.from(els.font.options).find(o => o.value === autoFont);
      if (opt) els.font.value = autoFont;

      // Text-annotation toolbar font dropdown
      const fabricFont = ttfToFabricFont(autoFont);
      if (fabricFont) {
        const fabricSel = document.getElementById('fabric-font-family');
        if (fabricSel && Array.from(fabricSel.options).find(o => o.value === fabricFont)) {
          fabricSel.value = fabricFont;
          if (typeof textOptions !== 'undefined') textOptions.fontFamily = fabricFont;
        }
      }
    }

    // Initialise each redaction with the detected font settings
    state.redactions = data.redactions.map(r => ({
      ...r,
      settings: {
        font: els.font.value,
        size: autoSize,
        scale: autoScale,
        tol: parseFloat(els.tol.value) || 0,
        kern: els.kern.checked,
        lig: els.lig.checked,
        upper: els.upper.checked
      },
      widths: {},
      labelText: '',
      manualLabel: false
    }));

    if (typeof calculateAllWidths === 'function') await calculateAllWidths();
    injectRedactionOverlays();

    if (state.redactions.length > 0) {
      if (typeof updateAllMatchesView === 'function') updateAllMatchesView();
      if (typeof selectRedaction === 'function') selectRedaction(0);
    } else {
      if (typeof updateAllMatchesView === 'function') updateAllMatchesView();
    }

    if (typeof fetchMasksAsync === 'function') {
      fetchMasksAsync(file);
    }
  } catch (e) {
    console.error('Error analyzing PDF:', e.message);
  }
}

async function goToPage(pageNum) {
  if (!state.pageImages.length) return;
  pageNum = Math.max(1, Math.min(pageNum, state.numPages));

  // Dispose fabric canvas for the page being left
  if (state.fabricCanvases.has(state.currentPage) && state.currentPage !== pageNum) {
    state.fabricCanvases.get(state.currentPage).dispose();
    state.fabricCanvases.delete(state.currentPage);
  }

  if (typeof clearWebGLContexts === 'function') clearWebGLContexts();

  state.currentPage = pageNum;
  els.pageInputElem.value = pageNum;
  els.viewer.innerHTML = '';
  els.viewerContainer.scrollTop = 0;
  updateCSSZoom();

  // Sync active thumbnail
  document.querySelectorAll('.thumbnail-container').forEach((c, i) => {
    c.classList.toggle('active', i + 1 === pageNum);
  });

  // Page container — dimensions match the uploaded image's pixel space
  const pageContainer = document.createElement('div');
  pageContainer.className = 'page-container';
  pageContainer.id = `pageContainer${pageNum}`;
  pageContainer.style.setProperty('--page-width', `${state.pageWidth}px`);
  pageContainer.style.setProperty('--page-height', `${state.pageHeight}px`);

  // Original embedded image as the page background
  const img = document.createElement('img');
  img.id = `page${pageNum}`;
  img.src = state.pageImages[pageNum - 1];
  img.draggable = false;
  img.style.display = 'block';
  img.style.width = '100%';
  img.style.height = '100%';
  pageContainer.appendChild(img);

  // WebGL overlay canvas — sized to match the pixel space
  const webglCanvas = document.createElement('canvas');
  webglCanvas.id = `webgl-overlay-${pageNum}`;
  webglCanvas.className = 'webgl-overlay';
  webglCanvas.style.position = 'absolute';
  webglCanvas.style.top = '0';
  webglCanvas.style.left = '0';
  webglCanvas.style.pointerEvents = 'none';
  webglCanvas.width = state.pageWidth;
  webglCanvas.height = state.pageHeight;
  const webglActive = els.toggleWebglBtn && els.toggleWebglBtn.classList.contains('active');
  webglCanvas.style.display = webglActive ? 'block' : 'none';
  pageContainer.appendChild(webglCanvas);

  els.viewer.appendChild(pageContainer);

  if (typeof setupWebGLOverlay === 'function' && state.hasPdf) {
    setupWebGLOverlay(pageContainer, webglCanvas, pageNum);
  }
  if (typeof createPageOverlay === 'function') {
    createPageOverlay(pageContainer, pageNum);
  }

  injectRedactionOverlays();
}

/* Rendering Redaction Overlays inside Document Pages */
function injectRedactionOverlays() {
  if (!state.redactions.length) return;

  // Cleanup existing
  document.querySelectorAll('.redaction-overlay').forEach(e => e.remove());

  state.redactions.forEach((r, idx) => {
    const container = document.getElementById(`pageContainer${r.page}`);
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'redaction-overlay';
    overlay.id = `redaction-idx-${idx}`;

    // Pixel-space coordinates; CSS multiplies by --scale-factor for zoom
    overlay.style.setProperty('--px-x', `${r.x}px`);
    overlay.style.setProperty('--px-y', `${r.y}px`);
    overlay.style.setProperty('--px-width', `${r.width}px`);
    overlay.style.setProperty('--px-height', `${r.height}px`);

    overlay.onclick = (e) => {
      e.stopPropagation();
      if (typeof selectRedaction === 'function') selectRedaction(idx);
    };

    overlay.onmousedown = (e) => {
      if (e.button !== 0) return;
      if (e.detail > 1) return;
      if (e.target.classList.contains('resizer')) return;
      initDragRedaction(e, idx);
    };

    ['l', 'r', 't', 'b'].forEach(edge => {
      const resizer = document.createElement('div');
      resizer.className = `resizer resizer-${edge}`;
      resizer.onmousedown = (e) => initResize(e, idx, edge);
      overlay.appendChild(resizer);
    });

    if (typeof injectMatchingLabel === 'function') {
      injectMatchingLabel(overlay, r, idx);
    }

    if (idx === state.selectedRedactionIdx) overlay.classList.add('selected');

    container.appendChild(overlay);
  });
}
