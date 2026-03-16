/* Zoom Handlers */
    function updateZoomLevelText() { els.zoomInputElem.value = `${Math.round(state.currentZoom * 100)}%`; }

    function updateCSSZoom() {
      els.viewer.style.setProperty('--scale-factor', state.currentZoom);
      updateZoomLevelText();
    }

    async function applyZoom() {
      state.currentZoom = Math.min(Math.max(state.currentZoom, state.minZoom), state.maxZoom);
      updateCSSZoom();
      applyRealZoomDebounced(); // re-render high res paths
    }

    function applyRealZoomDebounced() {
      clearTimeout(window.zoomDebounce);
      window.zoomDebounce = setTimeout(() => {
        if (!state.pdfDoc) return;
        for (let i = 1; i <= state.pdfDoc.numPages; i++) {
          const c = document.getElementById(`page${i}`);
          if (c) renderPage(i, c);
        }
      }, 300);
    }

    /* Resizing Redactions */
    function initResize(e, idx, edge) {
      e.stopPropagation();
      e.preventDefault();

      selectRedaction(idx);

      const r = state.redactions[idx];
      const startX = e.clientX;
      const startY = e.clientY;
      const startPtsX = r.pts_x;
      const startPtsY = r.pts_y;
      const startPtsWidth = r.pts_width;
      const startPtsHeight = r.pts_height;
      const scaleFactor = state.currentZoom;

      const tol = r.settings.tol || 0;
      const isUpper = r.settings.upper;
      const fontStyle = `font-family: ${getFontFamily(r.settings.font)}; font-variant-ligatures: ${r.settings.lig ? 'common-ligatures' : 'none'}; font-feature-settings: "kern" ${r.settings.kern ? 1 : 0}; text-transform: ${isUpper ? 'uppercase' : 'none'};`;

      function onMouseMove(moveEvent) {
        const dx = (moveEvent.clientX - startX) / scaleFactor;
        const dy = (moveEvent.clientY - startY) / scaleFactor;

        if (edge === 'r') {
          r.pts_width = Math.max(1, startPtsWidth + dx);
        } else if (edge === 'l') {
          const actualDx = Math.min(dx, startPtsWidth - 1);
          r.pts_x = startPtsX + actualDx;
          r.pts_width = startPtsWidth - actualDx;
        } else if (edge === 'b') {
          r.pts_height = Math.max(1, startPtsHeight + dy);
        } else if (edge === 't') {
          const actualDy = Math.min(dy, startPtsHeight - 1);
          r.pts_y = startPtsY + actualDy;
          r.pts_height = startPtsHeight - actualDy;
        }

        const overlay = document.getElementById(`redaction-idx-${idx}`);
        if (overlay) {
          overlay.style.setProperty('--pts-x', `${r.pts_x}px`);
          overlay.style.setProperty('--pts-y', `${r.pts_y}px`);
          overlay.style.setProperty('--pts-width', `${r.pts_width}px`);
          overlay.style.setProperty('--pts-height', `${r.pts_height}px`);
        }

        const rowEl = document.getElementById(`match-row-${idx}`);
        if (rowEl) {
          rowEl.children[1].textContent = r.pts_width.toFixed(2);
          rowEl.children[2].textContent = r.pts_height.toFixed(2);

          const matches = state.candidates.filter(c => {
            const w = r.widths[c];
            return w !== undefined && Math.abs(w - r.pts_width) <= tol;
          });
          const matchHtml = matches.length
            ? `<span style="color:#81c995; ${fontStyle}">${matches.map(m => isUpper ? m.toUpperCase() : m).join(', ')}</span>`
            : `<span class="no-match">No obvious matches</span>`;
          rowEl.children[3].innerHTML = matchHtml;
          const label = overlay.querySelector('.redaction-label');
          if (label) {
            const basePx = r.settings.size * (r.settings.scale / 100);
            
            label.style.fontFamily = getFontFamily(r.settings.font);
            label.style.fontSize = `calc(${basePx}px * var(--scale-factor, 1))`;
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
          }

        }

        // Re-evaluate matching candidates total count
        let matchCount = 0;
        state.redactions.forEach(rItem => {
          if (state.candidates.some(c => rItem.widths && rItem.widths[c] !== undefined && Math.abs(rItem.widths[c] - rItem.pts_width) <= rItem.settings.tol)) {
            matchCount++;
          }
        });
        els.allMatchesSummary.textContent = `${matchCount} of ${state.redactions.length} redactions have potential matches.`;
      }

      function onMouseUp() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    /* Thumbnails */
    async function renderThumbnails() {
      els.thumbnailView.innerHTML = '';
      for (let i = 1; i <= state.pdfDoc.numPages; i++) {
        const thumbCont = document.createElement('div');
        thumbCont.className = 'thumbnail-container';

        const canvas = document.createElement('canvas');
        canvas.className = 'thumbnail';

        const lbl = document.createElement('div');
        lbl.className = 'thumbnail-page-num';
        lbl.textContent = i;

        thumbCont.appendChild(canvas);
        thumbCont.appendChild(lbl);
        els.thumbnailView.appendChild(thumbCont);

        thumbCont.addEventListener('click', () => {
          document.querySelectorAll('.thumbnail-container').forEach(c => c.classList.remove('active'));
          thumbCont.classList.add('active');
          document.getElementById(`pageContainer${i}`)?.scrollIntoView({ behavior: 'smooth' });
          els.pageInputElem.value = i;
        });

        const page = await state.pdfDoc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const scale = 180 / vp.width; // 180px thumbnails
        const scaledVp = page.getViewport({ scale });

        canvas.width = scaledVp.width;
        canvas.height = scaledVp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledVp }).promise;
      }
    }