// =============================================================
// etv.js — Embedded Text Viewer
//
// Renders PDF text spans as absolutely-positioned overlay
// elements on each page image, letting you see, move, resize,
// edit, and format the text the PDF contains.
//
// HOW IT WORKS
// ─────────────
// 1. viewer.js calls etvReset(spans, file) after every new PDF load.
//    Spans come pre-computed from the server (extract.py).
// 2. The user clicks the overlay toggle button.
//    etvRenderPage() places <span class="etv-span"> elements
//    on top of the page image using CSS custom properties for
//    position + font size so they scale with zoom automatically.
// 3. Spans are editable (click to edit text), draggable, and
//    resizable (left/right edges).
// 4. The formatting toolbar (bold, italic, font, …) applies
//    inline styles to whichever span is currently selected.
// 5. When a render font is selected, HarfBuzz per-character
//    positions are fetched from the server and the overlay
//    switches to per-char absolute positioning for pixel-perfect
//    alignment.
// =============================================================


// ── State ─────────────────────────────────────────────────────
const etvState = {
  active:     false,
  render:     false, // false = don't create overlay DOM elements (default off)
  spans:      [],   // span objects from the server
  renderFont: null, // null = use PDF font; "times.ttf" etc = override with TTF
  charPosCache: {}, // fontName → [{page, x, y, h, fontSize, chars}]
  fetched:    false,
  fetchingFile: null,
};

// ── Render-font loader ────────────────────────────────────────

const _etvLoadedFonts = {}; // fontName → true once loaded

async function etvLoadRenderFont(fontName) {
  if (_etvLoadedFonts[fontName]) return;
  const ff = new FontFace(`etv_${fontName}`, `url(/static/fonts/${fontName})`);
  await ff.load();
  document.fonts.add(ff);
  _etvLoadedFonts[fontName] = true;
}

// Currently selected span element
let selectedSpan = null;


// ── Utilities ─────────────────────────────────────────────────

/**
 * Convert a raw PDF font name to a browser-safe CSS font family.
 * PDF fonts often have subset prefixes ("ABCDEF+") and platform
 * suffixes ("MT", "PSMT") that browsers don't understand.
 */
function normFont(name) {
  if (!name) return '';
  const n = name.replace(/^[A-Z]{6}\+/, '').split(',')[0].trim();
  const lc = n.toLowerCase().replace(/[\s\-_]/g, '');
  if (lc.includes('times'))   return 'Times New Roman';
  if (lc.includes('arial'))   return 'Arial';
  if (lc.includes('courier')) return 'Courier New';
  if (lc.includes('verdana')) return 'Verdana';
  if (lc.includes('calibri')) return 'Calibri';
  if (lc.includes('segoe'))   return 'Segoe UI';
  return n;
}

/**
 * Render per-character positioned <i> children inside a span element.
 * Each character gets its own left-offset so the overlay aligns
 * precisely with the underlying PDF glyph positions.
 */
function renderChars(el, chars) {
  // Remove existing text nodes / <i> children but keep resizer handles
  Array.from(el.childNodes).forEach(node => {
    if (!node.classList?.contains('resizer')) el.removeChild(node);
  });
  for (const ch of chars) {
    const i = document.createElement('i');
    i.textContent = ch.c;
    i.style.setProperty('--ch-x', `${ch.x}px`);
    el.appendChild(i);
  }
  el.dataset.charMode = '1';
}


// ── Overlay rendering ─────────────────────────────────────────

