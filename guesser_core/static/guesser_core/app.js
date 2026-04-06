/* =========================================================
       Initialization
       ========================================================= */
    (async function init() {
      // 1. Event Listeners for Viewer functionality
      els.toggleSidebarBtn.addEventListener('click', () => {
        els.sidebar.classList.toggle('hidden');
        els.toggleSidebarBtn.classList.toggle('active');
      });

      els.toggleToolsBtn.addEventListener('click', () => {
        els.toolsSidebar.classList.toggle('hidden');
        els.toggleToolsBtn.classList.toggle('active');
      });

      if (els.toolAddBoxBtn) {
        els.toolAddBoxBtn.addEventListener('click', () => {
          if (state.activeTool === 'add-box') {
            state.activeTool = null;
            els.toolAddBoxBtn.classList.remove('active');
          } else {
            state.activeTool = 'add-box';
            els.toolAddBoxBtn.classList.add('active');
          }
        });
      }

      if (els.toggleWebglBtn) {
        els.toggleWebglBtn.addEventListener('click', () => {
          els.toggleWebglBtn.classList.toggle('active');
          const isWebglActive = els.toggleWebglBtn.classList.contains('active');

          document.querySelectorAll('.webgl-overlay').forEach(canvas => {
            canvas.style.display = isWebglActive ? 'block' : 'none';
          });

          if (isWebglActive) {
             if (typeof refreshWebGLCanvases === 'function') refreshWebGLCanvases();
             if(els.webglOptionsBar) els.webglOptionsBar.classList.remove('hidden');
             if(els.textOptionsBar) els.textOptionsBar.classList.add('hidden');
             const fabBar = document.getElementById('fabric-options-bar');
             if (fabBar) fabBar.classList.add('hidden');
          } else {
             if(els.webglOptionsBar) els.webglOptionsBar.classList.add('hidden');
             if(els.textOptionsBar) els.textOptionsBar.classList.remove('hidden');
          }
        });
      }

      if (els.maskColor) els.maskColor.addEventListener('input', () => { if (typeof updateWebGLUniforms === 'function') updateWebGLUniforms(); });
      if (els.edgeSubtract) els.edgeSubtract.addEventListener('input', () => { if (typeof updateWebGLUniforms === 'function') updateWebGLUniforms(); });

      function triggerZoomCheck(mouseX = null, mouseY = null) {
        let val = parseInt(els.zoomInputElem.value.replace('%', ''));
        if (!isNaN(val)) {
          const newZoom = val / 100;
          processZoomFromText(newZoom, mouseX, mouseY);
        } else {
          updateZoomLevelText();
        }
      }

      // Zoom commands
      els.zoomInBtn.addEventListener('click', () => { 
        els.zoomInputElem.value = `${Math.round(state.currentZoom * 1.1 * 100)}%`;
        triggerZoomCheck();
      });
      els.zoomOutBtn.addEventListener('click', () => { 
        els.zoomInputElem.value = `${Math.round(state.currentZoom / 1.1 * 100)}%`;
        triggerZoomCheck();
      });
      els.zoomInputElem.addEventListener('change', () => triggerZoomCheck());

      // Click to add box tool logic
      els.viewer.addEventListener('mousedown', async (e) => {
        if (state.activeTool === 'add-box') {
          const pageEl = e.target.closest('.page-container');
          if (!pageEl) return;
          
          const pageNum = parseInt(pageEl.id.replace('pageContainer', ''));
          const rect = pageEl.getBoundingClientRect();
          const scale = state.currentZoom || 1.0;
          const pxX = (e.clientX - rect.left) / scale;
          const pxY = (e.clientY - rect.top) / scale;
          
          if (typeof handleManualAddBox === 'function') {
            handleManualAddBox(pageNum, pxX, pxY);
          }
        }
      });

      // Ctrl+Wheel Zoom
      els.viewerContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const newZoom = state.currentZoom * Math.pow(1.005, -e.deltaY);
          els.zoomInputElem.value = `${Math.round(newZoom * 100)}%`;
          
          const rect = els.viewerContainer.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          triggerZoomCheck(mouseX, mouseY);
        }
      }, { passive: false });

      // Drag overlay standard
      window.addEventListener('dragover', (e) => { e.preventDefault(); els.dragOverlay.classList.remove('hidden'); });
      els.dragOverlay.addEventListener('dragleave', (e) => { e.preventDefault(); els.dragOverlay.classList.add('hidden'); });
      window.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dragOverlay.classList.add('hidden');
        if (e.dataTransfer.files.length > 0) {
          const t = e.dataTransfer.files[0].type;
          const name = e.dataTransfer.files[0].name.toLowerCase();
          const accepted = t === 'application/pdf' || t.startsWith('image/') ||
            /\.(pdf|png|jpe?g|tiff?|bmp|webp)$/.test(name);
          if (accepted) {
            els.pdfFile.files = e.dataTransfer.files;
            handleFileUpload();
          }
        }
      });

      // Regular file select
      els.pdfFile.addEventListener('change', handleFileUpload);

      // Candidate events
      if (els.nameInput) els.nameInput.addEventListener('keydown', e => e.key === 'Enter' && addName());
      [els.kern, els.lig, els.upper, els.tol].filter(Boolean).forEach(el =>
        el.addEventListener('change', () => {
          if (state.selectedRedactionIdx !== null && state.redactions[state.selectedRedactionIdx]) {
            const r = state.redactions[state.selectedRedactionIdx];
            r.settings.tol = parseFloat(els.tol?.value) || 0;
            r.settings.kern = els.kern?.checked ?? r.settings.kern;
            r.settings.lig = els.lig?.checked ?? r.settings.lig;
            r.settings.upper = els.upper?.checked ?? r.settings.upper;

            if (el === els.tol) {
              // Tolerance doesn't need re-fetch, just re-filter for the selected redaction
              if (typeof updateAllMatchesView === 'function') updateAllMatchesView(state.selectedRedactionIdx);
            } else {
              if (typeof calculateWidthsForRedaction === 'function') calculateWidthsForRedaction(state.selectedRedactionIdx);
            }
          }
        })
      );

      // Jump to page
      els.pageInputElem.addEventListener('change', (e) => {
        if (!state.pageImages.length) return;
        let p = parseInt(e.target.value);
        if (isNaN(p) || p < 1) p = 1;
        if (p > state.numPages) p = state.numPages;
        e.target.value = p;
        goToPage(p);
      });

      if (els.prevPageBtn) {
        els.prevPageBtn.addEventListener('click', () => {
          if (state.currentPage > 1) goToPage(state.currentPage - 1);
        });
      }
      if (els.nextPageBtn) {
        els.nextPageBtn.addEventListener('click', () => {
          if (state.currentPage < state.numPages) goToPage(state.currentPage + 1);
        });
      }

      // 3. Auto-load the default PDF on startup
      try {
        const resp = await fetch('/analyze-default');
        if (resp.ok) {
          const data = await resp.json();
          state.hasPdf = true;
          els.titleElem.textContent = data.default_filename || 'efta00018586.pdf';
          await loadDocument(data, null);
        }
      } catch (e) {
        console.warn('Auto-load of default PDF failed:', e.message);
      }

    })();