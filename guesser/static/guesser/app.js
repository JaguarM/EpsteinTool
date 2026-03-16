/* =========================================================
       Initialization
       ========================================================= */
    (async function init() {
      // 1. Fetch available fonts
      try {
        const resp = await fetch('/fonts-list');
        const fonts = await resp.json();
        fonts.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f;
          opt.textContent = f;
          els.font.appendChild(opt);
        });
        if (fonts.includes('times.ttf')) els.font.value = 'times.ttf';
      } catch (e) {
        console.error("Font load error:", e);
      }

      // 2. Event Listeners for Viewer functionality
      els.toggleSidebarBtn.addEventListener('click', () => {
        els.sidebar.classList.toggle('hidden');
        els.toggleSidebarBtn.classList.toggle('active');
        setTimeout(() => applyRealZoomDebounced(), 300); // redraw canvas cleanly after flex resize
      });

      els.toggleToolsBtn.addEventListener('click', () => {
        els.toolsSidebar.classList.toggle('hidden');
        els.toggleToolsBtn.classList.toggle('active');
        setTimeout(() => applyRealZoomDebounced(), 300);
      });

      // Zoom commands
      els.zoomInBtn.addEventListener('click', () => { state.currentZoom *= 1.1; applyZoom(); });
      els.zoomOutBtn.addEventListener('click', () => { state.currentZoom /= 1.1; applyZoom(); });
      els.zoomInputElem.addEventListener('change', (e) => {
        let val = parseInt(e.target.value.replace('%', ''));
        if (!isNaN(val)) {
          state.currentZoom = val / 100;
          applyZoom();
        } else {
          updateZoomLevelText();
        }
      });

      // Ctrl+Wheel Zoom
      els.viewerContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const prevZoom = state.currentZoom;
          state.currentZoom *= Math.pow(1.005, -e.deltaY);
          state.currentZoom = Math.min(Math.max(state.currentZoom, state.minZoom), state.maxZoom);

          // Keep mouse mounted zoom
          const rect = els.viewerContainer.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const docX = (els.viewerContainer.scrollLeft + mouseX) / prevZoom;
          const docY = (els.viewerContainer.scrollTop + mouseY) / prevZoom;

          updateCSSZoom();
          els.viewerContainer.scrollLeft = (docX * state.currentZoom) - mouseX;
          els.viewerContainer.scrollTop = (docY * state.currentZoom) - mouseY;
          applyRealZoomDebounced();
        }
      }, { passive: false });

      // Drag overlay standard
      window.addEventListener('dragover', (e) => { e.preventDefault(); els.dragOverlay.classList.remove('hidden'); });
      els.dragOverlay.addEventListener('dragleave', (e) => { e.preventDefault(); els.dragOverlay.classList.add('hidden'); });
      window.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dragOverlay.classList.add('hidden');
        if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type === 'application/pdf') {
          els.pdfFile.files = e.dataTransfer.files;
          handleFileUpload();
        }
      });

      // Regular file select
      els.pdfFile.addEventListener('change', handleFileUpload);

      // Candidate events
      els.nameInput.addEventListener('keydown', e => e.key === 'Enter' && addName());
      [els.font, els.size, els.calcScale, els.kern, els.lig, els.upper, els.tol].forEach(el =>
        el.addEventListener('change', () => { 
          if (state.selectedRedactionIdx !== null && state.redactions[state.selectedRedactionIdx]) {
            const r = state.redactions[state.selectedRedactionIdx];
            r.settings.font = els.font.value;
            r.settings.size = parseFloat(els.size.value) || 12;
            r.settings.scale = parseFloat(els.calcScale.value) || 100;
            r.settings.tol = parseFloat(els.tol.value) || 0;
            r.settings.kern = els.kern.checked;
            r.settings.lig = els.lig.checked;
            r.settings.upper = els.upper.checked;

            if (el === els.tol) {
              updateAllMatchesView(); // Tolerance doesn't need re-fetch, just re-filter
              // Also trigger overlay re-render to update the guessed text label
              selectRedaction(state.selectedRedactionIdx);
            } else {
              calculateWidthsForRedaction(state.selectedRedactionIdx);
            }
          }
        })
      );

      // Scroll Page sync
      els.viewerContainer.addEventListener('scroll', () => {
        if (!state.pdfDoc) return;
        const containerMid = els.viewerContainer.scrollTop + (els.viewerContainer.clientHeight / 2);
        let closestPage = 1, minDistance = Infinity;

        for (let i = 1; i <= state.pdfDoc.numPages; i++) {
          const pageContainer = document.getElementById(`pageContainer${i}`);
          if (pageContainer) {
            const rect = pageContainer.getBoundingClientRect();
            const parentRect = els.viewerContainer.getBoundingClientRect();
            const pageMid = rect.top - parentRect.top + els.viewerContainer.scrollTop + (rect.height / 2);
            const dist = Math.abs(containerMid - pageMid);
            if (dist < minDistance) { minDistance = dist; closestPage = i; }
          }
        }
        els.pageInputElem.value = closestPage;
      });

      // Jump to page
      els.pageInputElem.addEventListener('change', (e) => {
        if (!state.pdfDoc) return;
        let p = parseInt(e.target.value);
        if (isNaN(p) || p < 1) p = 1;
        if (p > state.pdfDoc.numPages) p = state.pdfDoc.numPages;
        e.target.value = p;
        document.getElementById(`pageContainer${p}`)?.scrollIntoView({ behavior: 'smooth' });
      });

    })();