/** Render (or re-render) the text overlay for one page. */
function etvRenderPage(pageEl, pageNum) {
  if (!etvState.active || !etvState.render || !pageEl) return;

  // Remove any existing overlay for this page
  pageEl.querySelector('.etv-overlay')?.remove();

  const pageSpans = etvState.spans.filter(s => s.page === pageNum);
  if (!pageSpans.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'etv-overlay';

  pageSpans.forEach((span, idx) => {
    const el = document.createElement('span');
    el.className = 'etv-span';
    el.dataset.idx = idx;
    el._etvSpan = span; // back-reference so format handlers can persist changes
    el._etvSpan = span;

    // Position + size via CSS custom properties (zoom-aware via --scale-factor)
    el.style.setProperty('--etv-x',  `${span.x}px`);
    el.style.setProperty('--etv-y',  `${span.y}px`);
    el.style.setProperty('--etv-w',  `${span.w}px`);
    el.style.setProperty('--etv-h',  `${span.h}px`);
    el.style.setProperty('--etv-fs', `${span.fontSize}px`);

    let ttfName = null;
    const lc = (span.font || '').toLowerCase().replace(/[\s\-_]/g, '');
    if (lc.includes('times')) ttfName = 'times.ttf';
    else if (lc.includes('arial')) ttfName = 'arial.ttf';
    else if (lc.includes('calibri')) ttfName = 'calibri.ttf';
    else if (lc.includes('segoe')) ttfName = 'segoe_ui.ttf';
    else if (lc.includes('courier')) ttfName = 'courier_new.ttf';
    else if (lc.includes('verdana')) ttfName = 'verdana.ttf';

    const hbData = ttfName && etvState.charPosCache[ttfName]
      ? etvState.charPosCache[ttfName].filter(d => d.page === pageNum)
      : null;

    // Font rendering mode
    if (ttfName && hbData) {
      // HarfBuzz per-character positioning with the selected TTF
      el.style.fontFamily = `"etv_${ttfName}"`;

      // Find matching HarfBuzz data for this span
      const hbSpan = hbData.find(d =>
        Math.abs(d.x - span.x) < 0.5 &&
        Math.abs(d.y - span.y) < 0.5
      );
      if (hbSpan?.chars?.length) {
        renderChars(el, hbSpan.chars);
      } else {
        el.textContent = span.text;
      }
    } else {
      // PDF font — preserve bold/italic hints and use PDF per-char positions
      el.style.fontFamily = normFont(span.font);
      if (/bold/i.test(span.font) || span.fontWeight === 'bold') el.style.fontWeight = 'bold';
      if (/italic|oblique/i.test(span.font) || span.fontStyle === 'italic') el.style.fontStyle = 'italic';
      if (span.chars?.length) {
        renderChars(el, span.chars);
      } else {
        el.textContent = span.text;
      }
    }

    el.contentEditable = 'false';

    addDragHandlers(el, span);
    addEditHandlers(el, span);
    addResizeHandles(el, span);

    overlay.appendChild(el);
  });

  pageEl.appendChild(overlay);
}

/** Render overlays for every already-rendered page. */
function etvRenderAll() {
  for (let p = 1; p <= state.numPages; p++) {
    const pageEl = document.getElementById(`pageContainer${p}`);
    if (pageEl) etvRenderPage(pageEl, p);
  }
}

/** Remove all overlay elements from the DOM. */
function etvClearAll() {
  document.querySelectorAll('.etv-overlay').forEach(el => el.remove());
}

function etvResetState() {
  etvState.spans  = [];
  etvState.active = false;
  etvState.render = false;
  etvState.charPosCache = {};
  etvState.fetched = false;
  etvState.fetchingFile = null;
  selectedSpan    = null;
  etvClearAll();
  document.getElementById('toggle-embedded-viewer')?.classList.remove('active');
  document.getElementById('etv-bar')?.classList.add('hidden');
  const renderCheckbox = document.getElementById('etv-render-enabled');
  if (renderCheckbox) renderCheckbox.checked = false;
}

/** Fetch spans from backend */
async function etvFetchSpans(file) {
  if (etvState.fetched && etvState.fetchingFile === file) return;
  if (window.setHarfBuzzStatus) window.setHarfBuzzStatus('Extracting spans...');
  try {
    let resp;
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      resp = await fetch('/embedded-text-viewer/api/extract-spans', { method: 'POST', body: fd });
    } else {
      resp = await fetch('/embedded-text-viewer/api/extract-spans');
    }
    if (!resp.ok) {
        if (window.setHarfBuzzStatus) window.setHarfBuzzStatus('Failed to extract spans.');
        return;
    }
    const data = await resp.json();
    etvState.spans = data.spans || [];
    etvState.fetched = true;
    etvState.fetchingFile = file;
    if (window.setHarfBuzzStatus) window.setHarfBuzzStatus(`Loaded ${etvState.spans.length} spans.`);
    if (typeof connectRedactionsToETVLines === 'function') connectRedactionsToETVLines();
  } catch (err) {
    console.error('ETV: fetch error', err);
    if (window.setHarfBuzzStatus) window.setHarfBuzzStatus('Error extracting spans.');
  }
}


