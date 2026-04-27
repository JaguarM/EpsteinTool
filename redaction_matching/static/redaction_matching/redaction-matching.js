// redaction-matching.js

/* Rendering Redaction Overlays inside Document Pages */
function injectRedactionOverlays() {
  if (!state.redactions.length) return;

  document.querySelectorAll('.redaction-overlay').forEach(e => e.remove());

  state.redactions.forEach((r, idx) => {
    const container = document.getElementById(`pageContainer${r.page}`);
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'redaction-overlay';
    overlay.id = `redaction-idx-${idx}`;

    overlay.style.setProperty('--px-x', `${r.x}px`);
    overlay.style.setProperty('--px-y', `${r.y}px`);
    overlay.style.setProperty('--px-width', `${r.width}px`);
    overlay.style.setProperty('--px-height', `${r.height}px`);

    overlay.onclick = (e) => {
      e.stopPropagation();
      if (typeof selectRedaction === 'function') selectRedaction(idx);
    };

    overlay.onmousedown = (e) => {
      if (e.button !== 0) return;
      if (e.detail > 1) return;
      if (e.target.classList.contains('resizer')) return;
      initDragRedaction(e, idx);
    };

    ['l', 'r', 't', 'b'].forEach(edge => {
      const resizer = document.createElement('div');
      resizer.className = `resizer resizer-${edge}`;
      resizer.onmousedown = (e) => initResize(e, idx, edge);
      overlay.appendChild(resizer);
    });

    const label = document.createElement('div');
    label.className = 'etv-span redaction-label'; // etv-span = unified toolbar/selection handling
    label.contentEditable = 'false'; // text-tool.js manages contentEditable state
    label.tabIndex = 0;              // stays focusable even when contentEditable is false
    label.spellcheck = false;
    label.dataset.redactionIdx = idx; // used by persistChangesToState to detect redaction labels
    label.textContent = r.labelText || '';

    label.style.fontFamily = r.settings.fontFamily || 'inherit';
    label.style.setProperty('--etv-fs', `${r.settings.fontSize || 16}px`);
    label.style.fontSize = `calc(${r.settings.fontSize || 16}px * var(--scale-factor, 1))`;
    label.style.color = r.settings.color || '#81c995';

    label.addEventListener('click', (e) => e.stopPropagation());

    overlay.appendChild(label);

    if (idx === state.selectedRedactionIdx) overlay.classList.add('selected');

    container.appendChild(overlay);
  });
}
