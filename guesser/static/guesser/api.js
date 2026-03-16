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
      document.getElementById('paste-details').style.display = 'none';
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
        const resp = await fetch('/widths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strings: state.candidates,
            font: s.font,
            size: s.size,
            scale: s.scale,
            kerning: s.kern,
            ligatures: s.lig,
            force_uppercase: s.upper
          })
        });
        const d = await resp.json();
        r.widths = {};
        d.results.forEach(res => r.widths[res.text] = res.width);
        
        if (idx === state.selectedRedactionIdx) {
            renderCandidates();
            // Recompute matches and update the overlay label styling only for this redaction
            updateAllMatchesView(idx);
        }
      } catch (e) {
        console.error("Width logic error", e);
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
        const esc = n.replace(/'/g, "&apos;");
        const disp = isUpper ? n.toUpperCase() : n;
        return `
          <tr>
            <td style="font-family:${getFontFamily(r.settings.font)};">${disp}</td>
            <td class="col-right">${w !== undefined ? w.toFixed(2) : '-'}</td>
            <td class="col-del"><button class="btn-del" onclick="removeName('${esc.replace(/'/g, "\\'")}')">&times;</button></td>
          </tr>
        `;
      }).join('');
    }

    function selectRedaction(idx) {
      if (!state.redactions[idx]) return;
      state.selectedRedactionIdx = idx;

      // Update the DOM right sidebar settings to match this redaction's specific settings
      const s = state.redactions[idx].settings;
      els.font.value = s.font;
      els.size.value = s.size;
      els.calcScale.value = s.scale;
      els.tol.value = s.tol;
      els.kern.checked = s.kern;
      els.lig.checked = s.lig;
      els.upper.checked = s.upper;

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
        // Smooth scroll
        const parentRect = els.viewerContainer.getBoundingClientRect();
        const targetRect = el.getBoundingClientRect();
        if (targetRect.top < parentRect.top || targetRect.bottom > parentRect.bottom) {
          els.viewerContainer.scrollTo({
            top: els.viewerContainer.scrollTop + (targetRect.top - parentRect.top) - (parentRect.height / 2),
            behavior: 'smooth'
          });
        }
      }

      // Re-render candidates since we changed selection (and widths depend on selection)
      renderCandidates();
      updateAllMatchesView();
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
        const fontStyle = `font-family: ${getFontFamily(r.settings.font)}; font-variant-ligatures: ${r.settings.lig ? 'common-ligatures' : 'none'}; font-feature-settings: "kern" ${r.settings.kern ? 1 : 0}; text-transform: ${isUpper ? 'uppercase' : 'none'};`;

        const matches = state.candidates.filter(c => {
          const w = r.widths[c];
          return w !== undefined && Math.abs(w - r.pts_width) <= tol;
        });

        if (matches.length) matchCount++;

        // Update per-redaction label text if it has not been manually overridden
        if (!r.manualLabel) {
          if (matches.length > 0) {
            r.labelText = isUpper ? matches[0].toUpperCase() : matches[0];
          } else {
            r.labelText = '';
          }
        }

        const matchHtml = matches.length
          ? `<span style="color:#81c995; ${fontStyle}">${matches.map(m => isUpper ? m.toUpperCase() : m).join(', ')}</span>`
          : `<span class="no-match">No obvious matches</span>`;

        // Update the label on the PDF canvas itself
        const overlay = document.getElementById(`redaction-idx-${idx}`);
        if (overlay && (onlyIdx === null || onlyIdx === idx)) {
          const label = overlay.querySelector('.redaction-label');
          if (label) {
            const basePx = r.settings.size * (r.settings.scale / 100);
            
            label.style.fontFamily = getFontFamily(r.settings.font);
            label.style.fontSize = `calc(${basePx}px * var(--scale-factor, 1))`;
            label.style.fontVariantLigatures = r.settings.lig ? 'common-ligatures' : 'none';
            label.style.fontFeatureSettings = `"kern" ${r.settings.kern ? 1 : 0}`;
            label.style.textTransform = isUpper ? 'uppercase' : 'none';
            label.style.display = 'flex';

            // Always reflect the per-redaction label text in the DOM (for this redaction when updating selectively)
            label.textContent = r.labelText || '';
          }
        }

        const isSelected = state.selectedRedactionIdx === idx ? 'selected-row' : '';
        return `
          <tr id="match-row-${idx}" class="${isSelected}" style="cursor: pointer;" onclick="selectRedaction(${idx})" title="Click to view on document">
            <td>${r.page}</td>
            <td class="col-right">${r.pts_width.toFixed(2)}</td>
            <td class="col-right">${r.pts_height.toFixed(2)}</td>
            <td>${matchHtml}</td>
          </tr>
        `;
      }).join('');

      els.allMatchesSummary.textContent = `${matchCount} of ${state.redactions.length} redactions have potential matches.`;
    }

    function getFontFamily(f) {
      const low = (f || '').toLowerCase();
      if (low.includes('times')) return '"Times New Roman",serif';
      if (low.includes('arial')) return 'Arial,sans-serif';
      if (low.includes('calibri')) return 'Calibri,sans-serif';
      if (low.includes('cour')) return '"Courier New",monospace';
      return 'system-ui,sans-serif';
    }