// ── Fetch HarfBuzz char positions from server ─────────────────

async function fetchHarfBuzzPositions(fontName) {
  if (etvState.charPosCache[fontName]) return etvState.charPosCache[fontName];

  const cmpEl = document.getElementById('cmp-correction');
  const resp  = await fetch('/embedded-text-viewer/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spans:      etvState.spans,
      font:       fontName,
      scale:      parseFloat(document.getElementById('cmp-scale')?.value) || (4/3),
      kerning:    document.getElementById('cmp-kerning')?.checked ?? true,
      ligatures:  document.getElementById('cmp-ligatures')?.checked ?? true,
      correction: parseFloat(cmpEl?.value) || 1.0,
      auto_font:  false,
      use_calibration: !!window.calState?.loaded,
    }),
  });

  if (!resp.ok) throw new Error(`Server error ${resp.status}`);
  const data = (await resp.json()).results;
  etvState.charPosCache[fontName] = data;
  return data;
}


// ── Drag ──────────────────────────────────────────────────────

function addDragHandlers(el, span) {
  el.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.classList.contains('resizer')) return;
    e.preventDefault();

    const startX  = e.clientX;
    const startY  = e.clientY;
    const origX   = span.x;
    const scale   = typeof state !== 'undefined' ? (state.currentZoom || 1) : 1;

    // Grouped vertical move: find all spans in the SAME LINE on the same page
    const lineSpans = span.lineId ? etvState.spans.filter(s => s.lineId === span.lineId && s.page === span.page) : [span];
    const startYs = lineSpans.map(s => s.y);
    
    const pageOverlay = el.parentElement;
    const lineEls = lineSpans.map(s => {
      const pageSpans = etvState.spans.filter(sp => sp.page === s.page);
      const idx = pageSpans.indexOf(s);
      return pageOverlay.querySelector(`.etv-span[data-idx="${idx}"]`);
    });

    // Capture connected redactions and their start Y positions for live sync
    const connectedReds = typeof getConnectedRedactions === 'function' ? getConnectedRedactions(span.lineId, span.page) : [];
    const redStartYs = connectedReds.map(({ r }) => r.y);

    function onMove(e) {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      
      // 1. Move DRAGGED span horizontally
      span.x = origX + dx;
      el.style.setProperty('--etv-x', `${span.x}px`);

      // 2. Move ALL spans in the line vertically
      for (let i = 0; i < lineSpans.length; i++) {
        lineSpans[i].y = startYs[i] + dy;
        const currentEl = lineEls[i] || (lineSpans[i] === span ? el : null);
        if (currentEl) currentEl.style.setProperty('--etv-y', `${lineSpans[i].y}px`);
      }

      // 3. Sync connected redaction overlays vertically
      for (let i = 0; i < connectedReds.length; i++) {
        const { r, idx } = connectedReds[i];
        r.y = redStartYs[i] + dy;
        const ov = document.getElementById(`redaction-idx-${idx}`);
        if (ov) ov.style.setProperty('--px-y', `${r.y}px`);
      }
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });
}


// ── Resize (left / right edges) ───────────────────────────────

function addResizeHandles(el, span) {
  for (const edge of ['l', 'r']) {
    const handle = document.createElement('div');
    handle.className = `resizer resizer-${edge}`;
    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      selectSpan(el);

      const startX  = e.clientX;
      const origX   = span.x;
      const origW   = span.w;
      const scale   = state.currentZoom || 1;

      function onMove(e) {
        const dx = (e.clientX - startX) / scale;
        if (edge === 'r') {
          span.w = Math.max(1, origW + dx);
        } else {
          const clamped = Math.min(dx, origW - 1);
          span.x = origX + clamped;
          span.w = origW - clamped;
          el.style.setProperty('--etv-x', `${span.x}px`);
        }
        el.style.setProperty('--etv-w', `${span.w}px`);
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    });
    el.appendChild(handle);
  }
}


// ── Edit (click to edit text) ─────────────────────────────────

