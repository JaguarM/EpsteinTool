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
    const fs = r.settings.fontSize || 16;
    label.style.fontFamily = r.settings.fontFamily || 'inherit';
    label.style.setProperty('--etv-fs', `${fs}px`);
    label.style.fontSize = `calc(${fs}px * var(--scale-factor, 1))`;
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
      const wasEditing = label.contentEditable === 'true';
      label.contentEditable = 'false';
      label.classList.remove('editing');
      if (wasEditing && state.redactions[idx]) {
        state.redactions[idx].labelText = label.textContent || '';
        state.redactions[idx].manualLabel = true;
        label.dataset.manualEdit = 'true';
      }
    };
    label.onfocus = () => {
      if (typeof selectRedaction === 'function') selectRedaction(idx);
    };

    overlay.appendChild(label);
}
