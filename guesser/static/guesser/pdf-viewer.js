/* =========================================================
       PDF.js Rendering & Overlays Pipeline
       ========================================================= */
    async function handleFileUpload() {
      const file = els.pdfFile.files[0] || (event.dataTransfer && event.dataTransfer.files[0]);
      if (!file) return;

      els.titleElem.textContent = file.name;
      els.pdfStatus.textContent = "Analyzing in backend...";
      els.analyzeBtn.disabled = true;
      state.redactions = [];
      state.selectedRedactionIdx = null;
      els.allMatchesCard.style.display = 'none';

      // 1. Send to server for analysis AND 2. Render locally locally 
      try {
        // Local Preview Pipeline (PDF.js file parsing)
        const fileReader = new FileReader();
        fileReader.onload = async function () {
          const typedarray = new Uint8Array(this.result);
          state.pdfDoc = await pdfjsLib.getDocument(typedarray).promise;

          els.pageCountElem.textContent = `/ ${state.pdfDoc.numPages}`;
          els.pageInputElem.value = 1;
          els.pageInputElem.max = state.pdfDoc.numPages;

          await renderEntireDocument();
          renderThumbnails();
        };
        fileReader.readAsArrayBuffer(file);

        // Server Pipeline (AI Analysis)
        const fd = new FormData();
        fd.append('file', file);

        const resp = await fetch('/analyze-pdf', { method: 'POST', body: fd });
        if (!resp.ok) throw new Error((await resp.json()).detail);

        const data = await resp.json();

        // Auto-font detection
        let autoScale = 100;
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

        // Initialize each redaction with a clone of current DOM settings
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
          // Per-redaction label state so text is fully independent
          labelText: '',
          manualLabel: false
        }));

        await calculateAllWidths();

        els.pdfStatus.textContent = `${state.redactions.length} redactions.`;

        // Inject overlays into their specific rendered page containers!
        injectRedactionOverlays();
        
        if (state.redactions.length > 0) {
            selectRedaction(0);
        } else {
            updateAllMatchesView();
        }

      } catch (e) {
        els.pdfStatus.textContent = "Error: " + e.message;
        els.pdfStatus.classList.add('error');
      } finally {
        els.analyzeBtn.disabled = false;
      }
    }

    async function renderEntireDocument() {
      els.viewer.innerHTML = '';
      updateCSSZoom();

      for (let pageNum = 1; pageNum <= state.pdfDoc.numPages; pageNum++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        pageContainer.id = `pageContainer${pageNum}`;

        // Get base canvas dimensions (scale 1)
        const page = await state.pdfDoc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1.0 });

        // Feed CSS calc variables so --scale-factor can multiply width/height natively
        pageContainer.style.setProperty('--page-width', `${baseViewport.width}px`);
        pageContainer.style.setProperty('--page-height', `${baseViewport.height}px`);

        const canvas = document.createElement('canvas');
        canvas.id = `page${pageNum}`;
        pageContainer.appendChild(canvas);
        els.viewer.appendChild(pageContainer);

        await renderPage(pageNum, canvas);
      }

      // Re-inject overlays if they were already parsed
      injectRedactionOverlays();
    }

    async function renderPage(pageNum, canvas) {
      if (!state.pdfDoc) return;
      const page = await state.pdfDoc.getPage(pageNum);

      // Render scale ensures sharp text if user zooms into 3x, canvas needs 3x pixel capacity.
      const pixelRatio = window.devicePixelRatio || 1;
      const renderScale = Math.max(state.currentZoom, 1.0) * pixelRatio;
      const viewport = page.getViewport({ scale: renderScale });

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport: viewport }).promise;
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

        // CSS Vars logic for synchronous zoom scaling
        overlay.style.setProperty('--pts-x', `${r.pts_x}px`);
        overlay.style.setProperty('--pts-y', `${r.pts_y}px`);
        overlay.style.setProperty('--pts-width', `${r.pts_width}px`);
        overlay.style.setProperty('--pts-height', `${r.pts_height}px`);

        overlay.onclick = (e) => {
          e.stopPropagation();
          selectRedaction(idx);
        };

        ['l', 'r', 't', 'b'].forEach(edge => {
          const resizer = document.createElement('div');
          resizer.className = `resizer resizer-${edge}`;
          resizer.onmousedown = (e) => initResize(e, idx, edge);
          overlay.appendChild(resizer);
        });

        // We'll append an editable label to the left of the overlay
        const label = document.createElement('div');
        label.className = 'redaction-label';
        label.contentEditable = 'true';
        label.spellcheck = false;
        // Initialize from per-redaction state
        label.textContent = r.labelText || '';
        label.dataset.manualEdit = r.manualLabel ? 'true' : 'false';
        // Prevent typing from triggering drag/resize of the box itself
        label.onmousedown = (e) => {
          e.stopPropagation();
          selectRedaction(idx); // Make sure selecting the text also highlights the box
        };
        label.onclick = (e) => e.stopPropagation();

        // As soon as the user types, treat this label as manual
        label.oninput = () => {
          if (state.redactions[idx]) {
            state.redactions[idx].labelText = label.textContent || '';
            state.redactions[idx].manualLabel = true;
            label.dataset.manualEdit = 'true';
          }
        };

        // Also persist on blur (in case of paste or last change)
        label.onblur = () => {
          if (state.redactions[idx]) {
            state.redactions[idx].labelText = label.textContent || '';
            state.redactions[idx].manualLabel = true;
            label.dataset.manualEdit = 'true';
          }
        };
        
        overlay.appendChild(label);


        // Reapply selection state if we were rendering while clicked
        if (idx === state.selectedRedactionIdx) overlay.classList.add('selected');

        container.appendChild(overlay);
      });
    }