function addEditHandlers(el, span) {
  el.addEventListener('mousedown', e => {
    if (e.target.classList.contains('resizer')) return;
    selectSpan(el);
  });

  // Before the user types, flatten per-char <i> children to plain text
  el.addEventListener('beforeinput', () => {
    if (el.dataset.charMode) {
      const text = span.chars.map(c => c.c).join('');
      Array.from(el.childNodes).forEach(node => {
        if (!node.classList?.contains('resizer')) el.removeChild(node);
      });
      el.insertBefore(document.createTextNode(text), el.querySelector('.resizer') || null);
      delete el.dataset.charMode;
    }
  });

  el.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') {
      // Restore original content and blur
      span.chars?.length ? renderChars(el, span.chars) : (el.textContent = span.text);
      el.blur();
    }
    e.stopPropagation();
  });

  el.addEventListener('blur', () => {
    el.contentEditable = 'false';
    const txt = el.textContent.trim();
    if (txt) {
      span.text  = txt;
      span.chars = [];  // char positions are now stale
    } else {
      // Empty — remove the span entirely
      el.remove();
      const idx = etvState.spans.indexOf(span);
      if (idx !== -1) etvState.spans.splice(idx, 1);
    }
  });
}


// ── Selection ─────────────────────────────────────────────────

function selectSpan(el) {
  if (selectedSpan === el) {
    // Second click → make editable
    el.contentEditable = 'true';
    el.focus();
    return;
  }
  deselectAll();
  selectedSpan = el;
  el.classList.add('selected');
  syncFormatBar(el);
}

function deselectAll() {
  if (selectedSpan) {
    selectedSpan.classList.remove('selected');
    selectedSpan.contentEditable = 'false';
    selectedSpan = null;
  }
}

// Clicking outside a span deselects, but NOT when interacting with the format bar or inspector
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.etv-span') && 
      !e.target.closest('#fabric-options-bar') && 
      !e.target.closest('#cmp-panel')) {
    deselectAll();
  }
});

// Since redaction labels aren't processed by etvRenderPage, use event delegation
// to detect when api.js calls label.focus() to unify them with the text toolbar.
document.addEventListener('focusin', e => {
  if (e.target && e.target.classList && e.target.classList.contains('etv-span')) {
    selectSpan(e.target);
  }
});


// ── Toggle button ─────────────────────────────────────────────

document.getElementById('toggle-embedded-viewer')?.addEventListener('click', async () => {
  etvState.active = !etvState.active;
  document.getElementById('toggle-embedded-viewer').classList.toggle('active', etvState.active);
  document.getElementById('etv-bar').classList.toggle('hidden', !etvState.active);

  if (etvState.active) {
    try {
      if (!etvState.fetched) {
        await etvFetchSpans(typeof state !== 'undefined' ? (state.currentFile || null) : null);
      }
    } catch {}
    etvRenderAll();
  } else {
    etvClearAll();
  }
});


// ── ETV sub-toolbar (color, opacity, mode, render font) ───────

(function initEtvControls() {
  const colorInput   = document.getElementById('etv-color');
  const opacityInput = document.getElementById('etv-opacity');
  const opacityVal   = document.getElementById('etv-opacity-display');
  const modeSelect   = document.getElementById('etv-mode');
  if (!colorInput) return;

  function applyColor() {
    const hex = colorInput.value;
    const pct = opacityInput.valueAsNumber / 100;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    document.documentElement.style.setProperty('--etv-color',  `rgba(${r},${g},${b},${pct})`);
    document.documentElement.style.setProperty('--etv-box-bg', `rgba(${r},${g},${b},${(pct * 0.35).toFixed(2)})`);
  }

  colorInput.addEventListener('input', applyColor);
  opacityInput.addEventListener('input', () => {
    opacityVal.textContent = `${opacityInput.value}%`;
    applyColor();
  });
  modeSelect.addEventListener('change', () => {
    document.getElementById('viewer').classList.toggle('etv-boxes-mode', modeSelect.value === 'boxes');
  });

  // Render-enabled toggle — when checked, create overlay DOM; when unchecked, clear it
  document.getElementById('etv-render-enabled')?.addEventListener('change', e => {
    etvState.render = e.target.checked;
    if (etvState.render && etvState.active) {
      etvRenderAll();
    } else if (!etvState.render) {
      etvClearAll();
    }
  });



  applyColor(); // set initial CSS vars from default control values
})();


// ── Formatting toolbar ────────────────────────────────────────

