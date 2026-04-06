/* ETV span DOM lookup — used for Redaction → ETV sync */
function getETVSpanEl(span) {
  if (typeof etvState === 'undefined') return null;
  const overlay = document.querySelector(`#pageContainer${span.page} .etv-overlay`);
  if (!overlay) return null;
  const pageSpans = etvState.spans.filter(sp => sp.page === span.page);
  const idx = pageSpans.indexOf(span);
  if (idx === -1) return null;
  return overlay.querySelector(`.etv-span[data-index="${idx}"]`);
}

/* Zoom Handlers */
function updateZoomLevelText() { els.zoomInputElem.value = `${Math.round(state.currentZoom * 100)}%`; }

function updateCSSZoom() {
  els.viewer.style.setProperty('--scale-factor', state.currentZoom);
  els.viewer.classList.toggle('zoom-in', state.currentZoom > 1.0);
  updateZoomLevelText();
  if (typeof onZoomChange === 'function') {
    onZoomChange(state.currentZoom);
  }
}

function processZoomFromText(newZoom, mouseX = null, mouseY = null) {
  const constrainedZoom = Math.min(Math.max(newZoom, state.minZoom), state.maxZoom);
  if (constrainedZoom !== state.currentZoom) {
    const prevZoom = state.currentZoom;
    state.currentZoom = constrainedZoom;

    if (mouseX !== null && mouseY !== null) {
      const docX = (els.viewerContainer.scrollLeft + mouseX) / prevZoom;
      const docY = (els.viewerContainer.scrollTop + mouseY) / prevZoom;

      updateCSSZoom();
      els.viewerContainer.scrollLeft = (docX * state.currentZoom) - mouseX;
      els.viewerContainer.scrollTop = (docY * state.currentZoom) - mouseY;
    } else {
      updateCSSZoom();
    }
  } else {
    updateZoomLevelText();
  }
}

// No canvas re-render needed — the page is a static <img> that scales via CSS.

