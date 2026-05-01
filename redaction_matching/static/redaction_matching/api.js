/* =========================================================
       Inspection Logic — reads/writes utbState.boxes directly
       ========================================================= */

    // ── Helpers ─────────────────────────────────────────────────

    /** Get all redaction-type UTB boxes. */
    function getRedactionBoxes() {
      return typeof utbState !== 'undefined'
        ? utbState.boxes.filter(b => b.type === 'redaction')
        : [];
    }

    /** Get the currently selected redaction box (or null). */
    function getSelectedRedaction() {
      if (typeof utbState === 'undefined' || !utbState.selectedId) return null;
      const box = utbState.getBox(utbState.selectedId);
      return box && box.type === 'redaction' ? box : null;
    }

    // ── Candidate management ──────────────────────────────────

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

    // ── Width calculation ─────────────────────────────────────

    function calculateAllWidths() {
        const boxes = getRedactionBoxes();
        if (boxes.length === 0) return;
        boxes.forEach(box => calculateWidthsForRedaction(box.id));
    }

    function calculateWidthsForRedaction(boxId) {
      const box = typeof utbState !== 'undefined' ? utbState.getBox(boxId) : null;
      if (!box || box.type !== 'redaction') return;

      if (state.candidates.length === 0) {
        box.widths = {};
        if (utbState.selectedId === boxId) {
            renderCandidates();
        }
        return;
      }

      // Find the actual SVG text element in the DOM to guarantee 100% parity
      let textEl = document.querySelector(`.utb-group[data-id="${box.id}"] .utb-text`);
      
      // If it's not rendered yet, force a render
      if (!textEl && typeof renderBox === 'function') {
        renderBox(box);
        textEl = document.querySelector(`.utb-group[data-id="${box.id}"] .utb-text`);
      }

      let isOffscreen = false;
      if (!textEl) {
        // Fallback: Page not rendered yet. Use offscreen SVG.
        textEl = _getMeasureTextEl();
        isOffscreen = true;
        
        textEl.setAttribute('font-size', box.fontSize || 16);
        let fontFamily = `"${box.fontFamily || 'Times New Roman'}"`;
        if (box.renderFont) fontFamily = `"etv_${box.renderFont}", ${fontFamily}`;
        textEl.setAttribute('font-family', fontFamily);
        
        if (box.bold) textEl.setAttribute('font-weight', 'bold');
        else textEl.removeAttribute('font-weight');
        
        if (box.italic) textEl.setAttribute('font-style', 'italic');
        else textEl.removeAttribute('font-style');
        
        if (box.letterSpacing) textEl.setAttribute('letter-spacing', `${box.letterSpacing}em`);
        else textEl.removeAttribute('letter-spacing');
      }

      const originalText = textEl.textContent;
      box.widths = {};

      state.candidates.forEach(c => {
        const disp = box.uppercase ? c.toUpperCase() : c;
        textEl.textContent = disp;
        box.widths[c] = textEl.getBBox().width;
      });

      // Restore original text only if we modified the real DOM node
      if (!isOffscreen) {
        textEl.textContent = originalText;
      }

      if (utbState.selectedId === boxId) {
          renderCandidates();
          updateAllMatchesView(boxId);
      }
    }

    // Reusable hidden SVG text element for width measurement fallback
    let _measureSvg = null;
    let _measureTextEl = null;

    function _getMeasureTextEl() {
      if (!_measureSvg) {
        _measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        _measureSvg.style.position = 'absolute';
        _measureSvg.style.visibility = 'hidden';
        _measureSvg.style.pointerEvents = 'none';
        _measureSvg.style.width = '0';
        _measureSvg.style.height = '0';
        _measureTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        _measureSvg.appendChild(_measureTextEl);
        document.body.appendChild(_measureSvg);
      }
      return _measureTextEl;
    }

    // ── Pagination & sorting ──────────────────────────────────

    function changePage(delta) {
      state.page += delta;
      renderCandidates();
    }

    function setSort(f) {
      if (state.sortBy === f) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortBy = f; state.sortDir = 'asc'; }
      state.page = 1;
      renderCandidates();
    }

    // ── Candidates table ──────────────────────────────────────

    function renderCandidates() {
      document.getElementById('sort-icon').textContent = state.sortDir === 'asc' ? '▲' : '▼';

      const box = getSelectedRedaction();
      if (!box) {
          els.tableBody.innerHTML = '';
          els.pageInfo.textContent = `List: ${state.candidates.length}`;
          return;
      }

      const isUpper = box.uppercase;
      const sorted = [...state.candidates].sort((a, b) => {
        let va = state.sortBy === 'width' ? (box.widths[a] || 0) : a.toLowerCase();
        let vb = state.sortBy === 'width' ? (box.widths[b] || 0) : b.toLowerCase();
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
        const w = box.widths[n];
        const isMatch = w !== undefined && Math.abs(w - box.w) <= box.tolerance;
        const esc = n.replace(/'/g, "&apos;");
        const disp = isUpper ? n.toUpperCase() : n;
        const rowClass = isMatch ? 'best-match' : '';

        return `
          <tr class="${rowClass}">
            <td style="font-family:${box.fontFamily || 'inherit'};">
              ${isMatch ? '<span class="material-symbols-outlined" style="font-size:12px; vertical-align:middle; color:#81c995; margin-right:4px;">check_circle</span>' : ''}
              ${disp}
            </td>
            <td class="col-right">${w !== undefined ? w.toFixed(2) : '-'}</td>
            <td class="col-del"><button class="btn-del" onclick="removeName('${esc.replace(/'/g, "\\'")}')">&times;</button></td>
          </tr>
        `;
      }).join('');
    }


    // ── Selection ─────────────────────────────────────────────

    async function selectRedaction(boxId) {
      const box = typeof utbState !== 'undefined' ? utbState.getBox(boxId) : null;
      if (!box || box.type !== 'redaction') return;

      // Navigate to the redaction's page first if not already there
      if (state.currentPage !== box.page) {
        await goToPage(box.page);
      }

      utbState.selectedId = box.id;

      // Redaction-specific controls
      els.tol.value = box.tolerance;
      els.kern.checked = !!box.kerning;
      els.lig.checked = !!box.ligatures;
      els.upper.checked = !!box.uppercase;

      // Deselect all SVG groups, then select this one
      if (typeof selectBoxInSVG === 'function') selectBoxInSVG(box.id);

      // Sync the formatting toolbar
      if (typeof syncToolbarToBox === 'function') syncToolbarToBox(box);

      // Highlight the matching row in the All Matches table
      document.querySelectorAll('#all-matches-body tr').forEach(el => el.classList.remove('selected-row'));
      const rowEl = document.getElementById(`match-row-${box.id}`);
      if (rowEl) {
        rowEl.classList.add('selected-row');
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Scroll the SVG element into view within the viewer
      const svgGroup = document.querySelector(`.utb-group[data-id="${box.id}"]`);
      if (svgGroup) {
        const parentRect = els.viewerContainer.getBoundingClientRect();
        const targetRect = svgGroup.getBoundingClientRect();
        if (targetRect.top < parentRect.top || targetRect.bottom > parentRect.bottom) {
          els.viewerContainer.scrollTo({
            top: els.viewerContainer.scrollTop + (targetRect.top - parentRect.top) - (parentRect.height / 2),
            behavior: 'smooth'
          });
        }
      }

      renderCandidates();
      updateAllMatchesView(boxId);
    }

    // ── All Matches summary view ──────────────────────────────

    function updateAllMatchesView(onlyId = null) {
      const redactionBoxes = getRedactionBoxes();

      if (!redactionBoxes.length) {
        els.allMatchesCard.style.display = 'none';
        return;
      }

      els.allMatchesCard.style.display = 'block';
      let matchCount = 0;

      els.allMatchesBody.innerHTML = redactionBoxes.map(box => {
        const tol = box.tolerance;
        const isUpper = box.uppercase;
        const fontStyle = `font-family: ${box.fontFamily || 'inherit'}; font-variant-ligatures: ${box.ligatures ? 'common-ligatures' : 'none'}; font-feature-settings: "kern" ${box.kerning ? 1 : 0}; text-transform: ${isUpper ? 'uppercase' : 'none'};`;

        const matches = state.candidates.filter(c => {
          const w = box.widths[c];
          return w !== undefined && Math.abs(w - box.w) <= tol;
        });

        if (matches.length) matchCount++;

        // Label text is always driven by the best match
        if (onlyId === null || onlyId === box.id) {
          const newLabel = matches.length > 0 ? (isUpper ? matches[0].toUpperCase() : matches[0]) : '';
          box.text = newLabel;
          box.labelText = newLabel;
          if (typeof renderBox === 'function') renderBox(box);
        }

        const matchHtml = matches.length
          ? `<span style="color:#81c995; ${fontStyle}">${matches.map(m => isUpper ? m.toUpperCase() : m).join(', ')}</span>`
          : `<span class="no-match">No obvious matches</span>`;

        const isSelected = utbState.selectedId === box.id ? 'selected-row' : '';

        return `
          <tr id="match-row-${box.id}" class="${isSelected}" style="cursor: pointer;" onclick="selectRedaction('${box.id}')" title="Click to view on document">
            <td>${box.page}</td>
            <td class="col-right">${box.w.toFixed(2)}</td>
            <td>${matchHtml}</td>
          </tr>
        `;
      }).join('');

      els.allMatchesSummary.textContent = `${matchCount} of ${redactionBoxes.length} redactions have potential matches.`;

      const progress = redactionBoxes.length ? (matchCount / redactionBoxes.length) * 100 : 0;
      const progressBar = document.getElementById('match-progress-bar');
      if (progressBar) progressBar.style.width = `${progress}%`;
    }


    // ── Redaction creation ────────────────────────────────────

    function handleManualAddBox(pageNum, pxX, pxY) {
      const nearestLine = typeof utbFindNearestLine === 'function'
        ? utbFindNearestLine(pageNum, pxY, 2.0) : null;

      const finalY      = nearestLine ? nearestLine.y      : pxY;
      const finalH      = nearestLine ? nearestLine.h      : 20;
      const finalLineId = nearestLine ? nearestLine.lineId : null;
      const lineFont    = nearestLine?.font;
      const lineFontSz  = nearestLine?.fontSize;

      createNewRedaction(pageNum, pxX - 50, finalY, 100, finalH, finalLineId, lineFont, lineFontSz);
    }

    function createNewRedaction(pageNum, x, y, width, height, lineId = null, lineFont = null, lineFontSz = null) {
      const normFn = typeof normUtbFont === 'function' ? normUtbFont : (n => n);
      const fontFamily = (lineFont ? normFn(lineFont) : null)
                      || document.getElementById('fabric-font-family')?.value
                      || 'Times New Roman';
      const fontSize   = lineFontSz
                      || parseInt(document.getElementById('fabric-font-size')?.value)
                      || 16;

      const newBox = utbState.addBox(new UnifiedTextBox({
        type:       'redaction',
        page:       pageNum,
        text:       '',
        lineId:     lineId,
        x: x, y: y, w: width, h: height,
        fontFamily:   fontFamily,
        fontSize:     fontSize,
        kerning:      els.kern?.checked ?? true,
        ligatures:    els.lig?.checked ?? true,
        uppercase:    els.upper?.checked ?? false,
        tolerance:    parseFloat(els.tol?.value) || 0,
        widths:       {},
        labelText:    '',
        manualLabel:  false,
      }));

      if (typeof renderBox === 'function') renderBox(newBox);

      selectRedaction(newBox.id);
      calculateWidthsForRedaction(newBox.id);
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