document.getElementById('toggle-fmt')?.addEventListener('click', () => {
  const bar = document.getElementById('fabric-options-bar');
  const btn = document.getElementById('toggle-fmt');
  const visible = bar.classList.toggle('hidden');
  btn.classList.toggle('active', !visible);
});

/** Push current inline styles of a span element into the toolbar. */
function syncFormatBar(el) {
  const ff = normFont(el.style.fontFamily || '');
  const familySel = document.getElementById('fabric-font-family');
  if (familySel && ff) {
    const opt = Array.from(familySel.options).find(o => o.value === ff);
    if (opt) familySel.value = opt.value;
  }

  const fsPx = parseFloat(el.style.getPropertyValue('--etv-fs')) || 12;
  const sizeInput = document.getElementById('fabric-font-size');
  if (sizeInput) sizeInput.value = Math.round(fsPx * 100) / 100;

  document.getElementById('fabric-bold')?.classList.toggle('active',
    el.style.fontWeight === 'bold' || el.style.fontWeight === '700');
  document.getElementById('fabric-italic')?.classList.toggle('active',
    el.style.fontStyle === 'italic');
  document.getElementById('fabric-underline')?.classList.toggle('active',
    el.style.textDecoration.includes('underline'));
  document.getElementById('fabric-strikethrough')?.classList.toggle('active',
    el.style.textDecoration.includes('line-through'));

  const ls = parseFloat(el.style.letterSpacing) || 0;
  const spacingInput = document.getElementById('fabric-letter-spacing');
  if (spacingInput) spacingInput.value = ls.toFixed(2);
}

/** Apply toolbar values back to the selected span element. */
function applyFormat() {
  if (!selectedSpan) return;

  const bold      = document.getElementById('fabric-bold')?.classList.contains('active');
  const italic    = document.getElementById('fabric-italic')?.classList.contains('active');
  const underline = document.getElementById('fabric-underline')?.classList.contains('active');
  const strike    = document.getElementById('fabric-strikethrough')?.classList.contains('active');

  selectedSpan.style.fontWeight     = bold      ? 'bold'   : 'normal';
  selectedSpan.style.fontStyle      = italic    ? 'italic' : 'normal';
  selectedSpan.style.textDecoration =
    [underline && 'underline', strike && 'line-through'].filter(Boolean).join(' ') || 'none';
}

// Toolbar control listeners
document.getElementById('fabric-font-family')?.addEventListener('change', async e => {
  if (selectedSpan) {
    const family = e.target.value;

    // Handle Redaction UI elements via the same generic UI flow
    if (selectedSpan.dataset.redactionIdx !== undefined) {
      const idx = parseInt(selectedSpan.dataset.redactionIdx);
      if (typeof state !== 'undefined' && state.redactions && state.redactions[idx]) {
        state.redactions[idx].settings.fontFamily = family;
        selectedSpan.style.fontFamily = family;
        
        if (typeof calculateAllWidths === 'function') {
          document.getElementById('fabric-font-family').disabled = true;
          try {
            // Note: calculateAllWidths internally triggers updateAllMatchesView and renderCandidates for the selected span
            await calculateAllWidths();
          } catch (err) {
            console.error('Failed to recalculate redaction widths', err);
          }
          document.getElementById('fabric-font-family').disabled = false;
        }
      }
      return;
    }

    // Standard Embedded Text span handling
    const span = selectedSpan._etvSpan;
    if (span) {
      span.font = family;
      
      let ttfName = null;
      const lc = family.toLowerCase().replace(/[\s\-_]/g, '');
      if (lc.includes('times')) ttfName = 'times.ttf';
      else if (lc.includes('arial')) ttfName = 'arial.ttf';
      else if (lc.includes('calibri')) ttfName = 'calibri.ttf';
      else if (lc.includes('segoe')) ttfName = 'segoe_ui.ttf';
      else if (lc.includes('courier')) ttfName = 'courier_new.ttf';
      else if (lc.includes('verdana')) ttfName = 'verdana.ttf';

      if (ttfName) {
        document.getElementById('fabric-font-family').disabled = true;
        await etvLoadRenderFont(ttfName);
        try {
          await fetchHarfBuzzPositions(ttfName);
        } catch (err) {
          console.error('Failed to fetch HarfBuzz positions:', err);
        }
        document.getElementById('fabric-font-family').disabled = false;
      }
      
      // Update DOM element in-place WITHOUT resetting the whole page mapping
      if (ttfName && typeof etvState !== 'undefined' && etvState.charPosCache[ttfName]) {
          const hbData = etvState.charPosCache[ttfName].filter(d => d.page === span.page);
          const hbSpan = hbData.find(d => Math.abs(d.x - span.x) < 0.5 && Math.abs(d.y - span.y) < 0.5);
          selectedSpan.style.fontFamily = `"etv_${ttfName}"`;
          if (hbSpan?.chars?.length) {
            renderChars(selectedSpan, hbSpan.chars);
          } else {
            selectedSpan.textContent = span.text;
          }
      } else {
          selectedSpan.style.fontFamily = normFont(span.font);
          if (/bold/i.test(span.font) || span.fontWeight === 'bold') selectedSpan.style.fontWeight = 'bold';
          if (/italic|oblique/i.test(span.font) || span.fontStyle === 'italic') selectedSpan.style.fontStyle = 'italic';
          if (span.chars?.length) {
            renderChars(selectedSpan, span.chars);
          } else {
            selectedSpan.textContent = span.text;
          }
      }
    }
  }
});
function _applyFontSize(el, size) {
  if (!el) return;
  if (el.dataset.redactionIdx !== undefined) {
    const idx = parseInt(el.dataset.redactionIdx);
    if (!isNaN(idx) && typeof state !== 'undefined' && state.redactions?.[idx]) {
      state.redactions[idx].settings.fontSize = size;
      el.style.setProperty('--etv-fs', `${size}px`);
      el.style.fontSize = `calc(${size}px * var(--scale-factor, 1))`;
    }
    return;
  }
  const span = el._etvSpan;
  if (span) {
    span.fontSize = size;
    el.style.setProperty('--etv-fs', `${size}px`);
  }
}