/* Resizing Redactions */
function initResize(e, idx, edge) {
  e.stopPropagation();
  e.preventDefault();

  selectRedaction(idx);

  const r = state.redactions[idx];
  const startX = e.clientX;
  const startY = e.clientY;
  const startPtsX = r.x;
  const startPtsY = r.y;
  const startPtsWidth = r.width;
  const startPtsHeight = r.height;
  const scaleFactor = state.currentZoom;

  // Capture connected ETV spans for vertical-edge sync (t/b only)
  const connectedSpans = (r.lineId !== null && typeof etvState !== 'undefined')
    ? etvState.spans.filter(s => s.lineId === r.lineId && s.page === r.page)
    : [];
  const spanStartYs = connectedSpans.map(s => s.y);
  const spanStartHs = connectedSpans.map(s => s.h);

  const tol = r.settings.tol || 0;
  const isUpper = r.settings.upper;
  const fontStyle = `font-family: ${r.settings.fontFamily || 'inherit'}; font-variant-ligatures: ${r.settings.lig ? 'common-ligatures' : 'none'}; font-feature-settings: "kern" ${r.settings.kern ? 1 : 0}; text-transform: ${isUpper ? 'uppercase' : 'none'};`;

  function onMouseMove(moveEvent) {
    const dx = (moveEvent.clientX - startX) / scaleFactor;
    const dy = (moveEvent.clientY - startY) / scaleFactor;

    if (edge === 'r') {
      r.width = Math.max(1, startPtsWidth + dx);
    } else if (edge === 'l') {
      const actualDx = Math.min(dx, startPtsWidth - 1);
      r.x = startPtsX + actualDx;
      r.width = startPtsWidth - actualDx;
    } else if (edge === 'b') {
      r.height = Math.max(1, startPtsHeight + dy);
    } else if (edge === 't') {
      const actualDy = Math.min(dy, startPtsHeight - 1);
      r.y = startPtsY + actualDy;
      r.height = startPtsHeight - actualDy;
    }

    const overlay = document.getElementById(`redaction-idx-${idx}`);
    if (overlay) {
      overlay.style.setProperty('--px-x',      `${r.x}px`);
      overlay.style.setProperty('--px-y',      `${r.y}px`);
      overlay.style.setProperty('--px-width',  `${r.width}px`);
      overlay.style.setProperty('--px-height', `${r.height}px`);
    }

    // Sync connected ETV spans for vertical resize (t/b edges only)
    for (let i = 0; i < connectedSpans.length; i++) {
      const s = connectedSpans[i];
      if (edge === 't') {
        const actualDy = Math.min(dy, spanStartHs[i] - 1);
        s.y = spanStartYs[i] + actualDy;
        s.h = spanStartHs[i] - actualDy;
      } else if (edge === 'b') {
        s.h = Math.max(1, spanStartHs[i] + dy);
      } else {
        continue;
      }
      const el = getETVSpanEl(s);
      if (el) {
        el.style.setProperty('--etv-y', `${s.y}px`);
        el.style.setProperty('--etv-h', `${s.h}px`);
      }
    }

    const rowEl = document.getElementById(`match-row-${idx}`);
    if (rowEl && rowEl.children.length >= 3) {
      rowEl.children[1].textContent = r.width.toFixed(2);

      const matches = state.candidates.filter(c => {
        const w = (r.widths && r.widths[c] !== undefined) ? r.widths[c] : undefined;
        return w !== undefined && Math.abs(w - r.width) <= tol;
      });
      const matchHtml = matches.length
        ? `<span style="color:#81c995; ${fontStyle}">${matches.map(m => isUpper ? m.toUpperCase() : m).join(', ')}</span>`
        : `<span class="no-match">No obvious matches</span>`;
      rowEl.children[2].innerHTML = matchHtml;
      
      const label = overlay.querySelector('.redaction-label');
      if (label) {
        // If the user is actively editing this label, do not touch its text or styling
        if (label.isContentEditable && document.activeElement === label) {
          return;
        }
        label.style.fontFamily = r.settings.fontFamily || 'inherit';
        label.style.setProperty('--etv-fs', `${r.settings.fontSize || 16}px`);
        label.style.fontSize = `calc(${r.settings.fontSize || 16}px * var(--scale-factor, 1))`;
        label.style.fontVariantLigatures = r.settings.lig ? 'common-ligatures' : 'none';
        label.style.fontFeatureSettings = `"kern" ${r.settings.kern ? 1 : 0}`;
        label.style.textTransform = isUpper ? 'uppercase' : 'none';
        label.style.display = 'flex';

        // Update per-redaction label text only if it has not been manually overridden
        if (!r.manualLabel) {
          if (matches.length > 0) {
            r.labelText = isUpper ? matches[0].toUpperCase() : matches[0];
          } else {
            r.labelText = '';
          }
        }
        label.textContent = r.labelText || '';
        
        // Premium: Toggle glow class during live resize
        if (matches.length > 0) { overlay.classList.add('has-match'); }
        else { overlay.classList.remove('has-match'); }
      }
    }

    // Re-evaluate matching candidates total count
    let matchCount = 0;
    state.redactions.forEach(rItem => {
      const hasMatch = state.candidates.some(c => 
        rItem.widths && rItem.widths[c] !== undefined && 
        Math.abs(rItem.widths[c] - rItem.width) <= (rItem.settings.tol || 0)
      );
      if (hasMatch) matchCount++;
    });
    
    if (els.allMatchesSummary) {
      els.allMatchesSummary.textContent = `${matchCount} of ${state.redactions.length} redactions have potential matches.`;
    }
    const progress = state.redactions.length ? (matchCount / state.redactions.length) * 100 : 0;
    const progressBar = document.getElementById('match-progress-bar');
    if (progressBar) progressBar.style.width = `${progress}%`;
  }


  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

/* Dragging Redactions */
function initDragRedaction(e, idx) {
  e.stopPropagation();
  e.preventDefault();

  selectRedaction(idx);

  const r = state.redactions[idx];
  const startX = e.clientX;
  const startY = e.clientY;
  const startPtsX = r.x;
  const startPtsY = r.y;
  const scaleFactor = state.currentZoom;

  // Capture connected ETV spans and their start Y positions for live sync
  const connectedSpans = (r.lineId !== null && typeof etvState !== 'undefined')
    ? etvState.spans.filter(s => s.lineId === r.lineId && s.page === r.page)
    : [];
  const spanStartYs = connectedSpans.map(s => s.y);

  function onMouseMove(moveEvent) {
    const dx = (moveEvent.clientX - startX) / scaleFactor;
    const dy = (moveEvent.clientY - startY) / scaleFactor;

    r.x = startPtsX + dx;
    r.y = startPtsY + dy;

    const overlay = document.getElementById(`redaction-idx-${idx}`);
    if (overlay) {
      overlay.style.setProperty('--px-x', `${r.x}px`);
      overlay.style.setProperty('--px-y', `${r.y}px`);
    }

    // Sync connected ETV spans vertically (X is independent per span)
    for (let i = 0; i < connectedSpans.length; i++) {
      connectedSpans[i].y = spanStartYs[i] + dy;
      const el = getETVSpanEl(connectedSpans[i]);
      if (el) el.style.setProperty('--etv-y', `${connectedSpans[i].y}px`);
    }
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

/* Thumbnails */
function renderThumbnails() {
  els.thumbnailView.innerHTML = '';

  for (let i = 1; i <= state.numPages; i++) {
    const thumbCont = document.createElement('div');
    thumbCont.className = 'thumbnail-container' + (i === state.currentPage ? ' active' : '');

    const img = document.createElement('img');
    img.src = state.pageImages[i - 1];
    img.className = 'thumbnail';
    img.draggable = false;
    img.style.width = '180px';
    img.style.height = 'auto';
    img.style.display = 'block';

    const lbl = document.createElement('div');
    lbl.className = 'thumbnail-page-num';
    lbl.textContent = i;

    thumbCont.appendChild(img);
    thumbCont.appendChild(lbl);
    els.thumbnailView.appendChild(thumbCont);

    thumbCont.addEventListener('click', () => goToPage(i));
  }
}