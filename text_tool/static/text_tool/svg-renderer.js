// svg-renderer.js
// Renders UnifiedTextBox objects as SVG <text> elements in a per-page SVG layer.
// The SVG uses a fixed viewBox matching document pixel space so coordinates are
// always in the same space as box.x/y/w/h — zoom is handled by CSS sizing alone.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Type → fill color (rgba)
const UTB_TYPE_COLORS = {
  embedded:  'rgba(0, 100, 255, 0.82)',
  redaction: 'rgba(129, 201, 149, 0.90)',
  harfbuzz:  'rgba(255, 140, 0, 0.80)',
};

const UTB_TYPE_STROKE = {
  embedded:  'rgba(0, 100, 255, 0.6)',
  redaction: 'rgba(80, 180, 110, 0.8)',
  harfbuzz:  'rgba(220, 100, 0, 0.7)',
};


// ── SVG Layer ─────────────────────────────────────────────────

/**
 * Return the SVG text layer for a page, creating it if needed.
 * The SVG is absolutely positioned over the page image container.
 */
function getOrCreateSVGLayer(pageContainer, pageNum) {
  let svg = pageContainer.querySelector(`.text-layer[data-page="${pageNum}"]`);
  if (svg) return svg;

  const pw = state?.pageWidth  || 816;
  const ph = state?.pageHeight || 1056;

  svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('text-layer');
  svg.dataset.page = pageNum;
  svg.setAttribute('viewBox', `0 0 ${pw} ${ph}`);
  svg.setAttribute('xmlns', SVG_NS);
  pageContainer.appendChild(svg);
  return svg;
}

/** Remove the SVG layer for a page entirely. */
function removeSVGLayer(pageNum) {
  document.querySelectorAll(`.text-layer[data-page="${pageNum}"]`).forEach(el => el.remove());
}

/** Remove all SVG text layers. */
function clearAllSVGLayers() {
  document.querySelectorAll('.text-layer').forEach(el => el.remove());
}


// ── Coordinate computation ────────────────────────────────────

/**
 * Compute the array of absolute x positions for each character in a box.
 * When baseCharPositions is available, each char's x = box.x + char.x + charAdvances[i].
 * When not available, returns a single value [box.x].
 */
function computeXPositions(box) {
  if (!box.baseCharPositions || !box.baseCharPositions.length) {
    return [box.x];
  }

  // charAdvances[i] is a manual per-character nudge.  We accumulate all prior
  // nudges so that shifting char i also shifts chars i+1, i+2, … by the same
  // amount — matching the SVG <text x="…"> array contract.
  let cumulativeDelta = 0;
  const xs = [];
  for (let i = 0; i < box.baseCharPositions.length; i++) {
    const cp = box.baseCharPositions[i];
    cumulativeDelta += (box.charAdvances[i] || 0);
    xs.push(box.x + cp.x + cumulativeDelta);
  }
  return xs;
}

/**
 * Compute baseline Y: approximately 85% down from the top of the bounding box.
 * SVG <text> y is the baseline, not the top.
 */
function computeBaseline(box) {
  return (box.y || 0) + (box.h || 0) * 0.85;
}


// ── Box rendering ─────────────────────────────────────────────

/**
 * Create or update the SVG group and text element for a single box.
 * Call this whenever box data changes (position, text, font, charAdvances…).
 */
function renderBox(box) {
  const pageContainer = document.getElementById(`pageContainer${box.page}`);
  if (!pageContainer) return;

  const svg = getOrCreateSVGLayer(pageContainer, box.page);

  // Find or create the <g> group for this box
  let g = svg.querySelector(`[data-id="${box.id}"]`);
  if (!g) {
    g = document.createElementNS(SVG_NS, 'g');
    g.dataset.id   = box.id;
    g.dataset.type = box.type;
    g.classList.add('utb-group');
    svg.appendChild(g);
  }
  g.dataset.type = box.type;

  _updateBBox(g, box);
  _updateText(g, box);
  _updateEdgeHandles(g, box);
}

/** Update (or create) the bounding-box rect inside a group. */
function _updateBBox(g, box) {
  let rect = g.querySelector('.utb-bbox');
  if (!rect) {
    rect = document.createElementNS(SVG_NS, 'rect');
    rect.classList.add('utb-bbox');
    g.insertBefore(rect, g.firstChild);
  }
  rect.setAttribute('x',      box.x  || 0);
  rect.setAttribute('y',      box.y  || 0);
  rect.setAttribute('width',  box.w  || 0);
  rect.setAttribute('height', box.h  || 0);
  rect.setAttribute('stroke', UTB_TYPE_STROKE[box.type] || 'rgba(128,128,128,0.6)');
}

