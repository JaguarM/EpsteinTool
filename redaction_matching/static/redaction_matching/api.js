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

    /**
     * Box width a candidate's measured width is compared against — simply box.w.
     * The candidate's measured width (box.widths[c]) already places the Space W.
     * value between its words (see calculateWidthsForRedaction), so a multi-word
     * name's width adds up to the full box width directly. No hidden per-candidate
     * trailing-space subtraction.
     */
    function candidateEW(box) {
      return box.w;
    }
    window.candidateEW = candidateEW;

    /** Median of an array of numbers (robust to a stray double space). */
    function _median(nums) {
      const s = [...nums].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    // A line counts as "not justified" when its median detected space is within
    // this much of the font's natural HarfBuzz advance — then we use the precise
    // natural value instead of the measured one. Relative, with an absolute floor;
    // doubles as the max error accepted from that substitution.
    const JUSTIFY_SPACE_TOL_FRAC = 0.12;
    const JUSTIFY_SPACE_TOL_FLOOR_PX = 0.5;

    /** Get the currently selected redaction box (or null). */
    function getSelectedRedaction() {
      if (typeof utbState === 'undefined' || !utbState.selectedId) return null;
      const box = utbState.getBox(utbState.selectedId);
      return box && box.type === 'redaction' ? box : null;
    }

    // ── Name generation from JSON ─────────────────────────────

    function generateCandidatesFromData(namesData, settings) {
      const result = new Set();
      for (const person of namesData) {
        const firsts = person.first.length > 0
          ? (settings.expandFirstAliases ? person.first : [person.first[0]])
          : [];
        const lasts = person.last.length > 0
          ? (settings.expandLastAliases ? person.last : [person.last[0]])
          : [];
        const pre = settings.includePrefix && person.prefix ? person.prefix + ' ' : '';
        const suf = settings.includeSuffix && person.suffix ? ' ' + person.suffix : '';

        if (settings.generateFull) {
          if (firsts.length > 0 && lasts.length > 0) {
            for (const f of firsts) for (const l of lasts) result.add(`${pre}${f} ${l}${suf}`.trim());
          } else if (firsts.length > 0) {
            for (const f of firsts) result.add(`${pre}${f}${suf}`.trim());
          } else if (lasts.length > 0) {
            for (const l of lasts) result.add(`${pre}${l}${suf}`.trim());
          }
        }
        if (settings.generateFirstOnly) {
          for (const f of firsts) result.add(f);
        }
        if (settings.generateLastOnly) {
          for (const l of lasts) result.add(l);
        }
        if (settings.includeNickname && person.nickname) {
          result.add(person.nickname);
        }
      }
      return [...result];
    }

    function rebuildCandidates() {
      const fromJson = generateCandidatesFromData(state.namesData, state.nameSettings);
      state.candidates = [...new Set([...fromJson, ...state.customCandidates])];
      updateNameSettingsCount();
      calculateAllWidths();
    }

    function updateNameSettingsCount() {
      const el = document.getElementById('name-settings-count');
      if (!el) return;
      const jsonCount = generateCandidatesFromData(state.namesData, state.nameSettings).length;
      const customCount = state.customCandidates.length;
      el.textContent = customCount > 0
        ? `${jsonCount} from list + ${customCount} custom`
        : `${jsonCount} from list`;
    }

    function readNameSettings() {
      state.nameSettings.generateFull        = document.getElementById('ns-full').checked;
      state.nameSettings.generateFirstOnly   = document.getElementById('ns-first-only').checked;
      state.nameSettings.generateLastOnly    = document.getElementById('ns-last-only').checked;
      state.nameSettings.includePrefix       = document.getElementById('ns-prefix').checked;
      state.nameSettings.includeSuffix       = document.getElementById('ns-suffix').checked;
      state.nameSettings.includeNickname     = document.getElementById('ns-nickname').checked;
      state.nameSettings.expandFirstAliases  = document.getElementById('ns-expand-first').checked;
      state.nameSettings.expandLastAliases   = document.getElementById('ns-expand-last').checked;
    }

    function onNameSettingChange() {
      readNameSettings();
      rebuildCandidates();
    }

    /** Surface a names-list load failure loudly instead of silently emptying the list. */
    function showNamesLoadError(msg) {
      const countEl = document.getElementById('name-settings-count');
      if (countEl) countEl.textContent = '⚠ names list failed to load';

      let banner = document.getElementById('names-load-error');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'names-load-error';
        banner.title = 'Click to dismiss';
        banner.style.cssText = [
          'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
          'z-index:99999', 'max-width:90vw', 'padding:10px 14px',
          'background:#b00020', 'color:#fff', 'font:13px/1.4 system-ui,sans-serif',
          'border-radius:6px', 'box-shadow:0 2px 8px rgba(0,0,0,.35)',
          'cursor:pointer', 'white-space:pre-wrap'
        ].join(';');
        banner.addEventListener('click', () => banner.remove());
        document.body.appendChild(banner);
      }
      banner.textContent = `Names list failed to load — ${msg}`;
    }

    async function loadNamesData() {
      try {
        const resp = await fetch('/static/names/epstein_names.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText} fetching names file`);

        const raw = await resp.text();
        try {
          state.namesData = JSON.parse(raw);
        } catch (parseErr) {
          // Pinpoint the offending spot. Chrome reports "...position N...",
          // Firefox reports "line N column N"; fall back to the raw message otherwise.
          let where = '';
          const posM = /position (\d+)/.exec(parseErr.message);
          const lcM  = /line (\d+) column (\d+)/.exec(parseErr.message);
          if (posM) {
            const pos = +posM[1];
            const before = raw.slice(0, pos);
            where = ` (line ${before.split('\n').length}, column ${pos - before.lastIndexOf('\n')})`;
          } else if (lcM) {
            where = ` (line ${lcM[1]}, column ${lcM[2]})`;
          }
          throw new Error(`names file is not valid JSON${where}: ${parseErr.message}`);
        }

        rebuildCandidates();
      } catch (e) {
        console.error('Failed to load names list:', e);
        showNamesLoadError(e.message);
      }
    }

    document.addEventListener('DOMContentLoaded', loadNamesData);

    // ── Candidate management ──────────────────────────────────

    function addName() {
      const v = els.nameInput.value.trim();
      if (v && !state.candidates.includes(v)) {
        state.customCandidates.push(v);
        state.candidates.push(v);
        els.nameInput.value = '';
        updateNameSettingsCount();
        calculateAllWidths();
      }
    }
    function processPaste() {
      const lines = els.pasteInput.value.split('\n').map(l => l.trim()).filter(l => l);
      let added = 0;
      lines.forEach(l => {
        if (!state.candidates.includes(l)) {
          state.customCandidates.push(l);
          state.candidates.push(l);
          added++;
        }
      });
      if (added > 0) { updateNameSettingsCount(); calculateAllWidths(); }
      els.pasteInput.value = '';
      document.getElementById('paste-area').style.display = 'none';
    }

    function clearAll() {
      if (confirm('Clear custom names and reset to JSON list?')) {
        state.customCandidates = [];
        rebuildCandidates();
      }
    }
    function removeName(name) {
      state.customCandidates = state.customCandidates.filter(c => c !== name);
      state.candidates = state.candidates.filter(c => c !== name);
      updateNameSettingsCount();
      calculateAllWidths();
    }

    // ── Width calculation ─────────────────────────────────────

    async function calculateAllWidths() {
        const boxes = getRedactionBoxes();
        if (boxes.length === 0) return;
        for (const box of boxes) {
            await calculateWidthsForRedaction(box.id);
        }
        updateAllMatchesView(null);
    }

    async function calculateWidthsForRedaction(boxId) {
      await document.fonts.ready;
      const box = typeof utbState !== 'undefined' ? utbState.getBox(boxId) : null;
      if (!box || box.type !== 'redaction') return;

      // Determine the inter-word space width for this redaction's line.
      //
      // Justification only ever STRETCHES spaces beyond the font's natural
      // advance — it never compresses them. So:
      //   • line is justified  ⇔  its median space sits clearly ABOVE natural
      //     → the spaces are stretched, use the measured median.
      //   • otherwise (median at or below natural — a normal / last line)
      //     → use the precise HarfBuzz natural advance.
      // A space measured *below* natural is therefore never treated as a real
      // width: it just means "not stretched" (e.g. a space partly covered by the
      // redaction box reads small). This is the key to detecting the un-justified
      // last lines that sit in a sea of justified text.
      //
      // The natural advance is computed at the LINE's own font + size (from its
      // embedded spans), not the redaction's global defaults, so a size mismatch
      // can't skew the comparison. Median (not mean) ignores the odd double space
      // or a box-truncated space.
      if (box.lineId && (box.spaceWidth == null || box.defaultSpaceWidth !== false)) {
        const lineSpans = utbState.boxes.filter(
          b => b.lineId === box.lineId && b.type === 'embedded' && b.baseCharPositions
        );
        const detected = lineSpans
          .flatMap(b => b.baseCharPositions.filter(cp => cp.c === ' '))
          .map(cp => cp.w || 0)
          .filter(w => w > 0);

        if (detected.length > 0) {
          const median = _median(detected);

          const lineSizePt = _median(lineSpans.map(b => b.sizePt).filter(s => s > 0));
          const lineFont = lineSpans[0]?.fontFamily || box.fontFamily;
          let natural = null;
          if (typeof getNaturalSpaceWidth === 'function') {
            natural = await getNaturalSpaceWidth({
              fontFamily: lineFont,
              sizePt: lineSizePt || box.sizePt,
              kerning: box.kerning,
              ligatures: box.ligatures,
            });
          }

          let spaceW;
          if (natural != null) {
            const tol = Math.max(JUSTIFY_SPACE_TOL_FLOOR_PX, natural * JUSTIFY_SPACE_TOL_FRAC);
            spaceW = (median > natural + tol) ? median : natural;
          } else {
            spaceW = median;
          }

          box.spaceWidth = spaceW;
          box.defaultSpaceWidth = false;
          box.nativeSpaceWidth = natural != null ? natural : median;
          if (typeof renderBox === 'function') renderBox(box);
          if (typeof syncToolbarToBox === 'function' && utbState.selectedId === box.id) {
            syncToolbarToBox(box);
          }
        }
      }

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

        textEl.style.fontKerning = box.kerning ? 'normal' : 'none';
      }

      const originalText = textEl.textContent;
      box.widths = {};

      // When a manual Space W. is active, measure a multi-word candidate as
      // Σ(word widths) + (#spaces × Space W.): the slider sets the gap between
      // words directly, so the candidate's width adds up to the full box width.
      // (Default/native spacing renders the whole string in one pass.)
      const manualSpace = box.spaceWidth != null && box.defaultSpaceWidth === false;

      state.candidates.forEach(c => {
        const disp = box.uppercase ? c.toUpperCase() : c;
        if (manualSpace && disp.includes(' ')) {
          const segments = disp.split(' ');
          let total = (segments.length - 1) * box.spaceWidth;
          for (const seg of segments) {
            textEl.textContent = seg;
            total += textEl.getBBox().width;
          }
          box.widths[c] = total;
        } else {
          textEl.textContent = disp;
          box.widths[c] = textEl.getBBox().width;
        }
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
        const isMatch = w !== undefined && Math.abs(w - candidateEW(box, n)) <= box.tolerance;
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
          return w !== undefined && Math.abs(w - candidateEW(box, c)) <= tol;
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