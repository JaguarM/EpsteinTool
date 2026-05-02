// toolbar.js
// Unified formatting toolbar — reads/writes UnifiedTextBox objects directly.
// No branching on box.type; one code path for embedded, redaction, and harfbuzz.

(function initToolbar() {

  // ── Helpers ───────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function getSelected() {
    return utbState.selectedId ? utbState.getBox(utbState.selectedId) : null;
  }

  // ── Sync toolbar ← box ────────────────────────────────────────

  /**
   * Push a box's properties into the toolbar UI.
   * Called whenever a box is selected.
   */
  function syncToolbarToBox(box) {
    if (!box) return;

    const ffSel = el('fabric-font-family');
    if (ffSel) {
      const opt = Array.from(ffSel.options).find(o => o.value === box.fontFamily);
      if (opt) ffSel.value = opt.value;
    }

    const fsInput = el('fabric-font-size');
    if (fsInput) fsInput.value = Math.round(box.fontSize * 0.75 * 100) / 100;

    el('fabric-bold')         ?.classList.toggle('active', box.bold);
    el('fabric-italic')       ?.classList.toggle('active', box.italic);
    el('fabric-underline')    ?.classList.toggle('active', box.underline);
    el('fabric-strikethrough')?.classList.toggle('active', box.strikethrough);

    const colorInput = el('fabric-color');
    if (colorInput && box.color && box.color.startsWith('#')) {
      colorInput.value = box.color;
    }

    const lsInput = el('fabric-letter-spacing');
    if (lsInput) lsInput.value = (box.letterSpacing || 0).toFixed(2);

    // Default Space Width checkbox
    const defaultSwCheck = el('fabric-default-sw');
    if (defaultSwCheck) defaultSwCheck.checked = box.defaultSpaceWidth;

    // Space Width slider
    const swSlider  = el('fabric-space-width');
    const swDisplay = el('fabric-space-width-display');
    if (swSlider) {
      swSlider.disabled = box.defaultSpaceWidth;
      if (box.spaceWidth != null) {
        swSlider.value = box.spaceWidth;
        if (swDisplay) swDisplay.textContent = `${parseFloat(box.spaceWidth).toFixed(1)}px`;
      }
    }

    // Nudge button state
    const nudgeBtn = el('fabric-nudge-mode');
    if (nudgeBtn) {
      nudgeBtn.classList.toggle('active', utbState.microTypoId === box.id);
      nudgeBtn.disabled = !box.baseCharPositions?.length;
    }

    // Show toolbar if hidden
    // el('fabric-options-bar')?.classList.remove('hidden');
  }

  // Expose for drag-resize.js and other modules
  window.syncToolbarToBox = syncToolbarToBox;

  function syncToolbarToSelection() {
    const box = getSelected();
    if (box) syncToolbarToBox(box);
  }
  window.syncToolbarToSelection = syncToolbarToSelection;

  // ── Persist toolbar → box ─────────────────────────────────────

  /**
   * Read current toolbar state and write to box, then re-render.
   */
  async function persistFromToolbar(box) {
    if (!box) return;

    const newFamily = el('fabric-font-family')?.value || box.fontFamily;
    const inputSize = parseFloat(el('fabric-font-size')?.value);
    const newSize   = !isNaN(inputSize) ? inputSize / 0.75 : box.fontSize;
    const fontChanged = newFamily !== box.fontFamily || newSize !== box.fontSize;

    box.fontFamily    = newFamily;
    box.fontSize      = newSize;
    box.bold          = el('fabric-bold')         ?.classList.contains('active') ?? box.bold;
    box.italic        = el('fabric-italic')       ?.classList.contains('active') ?? box.italic;
    box.underline     = el('fabric-underline')    ?.classList.contains('active') ?? box.underline;
    box.strikethrough = el('fabric-strikethrough')?.classList.contains('active') ?? box.strikethrough;
    box.letterSpacing = parseFloat(el('fabric-letter-spacing')?.value) || 0;
    box.defaultSpaceWidth = el('fabric-default-sw')?.checked ?? box.defaultSpaceWidth;

    if (box.defaultSpaceWidth) {
      box.spaceWidth = null; // use native font spacing
    } else {
      box.spaceWidth = parseFloat(el('fabric-space-width')?.value) || box.spaceWidth;
    }

    // Always recalculate candidate widths for redactions when toolbar properties are applied
    if (box.type === 'redaction' && typeof calculateWidthsForRedaction === 'function') {
      await calculateWidthsForRedaction(box.id);
    }

    renderBox(box);
    // Update space-width display
    const swDisplay = el('fabric-space-width-display');
    if (swDisplay && box.spaceWidth != null) {
      swDisplay.textContent = `${parseFloat(box.spaceWidth).toFixed(1)}px`;
    }
  }

  // ── Natural space width helper ─────────────────────────────

  /**
   * Fetch the HarfBuzz natural space advance for the box's current font/size.
   * Used to initialise the slider when unchecking "Default".
   */
  async function fetchNaturalSpaceWidth(box) {
    const font  = _ttfForFamily(box.fontFamily);
    const scale = typeof state !== 'undefined' ? (state.pageWidth / 816 * (4/3)) : (4/3);
    try {
      const resp = await fetch('/widths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strings: [' '],
          font:    font,
          size:    box.sizePt || box.fontSize,
          scale:   scale * 100,
          kerning:    box.kerning,
          ligatures:  box.ligatures,
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      // The width of a single space character = the natural space advance
      return data.results?.[0]?.width ?? null;
    } catch { return null; }
  }

  // Map CSS family name → TTF filename (for HarfBuzz backend)
  function _ttfForFamily(family) {
    const lc = (family || '').toLowerCase().replace(/[\s\-_]/g, '');
    if (lc.includes('times'))   return 'times.ttf';
    if (lc.includes('arial'))   return 'arial.ttf';
    if (lc.includes('calibri')) return 'calibri.ttf';
    if (lc.includes('courier')) return 'courier_new.ttf';
    if (lc.includes('segoe'))   return 'segoe_ui.ttf';
    if (lc.includes('verdana')) return 'verdana.ttf';
    return 'times.ttf';
  }

  // ── Event wiring ──────────────────────────────────────────────

  const STYLE_TOGGLES = ['fabric-bold', 'fabric-italic', 'fabric-underline', 'fabric-strikethrough'];

  STYLE_TOGGLES.forEach(id => {
    el(id)?.addEventListener('click', () => {
      el(id).classList.toggle('active');
      const box = getSelected();
      if (box) persistFromToolbar(box);
    });
  });

  el('fabric-font-family')?.addEventListener('change', () => persistFromToolbar(getSelected()));
  el('fabric-font-size')  ?.addEventListener('input',  () => {
    const box = getSelected();
    if (box) { 
      const inputSize = parseFloat(el('fabric-font-size').value);
      box.fontSize = !isNaN(inputSize) ? inputSize / 0.75 : box.fontSize; 
      renderBox(box); 
      if (box.type === 'redaction' && typeof calculateWidthsForRedaction === 'function') {
        calculateWidthsForRedaction(box.id);
      }
    }
  });
  el('fabric-font-size')  ?.addEventListener('change', () => persistFromToolbar(getSelected()));

  el('fabric-letter-spacing')?.addEventListener('change', () => persistFromToolbar(getSelected()));
  el('fabric-color')         ?.addEventListener('input', e => {
    const box = getSelected();
    if (box) { box.color = e.target.value; renderBox(box); }
  });

  // "Default" checkbox: toggle native vs manual space width
  el('fabric-default-sw')?.addEventListener('change', async () => {
    const box = getSelected();
    if (!box) return;

    const isDefault = el('fabric-default-sw').checked;
    box.defaultSpaceWidth = isDefault;

    const swSlider  = el('fabric-space-width');
    const swDisplay = el('fabric-space-width-display');

    if (!isDefault) {
      // User unchecked "Default" → initialise slider to the font's natural space width
      const naturalSW = await fetchNaturalSpaceWidth(box);
      if (naturalSW !== null) {
        box.spaceWidth = naturalSW;
        box.nativeSpaceWidth = naturalSW;
        if (swSlider) swSlider.value = naturalSW;
        if (swDisplay) swDisplay.textContent = `${naturalSW.toFixed(1)}px`;
      }
    } else {
      box.spaceWidth = null;
    }

    if (swSlider) swSlider.disabled = isDefault;

    renderBox(box);

    // Recalculate candidate widths for redactions
    if (box.type === 'redaction' && typeof calculateWidthsForRedaction === 'function') {
      await calculateWidthsForRedaction(box.id);
    }
  });

  // Space width slider (live drag)
  el('fabric-space-width')?.addEventListener('input', e => {
    const box = getSelected();
    if (!box || box.defaultSpaceWidth) return;
    box.spaceWidth = parseFloat(e.target.value);
    const disp = el('fabric-space-width-display');
    if (disp) disp.textContent = `${box.spaceWidth.toFixed(1)}px`;
    renderBox(box);
  });

  // Nudge mode button (micro-typography)
  el('fabric-nudge-mode')?.addEventListener('click', () => {
    const box = getSelected();
    if (!box) return;

    // If already in micro-typo mode, exit
    if (utbState.microTypoId === box.id) {
      if (typeof exitMicroTypo === 'function') exitMicroTypo();
      el('fabric-nudge-mode')?.classList.remove('active');
      return;
    }

    // Enter micro-typo mode if the box has character positions
    if (box.baseCharPositions?.length && typeof enterMicroTypo === 'function') {
      enterMicroTypo(box);
      el('fabric-nudge-mode')?.classList.add('active');
    }
  });

  // Toggle-fmt button (show/hide toolbar)
  el('toggle-fmt')?.addEventListener('click', () => {
    const bar = el('fabric-options-bar');
    const btn = el('toggle-fmt');
    if (!bar) return;

    if (bar.classList.contains('hidden')) {
      // Open: hand off to the global coordinator
      if (typeof openSubtoolbar === 'function') openSubtoolbar(bar, btn);
      else { bar.classList.remove('hidden'); btn?.classList.add('active'); }
    } else {
      // Close: revert to the default text-options-bar
      if (typeof openSubtoolbar === 'function') openSubtoolbar(null, null);
      else { bar.classList.add('hidden'); btn?.classList.remove('active'); }
    }
  });

  // Toggle-text-layer button (show/hide SVG layer globally)
  el('toggle-text-layer')?.addEventListener('click', () => {
    const btn = el('toggle-text-layer');
    const active = btn.classList.toggle('active');
    document.querySelectorAll('svg.text-layer').forEach(svg => {
      svg.style.display = active ? '' : 'none';
    });
  });

})();
