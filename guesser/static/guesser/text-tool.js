// =====================================================================
// TEXT ANNOTATION TOOL — Fabric.js
// Depends on viewer.js globals: currentZoom, renderWelcomePage
// Exposes to viewer.js: textBoxes, selectedBoxId (stubs for compat),
//                        createPageOverlay, onZoomChange, resetFabricCanvases
// =====================================================================

// viewer.js compatibility stubs
let textBoxes = [];
let selectedBoxId = null;

// --- State ---
let currentTool = 'select';


let redactPairs = [];
let nextPairId = 1;

let textOptions = {
  fontFamily: 'Times New Roman',
  fontSize: 12,
  fontScale: 100,          // → scaleX on the object
  bold: false,
  italic: false,
  underline: false,
  linethrough: false,
  charSpacing: 0,            // Fabric unit (1/1000 em)
  fill: '#000000',
};

// ── Tool activation ───────────────────────────────────────────────────

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tool-${tool}`)?.classList.add('active');
  for (const [, fc] of state.fabricCanvases) applyCanvasMode(fc);
}

function applyCanvasMode(fc) {
  fc.selection = false; // no rubber-band; always in add/edit mode
  fc.defaultCursor = currentTool === 'redact' ? 'crosshair' : 'text';
  fc.getObjects().forEach(obj => {
    const isBar = obj._redactRole === 'bar';
    obj.selectable = !isBar;
    obj.evented = !isBar;
  });
  fc.renderAll();
}

// Button only toggles the sub-toolbar; mode is always add/edit
document.getElementById('tool-text').addEventListener('click', () => {
  const bar = document.getElementById('fabric-options-bar');
  const hidden = bar.classList.toggle('hidden');
  document.getElementById('tool-text').classList.toggle('active', !hidden);
});

function addIText(fc, x, y, text = '') {
  const txt = new fabric.IText(text, { left: x, top: y, ...makeITextProps() });
  fc.add(txt);
  fc.setActiveObject(txt);
  wireTextEvents(txt, fc);
  fc.renderAll();
  requestAnimationFrame(() => {
    txt.enterEditing();
    if (text) txt.selectAll();
    fc.renderAll();
  });
  return txt;
}


// ── Options bar controls ──────────────────────────────────────────────

function activeFc() { for (const [, fc] of state.fabricCanvases) if (fc.getActiveObject()) return fc; return null; }
function activeObj() { return activeFc()?.getActiveObject() ?? null; }

function applyToSelection(prop, value) {
  const fc = activeFc();
  const obj = activeObj();
  if (!fc || !obj || obj.type !== 'i-text') return;
  if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
    obj.setSelectionStyles({ [prop]: value }, obj.selectionStart, obj.selectionEnd);
  } else {
    obj.set(prop, value);
  }
  obj.setCoords();
  fc.renderAll();
}

document.getElementById('fabric-font-family').addEventListener('change', (e) => {
  textOptions.fontFamily = e.target.value;
  applyToSelection('fontFamily', e.target.value);
});

document.getElementById('fabric-font-size').addEventListener('change', (e) => {
  textOptions.fontSize = Math.max(4, parseInt(e.target.value) || 12);
  e.target.value = textOptions.fontSize;
  applyToSelection('fontSize', textOptions.fontSize);
});

document.getElementById('fabric-font-scale').addEventListener('change', (e) => {
  textOptions.fontScale = Math.min(500, Math.max(10, parseInt(e.target.value) || 100));
  e.target.value = textOptions.fontScale;
  const scale = textOptions.fontScale / 100;
  const fc = activeFc(), obj = activeObj();
  if (fc && obj) { obj.set({ scaleX: scale, scaleY: scale }); obj.setCoords(); fc.renderAll(); }
});

function wireBoolToggle(btnId, prop, fabricProp, trueVal, falseVal) {
  document.getElementById(btnId).addEventListener('click', () => {
    const obj = activeObj();
    if (obj?.type === 'i-text' && obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
      // Detect aggregate state of selection
      const styles = obj.getSelectionStyles(obj.selectionStart, obj.selectionEnd, false);
      const allOn = styles.every(s => s[fabricProp] === trueVal);
      const newVal = allOn ? falseVal : trueVal;
      textOptions[prop] = (newVal === trueVal);
      applyToSelection(fabricProp, newVal);
    } else {
      textOptions[prop] = !textOptions[prop];
      const fc = activeFc();
      if (fc && obj) { obj.set(fabricProp, textOptions[prop] ? trueVal : falseVal); obj.setCoords(); fc.renderAll(); }
    }
    document.getElementById(btnId).classList.toggle('active', textOptions[prop]);
  });
}

wireBoolToggle('fabric-bold', 'bold', 'fontWeight', 'bold', 'normal');
wireBoolToggle('fabric-italic', 'italic', 'fontStyle', 'italic', 'normal');
wireBoolToggle('fabric-underline', 'underline', 'underline', true, false);
wireBoolToggle('fabric-strikethrough', 'linethrough', 'linethrough', true, false);

document.getElementById('fabric-letter-spacing').addEventListener('change', (e) => {
  // Fabric charSpacing is in 1/1000 of fontSize units; our input is in em
  textOptions.charSpacing = Math.round((parseFloat(e.target.value) || 0) * 1000);
  const fc = activeFc(), obj = activeObj();
  if (fc && obj && obj.type === 'i-text') { obj.set('charSpacing', textOptions.charSpacing); obj.setCoords(); fc.renderAll(); }
});

document.getElementById('fabric-color').addEventListener('input', (e) => {
  textOptions.fill = e.target.value;
  applyToSelection('fill', e.target.value);
});

// ── Redact gap slider ─────────────────────────────────────────────────

let activeRedactPair = null;

document.getElementById('redact-gap-slider').addEventListener('input', (e) => {
  const gap = parseInt(e.target.value);
  document.getElementById('redact-gap-display').textContent = Math.round(gap) + ' px';
  if (activeRedactPair) setRedactGap(activeRedactPair, gap);
});

function setRedactGap(pair, gap) {
  const rightEdge = pair.before.left + pair.before.getScaledWidth();
  pair.after.set('left', rightEdge + gap);
  pair.after.setCoords();
  updateRedactBar(pair);
  pair.fc.renderAll();
}

function updateRedactBar(pair) {
  const { before, after, bar } = pair;
  const rightEdge = before.left + before.getScaledWidth();
  const gap = Math.max(0, after.left - rightEdge);
  bar.set({ left: rightEdge, width: gap, top: before.top, height: before.getScaledHeight() });
  bar.setCoords();
  document.getElementById('redact-gap-slider').value = Math.round(gap);
  document.getElementById('redact-gap-display').textContent = Math.round(gap) + ' px';
}

function showRedactControls(show) {
  const el = document.getElementById('redact-gap-controls');
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

// ── Sync options bar ──────────────────────────────────────────────────

function syncBarToObj(obj) {
  if (!obj || obj.type !== 'i-text') return;
  let ff = obj.fontFamily, fs = obj.fontSize, fw = obj.fontWeight, fi = obj.fontStyle;
  let ul = obj.underline, lt = obj.linethrough, cl = obj.fill;
  if (obj.isEditing && obj.selectionStart < obj.selectionEnd) {
    const st = obj.getSelectionStyles(obj.selectionStart, obj.selectionEnd, false)[0] || {};
    ff = st.fontFamily || ff; fs = st.fontSize || fs;
    fw = st.fontWeight || fw; fi = st.fontStyle || fi;
    ul = st.underline !== undefined ? st.underline : ul;
    lt = st.linethrough !== undefined ? st.linethrough : lt;
    cl = st.fill || cl;
  }
  document.getElementById('fabric-font-family').value = ff;
  document.getElementById('fabric-font-size').value = fs;
  document.getElementById('fabric-font-scale').value = Math.round((obj.scaleY || obj.scaleX || 1) * 100);
  document.getElementById('fabric-bold').classList.toggle('active', fw === 'bold');
  document.getElementById('fabric-italic').classList.toggle('active', fi === 'italic');
  document.getElementById('fabric-underline').classList.toggle('active', !!ul);
  document.getElementById('fabric-strikethrough').classList.toggle('active', !!lt);
  document.getElementById('fabric-letter-spacing').value = ((obj.charSpacing || 0) / 1000).toFixed(2);
  document.getElementById('fabric-color').value = (typeof cl === 'string' && cl.startsWith('#')) ? cl : textOptions.fill;
  Object.assign(textOptions, {
    fontFamily: ff, fontSize: fs, fontScale: Math.round((obj.scaleY || obj.scaleX || 1) * 100),
    bold: fw === 'bold', italic: fi === 'italic', underline: !!ul, linethrough: !!lt,
    charSpacing: obj.charSpacing || 0, fill: cl || textOptions.fill,
  });
}

function syncBarToTextOptions() {
  document.getElementById('fabric-font-family').value = textOptions.fontFamily;
  document.getElementById('fabric-font-size').value = textOptions.fontSize;
  document.getElementById('fabric-font-scale').value = textOptions.fontScale;
  document.getElementById('fabric-bold').classList.toggle('active', textOptions.bold);
  document.getElementById('fabric-italic').classList.toggle('active', textOptions.italic);
  document.getElementById('fabric-underline').classList.toggle('active', textOptions.underline);
  document.getElementById('fabric-strikethrough').classList.toggle('active', textOptions.linethrough);
  document.getElementById('fabric-letter-spacing').value = (textOptions.charSpacing / 1000).toFixed(2);
  document.getElementById('fabric-color').value = textOptions.fill;
}

// ── Canvas creation ───────────────────────────────────────────────────

function makeITextProps(extra = {}) {
  return {
    fontFamily: textOptions.fontFamily,
    fontSize: textOptions.fontSize,
    scaleX: textOptions.fontScale / 100,
    scaleY: textOptions.fontScale / 100,
    fontWeight: textOptions.bold ? 'bold' : 'normal',
    fontStyle: textOptions.italic ? 'italic' : 'normal',
    underline: textOptions.underline,
    linethrough: textOptions.linethrough,
    charSpacing: textOptions.charSpacing,
    fill: textOptions.fill,
    lockRotation: true,
    hasRotatingPoint: false,
    padding: 0,
    ...extra,
  };
}

function createPageOverlay(pageContainer, pageNum) {
  const baseW = parseFloat(pageContainer.style.getPropertyValue('--page-width')) || 816;
  const baseH = parseFloat(pageContainer.style.getPropertyValue('--page-height')) || 1056;
  const zoom = state.currentZoom;

  const canvasEl = document.createElement('canvas');
  canvasEl.id = `fabric-${pageNum}`;
  pageContainer.appendChild(canvasEl);

  const fc = new fabric.Canvas(canvasEl, {
    width: Math.round(baseW * zoom),
    height: Math.round(baseH * zoom),
    backgroundColor: null,
    selection: currentTool === 'select',
    preserveObjectStacking: true,
    renderOnAddRemove: false,
  });
  fc.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
  fc._baseW = baseW;
  fc._baseH = baseH;
  fc._pageNum = pageNum;

  // Position Fabric's wrapper div over the PDF canvas
  Object.assign(fc.wrapperEl.style, { position: 'absolute', top: '0', left: '0' });

  state.fabricCanvases.set(pageNum, fc);
  setupCanvasEvents(fc);
  applyCanvasMode(fc);
  fc.renderAll();
  return fc;
}

// ── Zoom ──────────────────────────────────────────────────────────────

function onZoomChange(zoom) {
  for (const [, fc] of state.fabricCanvases) {
    fc.setWidth(Math.round(fc._baseW * zoom));
    fc.setHeight(Math.round(fc._baseH * zoom));
    fc.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
    fc.renderAll();
  }
}

// Called when a new PDF is loaded (viewer.js resets page containers)
function resetFabricCanvases() {
  for (const [, fc] of state.fabricCanvases) fc.dispose();
  state.fabricCanvases.clear();
  redactPairs = [];
  activeRedactPair = null;
}

// viewer.js API compat
function updateAllTextBoxFontSizes() {
  if (typeof state.currentZoom !== 'undefined') onZoomChange(state.currentZoom);
}

// ── Canvas event wiring ───────────────────────────────────────────────

function setupCanvasEvents(fc) {
  // Click on empty area → create new text; click on IText → enter editing
  fc.on('mouse:down', (opt) => {
    if (opt.target) return; // clicked an existing object
    if (currentTool === 'text') {
      const pt = fc.getPointer(opt.e);
      addIText(fc, pt.x, pt.y);
    }
  });

  // Single-click on IText enters editing (skip if the object was just dragged)
  fc.on('mouse:up', (opt) => {
    const obj = opt.target;
    if (obj?.type === 'i-text' && !obj.isEditing && !obj.__wasMoved) {
      fc.setActiveObject(obj);
      requestAnimationFrame(() => {
        if (!obj.isEditing) { obj.enterEditing(); fc.renderAll(); }
      });
    }
    if (obj) obj.__wasMoved = false;
  });

  // Selection events → sync options bar
  fc.on('selection:created', (opt) => onFcSelect(fc, opt.selected?.[0]));
  fc.on('selection:updated', (opt) => onFcSelect(fc, opt.selected?.[0]));
  fc.on('selection:cleared', () => { activeRedactPair = null; showRedactControls(false); });

  // object:moving — mark dragged flag + keep redact "after" to the right of "before"
  fc.on('object:moving', (opt) => {
    opt.target.__wasMoved = true;
    if (opt.target?._redactRole !== 'after') return;
    const pair = redactPairs.find(p => p.pairId === opt.target._redactPairId);
    if (!pair) return;
    const minLeft = pair.before.left + pair.before.getScaledWidth();
    if (opt.target.left < minLeft) opt.target.set('left', minLeft);
    updateRedactBar(pair);
    fc.renderAll();
  });
}

function wireTextEvents(txt, fc) {
  txt.on('selection:changed', () => syncBarToObj(txt));
  txt.on('editing:exited', () => {
    // Delete empty non-redact boxes on deselect
    const canvas = fc ?? [...state.fabricCanvases.values()].find(c => c.getObjects().includes(txt));
    if (canvas && !txt._redactPairId && txt.text.trim() === '') {
      canvas.remove(txt);
      canvas.discardActiveObject();
      canvas.renderAll();
      return;
    }
    syncBarToObj(txt);
  });
}

function onFcSelect(fc, obj) {
  if (!obj) return;
  // Redact pair object selected
  if (obj._redactPairId) {
    const pair = redactPairs.find(p => p.pairId === obj._redactPairId);
    if (pair) {
      activeRedactPair = pair;
      updateRedactBar(pair); // also syncs slider
      showRedactControls(true);
      return;
    }
  }
  activeRedactPair = null;
  showRedactControls(false);
  if (obj.type === 'i-text') {
    syncBarToObj(obj);
    wireTextEvents(obj, fc);
  }
}

// ── Redaction (Alt+R) ─────────────────────────────────────────────────

// Split Fabric styles object at a character index (single-line assumed)
function splitStyles(styles, cursorPos, keepBefore) {
  const line = styles?.[0];
  if (!line) return {};
  const result = {};
  for (const [k, v] of Object.entries(line)) {
    const idx = parseInt(k);
    if (keepBefore ? idx < cursorPos : idx >= cursorPos) {
      result[keepBefore ? idx : idx - cursorPos] = v;
    }
  }
  return Object.keys(result).length ? { 0: result } : {};
}

function insertRedactionGap() {
  // Find the IText currently in editing mode
  let txt = null, fc = null;
  for (const [, canvas] of state.fabricCanvases) {
    const obj = canvas.getActiveObject();
    if (obj?.type === 'i-text' && obj.isEditing) { txt = obj; fc = canvas; break; }
  }
  if (!txt || !fc) return;

  const cursorPos = txt.selectionStart;
  const beforeText = txt.text.substring(0, cursorPos);
  const afterText = txt.text.substring(cursorPos);
  const pairId = nextPairId++;

  // Exit editing; reuse the existing IText as "before"
  txt.exitEditing();
  txt.set({
    text: beforeText,
    styles: splitStyles(txt.styles, cursorPos, true),
    _redactPairId: pairId, _redactRole: 'before',
    hasControls: false,
  });
  txt.initDimensions();
  txt.setCoords();

  const rightEdge = txt.left + txt.getScaledWidth();
  const defaultGap = 50;

  const bar = new fabric.Rect({
    left: rightEdge, top: txt.top, width: defaultGap, height: txt.getScaledHeight(),
    fill: 'rgba(255, 140, 0, 0.5)', selectable: false, evented: false,
    _redactPairId: pairId, _redactRole: 'bar',
  });

  const after = new fabric.IText(afterText, {
    left: rightEdge + defaultGap, top: txt.top,
    styles: splitStyles(txt.styles, cursorPos, false),
    ...makeITextProps({
      fontFamily: txt.fontFamily, fontSize: txt.fontSize,
      fill: txt.fill, scaleX: txt.scaleX,
      lockMovementY: true, lockScalingY: true, hasControls: false,
      _redactPairId: pairId, _redactRole: 'after',
    }),
  });

  fc.add(bar, after);

  const pair = { pairId, pageNum: fc._pageNum, before: txt, after, bar, fc };
  redactPairs.push(pair);

  // "after" drag → recompute gap
  after.on('moving', () => updateRedactBar(pair));
  after.on('editing:exited', () => updateRedactBar(pair));

  // "before" drag → slide bar + after together, keeping gap constant
  txt.on('moving', () => {
    const rightEdge = txt.left + txt.getScaledWidth();
    const gap = bar.width;
    bar.set({ left: rightEdge, top: txt.top });
    after.set({ left: rightEdge + gap, top: txt.top });
    bar.setCoords();
    after.setCoords();
    fc.renderAll();
  });

  // "before" text edited → keep gap size, shift after to new right edge
  txt.on('editing:exited', () => {
    txt.initDimensions();
    txt.setCoords();
    const gap = bar.width;
    const rightEdge = txt.left + txt.getScaledWidth();
    after.set({ left: rightEdge + gap, top: txt.top });
    updateRedactBar(pair);
    fc.renderAll();
  });

  fc.setActiveObject(after);
  fc.renderAll();
  after.enterEditing();

  activeRedactPair = pair;
  showRedactControls(true);
  document.getElementById('redact-gap-slider').value = defaultGap;
  document.getElementById('redact-gap-display').textContent = defaultGap + ' px';
}

// ── Keyboard: Delete selected object(s) ──────────────────────────────

document.addEventListener('keydown', (e) => {
  // Alt+R — insert redaction gap at cursor inside any editing IText
  if (e.altKey && e.key === 'x') {
    e.preventDefault();
    insertRedactionGap();
    return;
  }

  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

  for (const [, fc] of state.fabricCanvases) {
    const obj = fc.getActiveObject();
    if (!obj) continue;
    if (obj.type === 'i-text' && obj.isEditing) continue; // let text editing handle it

    if (obj._redactPairId) {
      const pair = redactPairs.find(p => p.pairId === obj._redactPairId);
      if (pair) {
        fc.remove(pair.before, pair.after, pair.bar);
        redactPairs = redactPairs.filter(p => p.pairId !== obj._redactPairId);
        activeRedactPair = null;
        showRedactControls(false);
      }
    } else {
      fc.remove(obj);
    }

    fc.discardActiveObject();
    fc.renderAll();
    break;
  }
});

// ── Welcome page ──────────────────────────────────────────────────────

// currentTool is always 'text' — clicking a page always adds text.
// Sub-toolbar visibility and button highlight are managed separately by the tool-text button handler.
currentTool = 'text';
