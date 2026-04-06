// =====================================================================
// TEXT FORMAT TOOL — applies inline formatting to focused ETV spans
// Wires the #fabric-options-bar controls to whatever .etv-span is
// currently being edited via contentEditable.
// =====================================================================

// Kept for pdf-viewer.js compat (auto-selects font family on PDF load)
let textOptions = { fontFamily: 'serif' };

// The currently active text element (either .etv-span or .redaction-label)
let focusedTextItem = null;

// ── Show/hide the formatting bar via the toolbar button ───────────────

document.getElementById('tool-text')?.addEventListener('click', () => {
  const bar = document.getElementById('fabric-options-bar');
  if (!bar) return;
  const nowHidden = bar.classList.toggle('hidden');
  document.getElementById('tool-text').classList.toggle('active', !nowHidden);

  // Toggle elevation of ETV overlay to bypass redactions
  const etvOverlays = document.querySelectorAll('.etv-overlay');
  etvOverlays.forEach(el => el.classList.toggle('active-tool', !nowHidden));
});

// ── Track which ETV span has focus ────────────────────────────────────

document.addEventListener('focusin', (e) => {
  const isETV = e.target.classList.contains('etv-span');
  const isRedaction = e.target.classList.contains('redaction-label');
  if (!isETV && !isRedaction) return;
  
  focusedTextItem = e.target;
  
  // Ensure the element is marked as selected when focused
  if (isETV) {
    if (typeof selectETVBox === 'function') {
      selectETVBox(e.target);
    } else {
      document.querySelectorAll('.etv-span.selected').forEach(s => s.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  } else if (isRedaction) {
     // Redaction labels handle their own selection via click usually, 
     // but we ensure text-tool knows it's active.
  }
  
  syncBarToSpan(e.target);
});

document.addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('etv-span') && !e.target.classList.contains('redaction-label')) return;
  // Delay so toolbar button clicks can still read focusedTextItem
  requestAnimationFrame(() => { 
    if (document.activeElement !== focusedTextItem) {
       focusedTextItem = null; 
    }
  });
});

// ── Sync bar controls to reflect a span's current style ──────────────

function syncBarToSpan(el) {
  const cs = window.getComputedStyle(el);

  const ff = document.getElementById('fabric-font-family');
  if (ff) ff.value = cs.fontFamily.replace(/"/g, '').split(',')[0].trim();

  const fs = document.getElementById('fabric-font-size');
  if (fs) {
    const raw = el.style.getPropertyValue('--etv-fs');
    fs.value = raw ? Math.round(parseFloat(raw)) : Math.round(parseFloat(cs.fontSize));
  }

  document.getElementById('fabric-bold')
    ?.classList.toggle('active', cs.fontWeight === '700' || cs.fontWeight === 'bold');
  document.getElementById('fabric-italic')
    ?.classList.toggle('active', cs.fontStyle === 'italic');
  document.getElementById('fabric-underline')
    ?.classList.toggle('active', cs.textDecorationLine.includes('underline'));
  document.getElementById('fabric-strikethrough')
    ?.classList.toggle('active', cs.textDecorationLine.includes('line-through'));

  const ls = document.getElementById('fabric-letter-spacing');
  if (ls) ls.value = el.style.letterSpacing ? (parseFloat(el.style.letterSpacing) || 0).toFixed(2) : '0.00';

  const fc = document.getElementById('fabric-color');
  if (fc) {
    const custom = el.style.getPropertyValue('--etv-color');
    if (custom && custom.startsWith('#')) fc.value = custom;
  }
}

// ── Apply formatting toggles (bold/italic/underline/strike) ──────────

function applyFormatting() {
  if (!focusedTextItem) return;
  const el = focusedTextItem;
  const bold      = document.getElementById('fabric-bold')?.classList.contains('active');
  const italic    = document.getElementById('fabric-italic')?.classList.contains('active');
  const underline = document.getElementById('fabric-underline')?.classList.contains('active');
  const strike    = document.getElementById('fabric-strikethrough')?.classList.contains('active');
  
  el.style.fontWeight     = bold ? 'bold' : 'normal';
  el.style.fontStyle      = italic ? 'italic' : 'normal';
  el.style.textDecoration = [underline && 'underline', strike && 'line-through']
    .filter(Boolean).join(' ') || 'none';

  broadcastChange(el);
}

function broadcastChange(el) {
  const event = new CustomEvent('text-format-changed', {
    detail: {
      element: el,
      styles: {
        fontFamily: el.style.fontFamily,
        fontSize: el.style.getPropertyValue('--etv-fs') || el.style.fontSize,
        fontWeight: el.style.fontWeight,
        fontStyle: el.style.fontStyle,
        textDecoration: el.style.textDecoration,
        letterSpacing: el.style.letterSpacing,
        color: el.style.getPropertyValue('--etv-color') || el.style.color
      }
    }
  });
  document.dispatchEvent(event);
}

// ── Control event listeners ───────────────────────────────────────────

document.getElementById('fabric-font-family')?.addEventListener('change', (e) => {
  textOptions.fontFamily = e.target.value;
  if (focusedTextItem) {
    focusedTextItem.style.fontFamily = e.target.value;
    broadcastChange(focusedTextItem);
  }
});

document.getElementById('fabric-font-size')?.addEventListener('change', (e) => {
  const px = Math.max(4, parseInt(e.target.value) || 12);
  e.target.value = px;
  if (focusedTextItem) {
    focusedTextItem.style.setProperty('--etv-fs', `${px}px`);
    // Also set standard fontSize for redaction-labels
    if (focusedTextItem.classList.contains('redaction-label')) {
       // Calculation handled by api.js usually, but we set it here for immediate feedback
       focusedTextItem.style.fontSize = `${px}px`; 
    }
    broadcastChange(focusedTextItem);
  }
});

['fabric-bold', 'fabric-italic', 'fabric-underline', 'fabric-strikethrough'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById(id).classList.toggle('active');
    applyFormatting();
  });
});

document.getElementById('fabric-letter-spacing')?.addEventListener('change', (e) => {
  const em = parseFloat(e.target.value) || 0;
  if (focusedTextItem) {
    focusedTextItem.style.letterSpacing = em ? `${em}em` : '';
    broadcastChange(focusedTextItem);
  }
});

document.getElementById('fabric-color')?.addEventListener('input', (e) => {
  if (focusedTextItem) {
    focusedTextItem.style.setProperty('--etv-color', e.target.value);
    focusedTextItem.style.color = e.target.value;
    broadcastChange(focusedTextItem);
  }
});