/** Update (or create) the SVG <text> element inside a group. */
function _updateText(g, box) {
  let text = g.querySelector('.utb-text');
  if (!text) {
    text = document.createElementNS(SVG_NS, 'text');
    text.classList.add('utb-text');
    g.appendChild(text);
  }

  const xs       = computeXPositions(box);
  const baseline = computeBaseline(box);

  text.setAttribute('y',           baseline);
  text.setAttribute('font-size',   box.fontSize);
  text.setAttribute('font-family', _svgFontFamily(box));
  
  // Use inline style to ensure it overrides the CSS stylesheet colors
  text.style.fill = box.color || UTB_TYPE_COLORS[box.type] || 'rgba(0,0,255,0.8)';

  if (box.bold)   text.setAttribute('font-weight', 'bold');
  else            text.removeAttribute('font-weight');
  if (box.italic) text.setAttribute('font-style', 'italic');
  else            text.removeAttribute('font-style');

  const textDecorations = [];
  if (box.underline) textDecorations.push('underline');
  if (box.strikethrough) textDecorations.push('line-through');
  if (textDecorations.length > 0) {
    text.setAttribute('text-decoration', textDecorations.join(' '));
  } else {
    text.removeAttribute('text-decoration');
  }

  if (box.letterSpacing) text.setAttribute('letter-spacing', `${box.letterSpacing}em`);
  else                   text.removeAttribute('letter-spacing');

  // Per-character x array or single x position
  if (xs.length === 1) {
    text.setAttribute('x', xs[0]);
  } else {
    text.setAttribute('x', xs.join(' '));
  }

  text.textContent = box.text;
}

/** Thin edge handle rects (left / right) for resize interaction. */
function _updateEdgeHandles(g, box) {
  // Remove existing handles
  g.querySelectorAll('.utb-edge').forEach(h => h.remove());

  const handleW = 4; // px in SVG space
  for (const edge of ['l', 'r']) {
    const h = document.createElementNS(SVG_NS, 'rect');
    h.classList.add('utb-edge', `utb-edge-${edge}`);
    h.dataset.edge = edge;
    h.setAttribute('y',      box.y);
    h.setAttribute('height', box.h);
    h.setAttribute('width',  handleW);
    h.setAttribute('x',      edge === 'l' ? box.x : box.x + box.w - handleW);
    h.setAttribute('fill',   'transparent');
    h.style.cursor = 'ew-resize';
    g.appendChild(h);
  }
}

/** Resolve the font family string for SVG, accounting for renderFont override. */
function _svgFontFamily(box) {
  if (box.renderFont) return `"etv_${box.renderFont}", ${box.fontFamily}`;
  return `"${box.fontFamily}"`;
}


// ── Page-level rendering ──────────────────────────────────────

/**
 * Render all UTB boxes for a single page into its SVG layer.
 * Called by pdf-viewer.js via the window.renderTextLayer hook.
 */
function renderTextLayer(pageContainer, pageNum) {
  const svg = getOrCreateSVGLayer(pageContainer, pageNum);
  // Clear existing groups (will be re-built)
  svg.querySelectorAll('.utb-group').forEach(g => g.remove());

  utbState.getPageBoxes(pageNum).forEach(box => renderBox(box));
}

/** Re-render every box on every currently-rendered page. */
function renderAllTextLayers() {
  for (let p = 1; p <= (state?.numPages || 1); p++) {
    const container = document.getElementById(`pageContainer${p}`);
    if (container) renderTextLayer(container, p);
  }
}

/** Remove a single box's group from its SVG layer. */
function removeBoxFromSVG(id) {
  document.querySelectorAll(`.utb-group[data-id="${id}"]`).forEach(g => g.remove());
}


// ── Selection state in SVG ────────────────────────────────────

function selectBoxInSVG(id) {
  document.querySelectorAll('.utb-group.selected').forEach(g => g.classList.remove('selected'));
  if (id) {
    document.querySelectorAll(`.utb-group[data-id="${id}"]`).forEach(g => g.classList.add('selected'));
  }
}

function deselectAllInSVG() {
  selectBoxInSVG(null);
}


// ── Expose globals ────────────────────────────────────────────

window.renderTextLayer    = renderTextLayer;
window.renderAllTextLayers = renderAllTextLayers;
window.renderBox          = renderBox;
window.removeBoxFromSVG   = removeBoxFromSVG;
window.selectBoxInSVG     = selectBoxInSVG;
window.deselectAllInSVG   = deselectAllInSVG;
window.computeXPositions  = computeXPositions;
window.computeBaseline    = computeBaseline;
window.getOrCreateSVGLayer = getOrCreateSVGLayer;
window.clearAllSVGLayers  = clearAllSVGLayers;
