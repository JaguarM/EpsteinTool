/* =========================================================
       Inspection Logic
       ========================================================= */
    function addName() {
      const v = els.nameInput.value.trim();
      if (v && !state.candidates.includes(v)) {
        state.candidates.push(v);
        els.nameInput.value = '';
        calculateAllWidths();
      }
    }
    function processPaste() {
      const lines = els.pasteInput.value.split('\n').map(l => l.trim()).filter(l => l);
      let added = 0;
      lines.forEach(l => { if (!state.candidates.includes(l)) { state.candidates.push(l); added++; } });
      if (added > 0) calculateAllWidths();
      els.pasteInput.value = '';
      document.getElementById('paste-area').style.display = 'none';
      if (added > 0) console.log(`%c[Premium] Imported ${added} names!`, "color: #8ab4f8; font-weight: bold;");
    }

    function clearAll() {
      if (confirm('Clear names?')) { state.candidates = []; calculateAllWidths(); }
    }
    function removeName(name) {
      state.candidates = state.candidates.filter(c => c !== name);
      calculateAllWidths();
    }

    async function calculateAllWidths() {
        if (!state.redactions || state.redactions.length === 0) return;
        const promises = state.redactions.map((_, idx) => calculateWidthsForRedaction(idx));
        await Promise.all(promises);
    }

    async function calculateWidthsForRedaction(idx) {
      if (state.candidates.length === 0) {
        state.redactions[idx].widths = {};
        if (idx === state.selectedRedactionIdx) {
            renderCandidates();
        }
        return;
      }
      
      const r = state.redactions[idx];
      const s = r.settings;
      
      try {
        const useCal = typeof window.calState !== 'undefined' && window.calState.loaded;

        const resp = await fetch('/widths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strings: state.candidates,
            font: fontFamilyToTtf(s.fontFamily),
            size: s.fontSize,
            scale: 100,
            kerning: s.kern,
            ligatures: s.lig,
            force_uppercase: s.upper,
            use_calibration: useCal,
            spans: typeof etvState !== 'undefined' && etvState.spans ? etvState.spans : (typeof state !== 'undefined' && state.spans ? state.spans : [])
          })
        });
        
        if (!resp.ok) throw new Error("API Offline");
        
        const d = await resp.json();
        r.widths = {};
        d.results.forEach(res => r.widths[res.text] = res.width);
        
        if (idx === state.selectedRedactionIdx) {
            renderCandidates();
            updateAllMatchesView(idx);
        }
      } catch (e) {
        console.warn("HarfBuzz API unavailable, falling back to Canvas measureText", e);
        
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        const fontStyle = s.italic ? 'italic ' : '';
        const fontWeight = s.bold ? 'bold ' : '';
        const fontSizeStr = `${s.fontSize || 16}px`;
        const fontFamilyStr = `"${s.fontFamily || 'Times New Roman'}"`;
        ctx.font = `${fontStyle}${fontWeight}${fontSizeStr} ${fontFamilyStr}`;
        
        r.widths = {};
        state.candidates.forEach(c => {
           let disp = s.upper ? c.toUpperCase() : c;
           // In canvas, widths are directly in pixels, but without the precision Harfbuzz scale factors.
           r.widths[c] = ctx.measureText(disp).width;
        });

        if (idx === state.selectedRedactionIdx) {
            renderCandidates();
            updateAllMatchesView(idx);
        }
      }
    }

    function changePage(delta) {
      state.page += delta;
      renderCandidates();
    }

    function setSort(f) {
      if (state.sortBy === f) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortBy = f; state.sortDir = 'asc'; }
      state.page = 1; // reset to page 1 on sort
      renderCandidates();
    }

    function renderCandidates() {
      document.getElementById('sort-icon').textContent = state.sortDir === 'asc' ? '▲' : '▼';

      if (state.selectedRedactionIdx === null || !state.redactions[state.selectedRedactionIdx]) {
          els.tableBody.innerHTML = '';
          els.pageInfo.textContent = `List: ${state.candidates.length}`;
          return;
      }

      const r = state.redactions[state.selectedRedactionIdx];
      const isUpper = r.settings.upper;
      const sorted = [...state.candidates].sort((a, b) => {
        let va = state.sortBy === 'width' ? (r.widths[a] || 0) : a.toLowerCase();
        let vb = state.sortBy === 'width' ? (r.widths[b] || 0) : b.toLowerCase();
        if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      const totalPages = Math.ceil(sorted.length / state.perPage) || 1;
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const start = (state.page - 1) * state.perPage;
      const slice = sorted.slice(start, start + state.perPage);
      els.pageInfo.textContent = `List: ${state.candidates.length} (${state.page}/${totalPages})`;

      const btnPrev = document.getElementById('btn-prev-page');
      const btnNext = document.getElementById('btn-next-page');
      if (btnPrev) btnPrev.disabled = state.page <= 1;
      if (btnNext) btnNext.disabled = state.page >= totalPages;

      els.tableBody.innerHTML = slice.map(n => {
        const w = r.widths[n];
        const isMatch = w !== undefined && Math.abs(w - r.width) <= r.settings.tol;
        const esc = n.replace(/'/g, "&apos;");
        const disp = isUpper ? n.toUpperCase() : n;
        const rowClass = isMatch ? 'best-match' : '';
        
        return `
          <tr class="${rowClass}">
            <td style="font-family:${r.settings.fontFamily || 'inherit'};">
              ${isMatch ? '<span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle; color:#81c995; margin-right:4px;">check_circle</span>' : ''}
              ${disp}
            </td>
            <td class="col-right">${w !== undefined ? w.toFixed(2) : '-'}</td>
            <td class="col-del"><button class="btn-del" onclick="removeName('${esc.replace(/'/g, "\\'")}')">&times;</button></td>
          </tr>
        `;
      }).join('');
    }


    async function selectRedaction(idx) {
      if (!state.redactions[idx]) return;
      const r = state.redactions[idx];

      // Navigate to the redaction's page first if not already there
      if (state.currentPage !== r.page) {
        await goToPage(r.page);
      }

      state.selectedRedactionIdx = idx;

      // Redaction-specific controls (not part of the unified font toolbar)
      const s = r.settings;
      els.tol.value = s.tol;
      els.kern.checked = !!s.kern;
      els.lig.checked = !!s.lig;
      els.upper.checked = !!s.upper;

      document.querySelectorAll('.redaction-overlay').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('#all-matches-body tr').forEach(el => el.classList.remove('selected-row'));

      const rowEl = document.getElementById(`match-row-${idx}`);
      if (rowEl) {
        rowEl.classList.add('selected-row');
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      const el = document.getElementById(`redaction-idx-${idx}`);
      if (el) {
        el.classList.add('selected');
        // Scroll redaction into view within the viewer if needed
        const parentRect = els.viewerContainer.getBoundingClientRect();
        const targetRect = el.getBoundingClientRect();
        if (targetRect.top < parentRect.top || targetRect.bottom > parentRect.bottom) {
          els.viewerContainer.scrollTo({
            top: els.viewerContainer.scrollTop + (targetRect.top - parentRect.top) - (parentRect.height / 2),
            behavior: 'smooth'
          });
        }
        
        // updateAllMatchesView writes r.settings.* to label inline styles first,
        // then label.focus() triggers focusin → syncBarToSpan(label) in text-tool.js
        const label = el.querySelector('.etv-span.redaction-label');
        if (label) {
          updateAllMatchesView(idx);
          renderCandidates();
          label.focus();
          return; // updateAllMatchesView and renderCandidates already called above
        }
      }

      // Fallback if overlay/label not in DOM yet
      renderCandidates();
      updateAllMatchesView(idx);
    }

    function updateAllMatchesView(onlyIdx = null) {
      if (!state.redactions.length) {
        els.allMatchesCard.style.display = 'none';
        return;
      }

      els.allMatchesCard.style.display = 'block';
      let matchCount = 0;

      els.allMatchesBody.innerHTML = state.redactions.map((r, idx) => {
        const tol = r.settings.tol;
        const isUpper = r.settings.upper;
        const fontStyle = `font-family: ${r.settings.fontFamily || 'inherit'}; font-variant-ligatures: ${r.settings.lig ? 'common-ligatures' : 'none'}; font-feature-settings: "kern" ${r.settings.kern ? 1 : 0}; text-transform: ${isUpper ? 'uppercase' : 'none'};`;

        const matches = state.candidates.filter(c => {
          const w = r.widths[c];
          return w !== undefined && Math.abs(w - r.width) <= tol;
        });

        if (matches.length) matchCount++;

        // Label text is always driven by the best match (no manual override).
        if (onlyIdx === null || onlyIdx === idx) {
          r.labelText = matches.length > 0 ? (isUpper ? matches[0].toUpperCase() : matches[0]) : '';
        }

        const matchHtml = matches.length
          ? `<span style="color:#81c995; ${fontStyle}">${matches.map(m => isUpper ? m.toUpperCase() : m).join(', ')}</span>`
          : `<span class="no-match">No obvious matches</span>`;

        const isSelected = state.selectedRedactionIdx === idx ? 'selected-row' : '';

        // Update the label on the PDF canvas itself
        const overlay = document.getElementById(`redaction-idx-${idx}`);
        if (overlay && (onlyIdx === null || onlyIdx === idx)) {
          const label = overlay.querySelector('.redaction-label');
          if (label) {
              const fs = r.settings.fontSize || 16;

            label.style.fontFamily = r.settings.fontFamily || 'inherit';
            label.style.setProperty('--etv-fs', `${fs}px`);
            label.style.fontSize = `calc(${fs}px * var(--scale-factor, 1))`;
            label.style.fontVariantLigatures = r.settings.lig ? 'common-ligatures' : 'none';
            label.style.fontFeatureSettings = `"kern" ${r.settings.kern ? 1 : 0}`;
            label.style.textTransform = isUpper ? 'uppercase' : 'none';

            label.style.fontWeight = r.settings.bold ? 'bold' : 'normal';
            label.style.fontStyle = r.settings.italic ? 'italic' : 'normal';
            label.style.textDecoration = r.settings.textDecoration || 'none';
            label.style.letterSpacing = r.settings.letterSpacing || 'normal';
            label.style.color = r.settings.color || '#81c995';

            label.style.display = 'flex';
            label.textContent = r.labelText || '';
            
            // Premium: Add class for glow effect if we have a match
            if (matches.length > 0) {
              overlay.classList.add('has-match');
            } else {
              overlay.classList.remove('has-match');
            }
          }
        }


        return `
          <tr id="match-row-${idx}" class="${isSelected}" style="cursor: pointer;" onclick="selectRedaction(${idx})" title="Click to view on document">
            <td>${r.page}</td>
            <td class="col-right">${r.width.toFixed(2)}</td>
            <td>${matchHtml}</td>
          </tr>
        `;
      }).join('');

      els.allMatchesSummary.textContent = `${matchCount} of ${state.redactions.length} redactions have potential matches.`;
      
      const progress = state.redactions.length ? (matchCount / state.redactions.length) * 100 : 0;
      const progressBar = document.getElementById('match-progress-bar');
      if (progressBar) progressBar.style.width = `${progress}%`;
    }


    // text-format-changed listener removed — persistChangesToState in text-tool.js now
    // handles all r.settings sync (fontFamily, fontSize, bold, italic, color, etc.)
    // for redaction labels via the el.dataset.redactionIdx branch.

    async function handleManualAddBox(pageNum, pxX, pxY) {
      if (typeof findNearestETVLine !== 'function') return;

      const nearestLine = findNearestETVLine(pageNum, pxY, 2.0); // 2x threshold

      // Snap geometry and typography from the nearest ETV line, same as addEmbeddedTextSpan
      const finalY      = nearestLine ? nearestLine.y      : pxY;
      const finalH      = nearestLine ? nearestLine.h      : 20;
      const finalLineId = nearestLine ? nearestLine.lineId : null;
      const lineFont    = nearestLine?.font;
      const lineFontSz  = nearestLine?.fontSize;

      createNewRedaction(pageNum, pxX - 50, finalY, 100, finalH, finalLineId, lineFont, lineFontSz);
    }

    function createNewRedaction(pageNum, x, y, width, height, lineId = null, lineFont = null, lineFontSz = null) {
      // Resolve font: prefer the snapped ETV line's font (normalized to CSS name),
      // then fall back to whatever is in the toolbar, then Times New Roman.
      const normFn = typeof etvNormFont === 'function' ? etvNormFont : (n => n);
      const fontFamily = (lineFont ? normFn(lineFont) : null)
                      || document.getElementById('fabric-font-family')?.value
                      || 'Times New Roman';
      const fontSize   = lineFontSz
                      || parseInt(document.getElementById('fabric-font-size')?.value)
                      || 16;

      const idx = state.redactions.length;
      const newRed = {
        page: pageNum,
        x: x,
        y: y,
        width: width,
        height: height,
        area: width * height,
        lineId: lineId,
        settings: {
          fontFamily,
          fontSize,
          tol: parseFloat(els.tol?.value) || 0,
          kern: els.kern?.checked ?? true,
          lig: els.lig?.checked ?? true,
          upper: els.upper?.checked ?? false
        },
        widths: {},
        labelText: '',
        manualLabel: false
      };
      
      state.redactions.push(newRed);
      
      // Redraw overlays
      if (typeof injectRedactionOverlays === 'function') {
        injectRedactionOverlays();
      }
      
      // Select then immediately calculate widths (selectRedaction sets selectedRedactionIdx
      // so the calculation will call renderCandidates once the fetch completes)
      selectRedaction(idx);
      if (typeof calculateWidthsForRedaction === 'function') calculateWidthsForRedaction(idx);
    }

    function fontFamilyToTtf(fontFamily) {
      const map = {
        'Times New Roman': 'times.ttf',
        'Courier New': 'courier_new.ttf',
        'Arial': 'arial.ttf',
        'Calibri': 'calibri.ttf',
        'Segoe UI': 'segoe_ui.ttf',
        'Verdana': 'verdana.ttf',
      };
      return map[fontFamily] || 'times.ttf';
    }