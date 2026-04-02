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
      });

      els.toggleToolsBtn.addEventListener('click', () => {
        els.toolsSidebar.classList.toggle('hidden');
        els.toggleToolsBtn.classList.toggle('active');
      });

      if (els.toggleWebglBtn) {
        els.toggleWebglBtn.addEventListener('click', () => {
          els.toggleWebglBtn.classList.toggle('active');
          const isWebglActive = els.toggleWebglBtn.classList.contains('active');
          
          document.querySelectorAll('.webgl-overlay').forEach(canvas => {
            canvas.style.display = isWebglActive ? 'block' : 'none';
          });
          
          if (isWebglActive) {
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
      [els.font, els.size, els.calcScale, els.kern, els.lig, els.upper, els.tol].filter(Boolean).forEach(el =>
        el.addEventListener('change', () => {
          if (state.selectedRedactionIdx !== null && state.redactions[state.selectedRedactionIdx]) {
            const r = state.redactions[state.selectedRedactionIdx];
            r.settings.font = els.font?.value ?? r.settings.font;
            r.settings.size = parseFloat(els.size?.value) || r.settings.size || 12;
            r.settings.scale = parseFloat(els.calcScale?.value) || r.settings.scale || 100;
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

      // 3. Auto-load the default PDF on startup
      try {
        const resp = await fetch('/analyze-default');
        if (resp.ok) {
          const data = await resp.json();
          state.hasPdf = true;
          els.titleElem.textContent = data.default_filename || 'efta00018586.pdf';
          state.redactions = [];
          state.selectedRedactionIdx = null;
          state.pageImages = [];
          state.numPages = 0;
          if (els.allMatchesCard) els.allMatchesCard.style.display = 'none';
          if (typeof resetFabricCanvases === 'function') resetFabricCanvases();

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

          const autoScale = data.suggested_scale || 178;
          const autoSize = data.suggested_size || 12;
          const autoFont = data.suggested_font || null;

          if (els.calcScale) els.calcScale.value = autoScale;
          if (els.size) els.size.value = autoSize;
          if (autoFont && els.font) {
            const opt = Array.from(els.font.options).find(o => o.value === autoFont);
            if (opt) els.font.value = autoFont;

            const fabricFont = ttfToFabricFont(autoFont);
            if (fabricFont) {
              const fabricSel = document.getElementById('fabric-font-family');
              if (fabricSel && Array.from(fabricSel.options).find(o => o.value === fabricFont)) {
                fabricSel.value = fabricFont;
                if (typeof textOptions !== 'undefined') textOptions.fontFamily = fabricFont;
              }
            }
          }

          state.redactions = data.redactions.map(r => ({
            ...r,
            settings: {
              font: els.font?.value ?? 'times.ttf',
              size: autoSize,
              scale: autoScale,
              tol: parseFloat(els.tol?.value) || 0,
              kern: els.kern?.checked ?? false,
              lig: els.lig?.checked ?? false,
              upper: els.upper?.checked ?? false
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
            fetchMasksAsync(null, true);
          }
        }
      } catch (e) {
        console.warn('Auto-load of default PDF failed:', e.message);
      }

    })();