// Apply in real-time while typing / using spinners (fires before focus can be lost)
document.getElementById('fabric-font-size')?.addEventListener('input', e => {
  const size = Math.max(1, parseFloat(e.target.value) || 12);
  _applyFontSize(selectedSpan, size);
});

// On commit (Enter / blur): also trigger width recalculation for redaction labels
document.getElementById('fabric-font-size')?.addEventListener('change', async e => {
  const size = Math.max(1, parseFloat(e.target.value) || 12);
  _applyFontSize(selectedSpan, size);
  if (selectedSpan?.dataset.redactionIdx !== undefined && typeof calculateAllWidths === 'function') {
    document.getElementById('fabric-font-size').disabled = true;
    try { await calculateAllWidths(); } catch (err) { console.error('Width recalc failed', err); }
    document.getElementById('fabric-font-size').disabled = false;
  }
});
['fabric-bold', 'fabric-italic', 'fabric-underline', 'fabric-strikethrough'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById(id).classList.toggle('active');
    applyFormat();
  });
});
document.getElementById('fabric-color')?.addEventListener('input', e => {
  if (selectedSpan) {
    selectedSpan.style.setProperty('--etv-color', e.target.value);
    selectedSpan.style.color = e.target.value;
  }
});
document.getElementById('fabric-letter-spacing')?.addEventListener('change', e => {
  if (selectedSpan) selectedSpan.style.letterSpacing = `${parseFloat(e.target.value) || 0}em`;
});


/* ---------- Redaction ↔ ETV connection helpers ----------------------- */

// After ETV spans are loaded, assign lineId to any redaction that sits on a text line
// and snap the redaction's Y/height to match the ETV span exactly.
// Uses maximum vertical overlap (not a probe-Y heuristic) to find the correct line.
function connectRedactionsToETVLines() {
  if (!state || !state.redactions) return;
  state.redactions.forEach((r, redIdx) => {
    if (r.lineId !== null) return;

    const pageSpans = etvState.spans.filter(s => s.page === r.page);
    let bestSpan = null;
    let bestOverlap = 0;

    for (const s of pageSpans) {
      const overlap = Math.min(r.y + r.height, s.y + s.h) - Math.max(r.y, s.y);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSpan = s;
      }
    }

    // Require at least 30% of the redaction height to overlap before connecting
    if (!bestSpan || bestOverlap < r.height * 0.3) return;

    r.lineId   = bestSpan.lineId;
    r.y        = bestSpan.y;
    r.height   = bestSpan.h;
    const overlay = document.getElementById(`redaction-idx-${redIdx}`);
    if (overlay) {
      overlay.style.setProperty('--px-y',      `${r.y}px`);
      overlay.style.setProperty('--px-height', `${r.height}px`);
    }
  });
  if (typeof calculateAllWidths === 'function') calculateAllWidths();
}

