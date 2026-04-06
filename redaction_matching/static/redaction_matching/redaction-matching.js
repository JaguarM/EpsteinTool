// redaction-matching.js
// Handles the candidate-matching specific DOM modifications for redaction boxes

function injectMatchingLabel(overlay, r, idx) {
    const label = document.createElement('div');
    label.className = 'redaction-label';
    label.contentEditable = 'false';
    label.spellcheck = false;
    label.tabIndex = 0; // ENABLE FOCUS
    label.textContent = r.labelText || '';
    label.dataset.manualEdit = r.manualLabel ? 'true' : 'false';

    // Set font styles immediately so zoom (via --scale-factor CSS var) works from the start
    const basePx = r.settings.size * (r.settings.scale / 100);
    label.style.fontFamily = typeof getFontFamily === 'function' ? getFontFamily(r.settings.font) : 'sans-serif';
    label.style.fontSize = `calc(${basePx}px * var(--scale-factor, 1))`;
    label.style.fontVariantLigatures = r.settings.lig ? 'common-ligatures' : 'none';
    label.style.fontFeatureSettings = `"kern" ${r.settings.kern ? 1 : 0}`;
    label.style.textTransform = r.settings.upper ? 'uppercase' : 'none';
    label.style.display = r.labelText ? 'flex' : 'none';

    label.onclick = (e) => {
      e.stopPropagation();
      if (typeof selectRedaction === 'function') selectRedaction(idx);
    };
    label.ondblclick = (e) => {
      e.stopPropagation();
      if (label.isContentEditable) return;
      label.contentEditable = 'true';
      label.focus();
    };
    label.oninput = () => {
      if (state.redactions[idx]) {
        state.redactions[idx].labelText = label.textContent || '';
        state.redactions[idx].manualLabel = true;
        label.dataset.manualEdit = 'true';
      }
    };
    label.onblur = () => {
      if (state.redactions[idx]) {
        state.redactions[idx].labelText = label.textContent || '';
        state.redactions[idx].manualLabel = true;
        label.dataset.manualEdit = 'true';
      }
      label.contentEditable = 'false';
      label.classList.remove('editing');
    };
    label.onfocus = () => {
      if (typeof selectRedaction === 'function') selectRedaction(idx);
    };

    overlay.appendChild(label);
}
