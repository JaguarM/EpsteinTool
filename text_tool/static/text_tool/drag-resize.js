// drag-resize.js
// SVG-native drag and resize for UnifiedTextBox elements.
// All deltas are computed in SVG coordinate space (= document pixel space)
// using getScreenCTM().inverse() — no manual zoom division needed.

(function initDragResize() {

  // Convert a screen (client) point to SVG document-space point
  function toSVGPoint(svgEl, clientX, clientY) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  // Get the SVG layer that owns a group element
  function ownerSVG(el) {
    return el.closest('svg.text-layer');
  }

  // All boxes that share a lineId on the same page (for grouped vertical drag)
  function getLineBoxes(box) {
    if (!box.lineId) return [box];
    return utbState.boxes.filter(b => b.lineId === box.lineId && b.page === box.page);
  }

  // All redaction-type boxes linked to a given lineId + page
  function getLinkedRedactions(lineId, page) {
    if (!lineId) return [];
    return utbState.boxes.filter(b => b.type === 'redaction' && b.lineId === lineId && b.page === page);
  }

  // ── Drag ──────────────────────────────────────────────────────

  function initDrag(downEvent, box, svgEl) {
    downEvent.preventDefault();
    downEvent.stopPropagation();

    const start  = toSVGPoint(svgEl, downEvent.clientX, downEvent.clientY);
    const origX  = box.x;

    // Snapshot all line boxes' Y positions for grouped vertical move
    const lineBoxes  = getLineBoxes(box);
    const origYs     = lineBoxes.map(b => b.y);
    const linkedReds = getLinkedRedactions(box.lineId, box.page);
    const origRedYs  = linkedReds.map(b => b.y);

    function onMove(e) {
      const cur = toSVGPoint(svgEl, e.clientX, e.clientY);
      const dx  = cur.x - start.x;
      const dy  = cur.y - start.y;

      // Dragged box: horizontal only
      box.x = origX + dx;
      renderBox(box);

      // Whole line: vertical only
      for (let i = 0; i < lineBoxes.length; i++) {
        lineBoxes[i].y = origYs[i] + dy;
        renderBox(lineBoxes[i]);
      }

      // Linked redactions: vertical sync
      for (let i = 0; i < linkedReds.length; i++) {
        linkedReds[i].y = origRedYs[i] + dy;
        renderBox(linkedReds[i]);
      }
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }

  // ── Resize ────────────────────────────────────────────────────

  function initResize(downEvent, box, svgEl, edge) {
    downEvent.preventDefault();
    downEvent.stopPropagation();

    const start = toSVGPoint(svgEl, downEvent.clientX, downEvent.clientY);
    const origX = box.x;
    const origW = box.w;

    function onMove(e) {
      const cur = toSVGPoint(svgEl, e.clientX, e.clientY);
      const dx  = cur.x - start.x;

      if (edge === 'r') {
        box.w = Math.max(4, origW + dx);
      } else {
        const clamped = Math.min(dx, origW - 4);
        box.x = origX + clamped;
        box.w = origW - clamped;
      }
      renderBox(box);

      // Live match-list update for redaction boxes during resize
      if (box.type === 'redaction' && typeof state !== 'undefined') {
        const rowEl = document.getElementById(`match-row-${box.id}`);
        if (rowEl && rowEl.children.length >= 3) {
          rowEl.children[1].textContent = box.w.toFixed(2);

          const matches = state.candidates.filter(c => {
            const w = box.widths?.[c];
            return w !== undefined && Math.abs(w - box.w) <= (box.tolerance || 0);
          });
          const isUpper = box.uppercase;
          const fontStyle = `font-family: ${box.fontFamily || 'inherit'};`;
          rowEl.children[2].innerHTML = matches.length
            ? `<span style="color:#81c995; ${fontStyle}">${matches.map(m => isUpper ? m.toUpperCase() : m).join(', ')}</span>`
            : `<span class="no-match">No obvious matches</span>`;

          // Update label text
          if (!box.manualLabel) {
            box.text = matches.length > 0 ? (isUpper ? matches[0].toUpperCase() : matches[0]) : '';
            box.labelText = box.text;
            renderBox(box);
          }
        }

        // Update summary counts
        const redBoxes = utbState.boxes.filter(b => b.type === 'redaction');
        let matchCount = 0;
        redBoxes.forEach(rb => {
          const has = state.candidates.some(c =>
            rb.widths?.[c] !== undefined && Math.abs(rb.widths[c] - rb.w) <= (rb.tolerance || 0)
          );
          if (has) matchCount++;
        });
        if (els.allMatchesSummary) {
          els.allMatchesSummary.textContent = `${matchCount} of ${redBoxes.length} redactions have potential matches.`;
        }
        const progress = redBoxes.length ? (matchCount / redBoxes.length) * 100 : 0;
        const progressBar = document.getElementById('match-progress-bar');
        if (progressBar) progressBar.style.width = `${progress}%`;
      }
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }

  // ── Event delegation on SVG layers ───────────────────────────

  // We attach a single delegated listener to the document.
  // This avoids re-attaching on each renderBox call.

  document.addEventListener('mousedown', e => {
    const svgEl = e.target.closest('svg.text-layer');
    if (!svgEl) return;

    // Edge handle → resize
    if (e.target.classList.contains('utb-edge')) {
      const group = e.target.closest('.utb-group');
      if (!group) return;
      const box = utbState.getBox(group.dataset.id);
      if (!box) return;
      initResize(e, box, svgEl, e.target.dataset.edge);
      return;
    }

    // Text or bbox → select + drag
    const group = e.target.closest('.utb-group');
    if (!group) {
      // Clicked on SVG background — deselect
      if (utbState.selectedId) {
        utbState.selectedId = null;
        deselectAllInSVG();
        if (typeof syncToolbarToSelection === 'function') syncToolbarToSelection();
      }
      return;
    }

    if (e.target.classList.contains('utb-char-hit')) return; // handled by micro-typo

    const box = utbState.getBox(group.dataset.id);
    if (!box) return;

    // Select the box
    utbState.selectedId = box.id;
    selectBoxInSVG(box.id);
    if (typeof syncToolbarToBox === 'function') syncToolbarToBox(box);

    // If it's a redaction, also select it in the sidebar
    if (box.type === 'redaction' && typeof selectRedaction === 'function') {
      selectRedaction(box.id);
    }

    // Open the formatting toolbar if hidden
    const fbar = document.getElementById('fabric-options-bar');
    if (fbar?.classList.contains('hidden')) fbar.classList.remove('hidden');

    initDrag(e, box, svgEl);
  });

  // Deselect when clicking outside any SVG layer, toolbar, or sidebar
  document.addEventListener('mousedown', e => {
    if (e.target.closest('svg.text-layer')) return;
    if (e.target.closest('#fabric-options-bar')) return;
    if (e.target.closest('#unified-options-bar-container')) return;
    if (e.target.closest('#tools-sidebar')) return;
    if (e.target.closest('.utb-nudge-popover')) return;
    if (utbState.selectedId) {
      utbState.selectedId = null;
      deselectAllInSVG();
      if (typeof syncToolbarToSelection === 'function') syncToolbarToSelection();
    }
  }, true); // capture phase so it fires before the SVG handler above

})();