// Return all redactions (with their global index) whose lineId matches the given line.
function getConnectedRedactions(lineId, page) {
  if (!lineId || !typeof state === 'undefined' || !state.redactions) return [];
  return state.redactions
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => r.lineId === lineId && r.page === page);
}

/* ---------- Hook: call on every pdf-file change to auto-fetch spans ------------ */
(function hookFileUpload() {
  const pdfInput = document.getElementById('pdf-file');
  if (pdfInput) {
    pdfInput.addEventListener('change', () => {
      etvResetState();
      if (pdfInput.files && pdfInput.files.length > 0) {
        etvFetchSpans(pdfInput.files[0]);
      }
    });
  }
  window.addEventListener('drop', (e) => {
    etvResetState();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (file) etvFetchSpans(file);
    }
  });

  // Extract spans for default PDF on initial launch automatically
  setTimeout(() => {
    if (!etvState.fetched) {
       etvFetchSpans(typeof state !== 'undefined' ? (state.currentFile || null) : null);
    }
  }, 1000);
})();

// ── Text / Redaction Box Creation Tools ───────────────────────

document.getElementById('etv-add-text-btn')?.addEventListener('click', () => {
  if (typeof state !== 'undefined') {
    if (state.activeTool === 'text') {
      state.activeTool = null;
      document.getElementById('etv-add-text-btn').classList.remove('active');
      document.getElementById('viewer').style.cursor = 'default';
    } else {
      state.activeTool = 'text';
      document.getElementById('etv-add-text-btn').classList.add('active');
      document.getElementById('tool-add-box')?.classList.remove('active');
      document.getElementById('viewer').style.cursor = 'crosshair';
    }
  }
});

function findNearestETVLine(pageNum, y, threshold = 2.0) {
  if (!etvState.spans) return null;
  const pageSpans = etvState.spans.filter(s => s.page === pageNum);
  if (!pageSpans.length) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const span of pageSpans) {
    const cy = span.y + span.h / 2;
    const dy = Math.abs(cy - y);
    if (dy < minDistance) {
      minDistance = dy;
      nearest = span;
    }
  }
  
  if (nearest && minDistance < nearest.h * threshold) {
    return nearest;
  }
  return null;
}

window.findNearestETVLine = findNearestETVLine;

window.addEmbeddedTextSpan = function(pageNum, x, y) {
  if (!etvState.active) {
    document.getElementById('toggle-embedded-viewer')?.click();
  }

  const neat = findNearestETVLine(pageNum, y);
  
  const snapY  = neat ? neat.y        : y - 10;
  const snapH  = neat ? neat.h        : 20;
  const snapFS = neat ? neat.fontSize : (parseFloat(document.getElementById('fabric-font-size')?.value) || 16);
  const snapFF = neat ? neat.font     : (document.getElementById('fabric-font-family')?.value || 'serif');
  const lineId = neat ? neat.lineId   : `manual_${Date.now()}`;

  const newSpan = {
    page: pageNum,
    lineId: lineId,
    text: 'Click to edit',
    x: x,
    y: snapY,
    w: 100,
    h: snapH,
    fontSize: snapFS,
    font: snapFF,
    manual: true
  };

  etvState.spans.push(newSpan);
  
  const pageContainer = document.getElementById(`pageContainer${pageNum}`);
  if (pageContainer) {
    etvRenderPage(pageContainer, pageNum);
    
    setTimeout(() => {
        const overlay = pageContainer.querySelector('.etv-overlay');
        if (!overlay) return;
        const els = overlay.querySelectorAll('.etv-span');
        const lastEl = els[els.length - 1];
        if (lastEl) {
            selectSpan(lastEl);
            lastEl.contentEditable = 'true';
            lastEl.focus();
            const range = document.createRange();
            range.selectNodeContents(lastEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, 50);
  }
};