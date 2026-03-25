/* =========================================================
      PDF Viewer — single-page, PNG-based (no PDF.js)
      The server extracts the original 816×1056 px embedded
      image and returns it as base64.  All coordinates are in
      that pixel space throughout.
      ========================================================= */

async function handleFileUpload() {
  const file = els.pdfFile.files[0] || (event.dataTransfer && event.dataTransfer.files[0]);
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
    state.numPages   = data.num_pages  || state.pageImages.length || 1;
    state.pageWidth  = data.page_width  || 816;
    state.pageHeight = data.page_height || 1056;

    els.pageCountElem.textContent = `/ ${state.numPages}`;
    els.pageInputElem.value = 1;
    els.pageInputElem.max = state.numPages;

    await goToPage(1);
    renderThumbnails();

    // Auto-font detection
    let autoScale = 178;
    let autoSize = 12;
    if (data.suggested_scale) {
      autoScale = data.suggested_scale;
      els.calcScale.value = autoScale;
    }
    if (data.spans && data.spans.length) {
      const fontCounts = {};
      data.spans.forEach(s => {
        const k = `${s.font.matched_font}|${s.font.size}`;
        fontCounts[k] = (fontCounts[k] || 0) + 1;
      });
      const dom = Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0];
      if (dom) {
        autoSize = 12;
        els.size.value = 12;
      }
    }

    // Initialise each redaction with current DOM settings
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

    await calculateAllWidths();
    injectRedactionOverlays();

    if (state.redactions.length > 0) {
      updateAllMatchesView();
      selectRedaction(0);
    } else {
      updateAllMatchesView();
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
  pageContainer.style.setProperty('--page-width',  `${state.pageWidth}px`);
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
  webglCanvas.width  = state.pageWidth;
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
    overlay.style.setProperty('--px-x',      `${r.x}px`);
    overlay.style.setProperty('--px-y',      `${r.y}px`);
    overlay.style.setProperty('--px-width',  `${r.width}px`);
    overlay.style.setProperty('--px-height', `${r.height}px`);

    overlay.onclick = (e) => {
      e.stopPropagation();
      selectRedaction(idx);
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

    const label = document.createElement('div');
    label.className = 'redaction-label';
    label.contentEditable = 'false';
    label.spellcheck = false;
    label.textContent = r.labelText || '';
    label.dataset.manualEdit = r.manualLabel ? 'true' : 'false';

    // Set font styles immediately so zoom (via --scale-factor CSS var) works from the start
    const basePx = r.settings.size * (r.settings.scale / 100);
    label.style.fontFamily = getFontFamily(r.settings.font);
    label.style.fontSize = `calc(${basePx}px * var(--scale-factor, 1))`;
    label.style.fontVariantLigatures = r.settings.lig ? 'common-ligatures' : 'none';
    label.style.fontFeatureSettings = `"kern" ${r.settings.kern ? 1 : 0}`;
    label.style.textTransform = r.settings.upper ? 'uppercase' : 'none';
    label.style.display = r.labelText ? 'flex' : 'none';

    label.onclick = (e) => {
      e.stopPropagation();
      selectRedaction(idx);
    };
    label.ondblclick = (e) => {
      e.stopPropagation();
      if (label.isContentEditable) return;
      label.contentEditable = 'true';
      label.focus();
    };
    label.oninput = () => {
      if (state.redactions[idx]) {
        state.redactions[idx].labelText = label.textContent || '';
        state.redactions[idx].manualLabel = true;
        label.dataset.manualEdit = 'true';
      }
    };
    label.onblur = () => {
      if (state.redactions[idx]) {
        state.redactions[idx].labelText = label.textContent || '';
        state.redactions[idx].manualLabel = true;
        label.dataset.manualEdit = 'true';
      }
      label.contentEditable = 'false';
    };

    overlay.appendChild(label);

    if (idx === state.selectedRedactionIdx) overlay.classList.add('selected');

    container.appendChild(overlay);
  });
}
