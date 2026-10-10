import {
  APPEARANCE_GROUPS, APPEARANCE_SCALE_OPTIONS, ENVIRONMENT_APPEARANCE_KEY,
  appearanceDefaults, appearanceDefaultLineStyle, sanitizeEnvironmentAppearance
} from './EnvironmentAppearance.js?v=0.1.72';

const scaleIndex = id => APPEARANCE_SCALE_OPTIONS.findIndex(scale => scale.id === id);
const dashOptions = [
  { id: 'solid', label: 'Doorgetrokken', pattern: '' },
  { id: 'dotted', label: 'Gestippeld', pattern: '1 6' },
  { id: 'dashed', label: 'Gestreept', pattern: '9 5' }
];

export function createEnvironmentAppearanceEditor(root, store, {
  floating = false, onChange = () => {}
} = {}) {
  const controlsRoot = floating ? root.querySelector('[data-map-controls]') : null;
  if (floating && !controlsRoot) return () => {};
  if (floating) controlsRoot.insertAdjacentHTML('beforeend',
    '<section class="environment-style-flyout" data-map-style-settings aria-label="Kaartstijl aanpassen" hidden></section>');
  const host = root.querySelector('[data-map-style-settings]');
  if (!host) return () => {};
  host.innerHTML = `
    <div class="environment-style-panel" aria-label="Kaartstijl">
      ${floating ? '<header class="environment-style-heading"><strong>Kaartstijl</strong><button type="button" data-style-close aria-label="Sluit kaartstijl">×</button></header>' : ''}
      <div class="environment-style-groups" data-style-groups role="group" aria-label="Kaartonderdelen"></div>
      <div class="environment-style-width">
        <div class="environment-style-width-head">
          <span>Lijndikte</span>
          <div class="environment-style-stroke-picker">
            <label title="Lijnkleur" aria-label="Lijnkleur kiezen">
              <input data-style-stroke type="color" aria-label="Lijnkleur"/>
            </label>
            <small data-style-width-value>1×</small>
          </div>
        </div>
        <input data-style-width type="range" min="0.25" max="4" step="0.25" value="1"
          aria-label="Lijndikte ten opzichte van standaard"/>
      </div>
      <div class="environment-style-dash-choices" role="group" aria-label="Lijnstijl">
        ${dashOptions.map(item => `
          <button type="button" data-style-dash="${item.id}" aria-pressed="false"
            aria-label="${item.label}">
            <svg viewBox="0 0 78 18" width="100%" height="18" aria-hidden="true">
              <line x1="6" y1="9" x2="72" y2="9" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" ${item.pattern ? `stroke-dasharray="${item.pattern}"` : ''}/>
            </svg>
            <small data-dash-default>Standaard</small>
          </button>
        `).join('')}
      </div>
      <div class="environment-style-range">
        <strong>Zichtbaar op schaalniveaus</strong>
        <div class="environment-scale-range">
          <div class="environment-scale-rail">
            <div data-scale-fill></div>
          </div>
          <input data-scale-low type="range" min="0" max="6" step="1" value="0"
            aria-label="Kleinste zichtbare schaalniveau"/>
          <input data-scale-high type="range" min="0" max="6" step="1" value="6"
            aria-label="Grootste zichtbare schaalniveau"/>
        </div>
        <div class="environment-scale-labels">
          ${APPEARANCE_SCALE_OPTIONS.map(scale => `<small>${scale.label}</small>`).join('')}
        </div>
      </div>
      ${floating ? '' : '<div class="environment-style-actions"><button type="button" data-style-reset-one>Herstel onderdeel</button><button type="button" data-style-reset-all>Alles standaard</button></div><small class="environment-style-status" data-style-status role="status">Lokaal opgeslagen</small>'}
    </div>
  `;
  const get = selector => host.querySelector(selector);
  const groups = get('[data-style-groups]');
  const strokeInput = get('[data-style-stroke]');
  const widthInput = get('[data-style-width]');
  const widthValue = get('[data-style-width-value]');
  const dashButtons = [...host.querySelectorAll('[data-style-dash]')];
  const lowInput = get('[data-scale-low]');
  const highInput = get('[data-scale-high]');
  const scaleFill = get('[data-scale-fill]');
  const resetOne = floating ? root.querySelector('[data-style-reset-one]') : get('[data-style-reset-one]');
  const resetAll = floating ? root.querySelector('[data-style-reset-all]') : get('[data-style-reset-all]');
  const status = floating ? root.querySelector('[data-style-status]') : get('[data-style-status]');
  const returnButton = floating ? root.querySelector('[data-style-return]') : null;
  const readout = floating ? root.querySelector('[data-map-readout]') : null;
  const track = floating ? root.querySelector('[data-readout-track]') : null;
  const positionSide = floating ? root.querySelector('[data-readout-position]') : null;
  const styleSide = floating ? root.querySelector('[data-readout-style]') : null;
  const closeButton = get('[data-style-close]');

  let overrides = {}, disposed = false, loaded = false, saveTimer = null;
  let selectedId = APPEARANCE_GROUPS[0].id;
  const listeners = [];
  const listen = (node, name, callback, options) => {
    node?.addEventListener(name, callback, options);
    if (node) listeners.push([node, name, callback, options]);
  };
  const setStatus = message => { if (!disposed && status) status.textContent = message; };
  const chosen = () => APPEARANCE_GROUPS.find(group => group.id === selectedId) || APPEARANCE_GROUPS[0];
  const valuesFor = group => ({ ...appearanceDefaults(group), ...(overrides[group.id] || {}) });
  const notify = category => { if (floating && !disposed) onChange(overrides, category); };

  const preview = group => {
    const values = valuesFor(group);
    const pattern = values.dash === 'dotted' ? '1 6' : values.dash === 'dashed' ? '9 5' :
      (values.dash === 'solid' ? '' : ({ solid: '', dotted: '1 6', dashed: '9 5' }[appearanceDefaultLineStyle(group)]));
    // Compact material/line swatches deliberately avoid miniature map geometry.
    if (group.fill) return `<svg viewBox="0 0 72 25" width="100%" height="25" aria-hidden="true">
      <rect x="12" y="3" width="48" height="19" rx="4"
        fill="${values.fill}" stroke="${values.stroke}" stroke-width="1.8"/></svg>`;
    return `<svg viewBox="0 0 72 25" width="100%" height="25" aria-hidden="true">
      <line x1="10" y1="13" x2="62" y2="13"
        stroke="${values.stroke}" stroke-width="${Math.min(5, 2.2 * values.width)}"
        stroke-linecap="round" ${pattern ? `stroke-dasharray="${pattern}"` : ''}/></svg>`;
  };

  // Keep the same DOM input nodes while the native iOS color picker is open.
  const renderGroups = () => {
    if (!groups.children.length) {
      const fragment = document.createDocumentFragment();
      for (const group of APPEARANCE_GROUPS) {
        const wrapper = document.createElement('div');
        wrapper.className = 'environment-style-group';
        wrapper.dataset.groupCard = group.id;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'environment-style-group-main';
        button.dataset.styleGroup = group.id;
        button.setAttribute('aria-label', group.label);
        const label = document.createElement('span');
        label.textContent = group.label;
        button.append(document.createElement('svg'), label);
        wrapper.append(button);
        if (group.fill) {
          const dot = document.createElement('label');
          dot.className = 'environment-style-fill-dot';
          dot.title = group.label + ': vulkleur';
          const input = document.createElement('input');
          input.type = 'color';
          input.dataset.styleFill = group.id;
          input.setAttribute('aria-label', group.label + ': vulkleur');
          dot.append(input);
          wrapper.append(dot);
        }
        fragment.append(wrapper);
      }
      groups.replaceChildren(fragment);
    }
    for (const group of APPEARANCE_GROUPS) {
      const wrapper = [...groups.children].find(node => node.dataset.groupCard === group.id);
      wrapper.classList.toggle('is-selected', group.id === selectedId);
      const button = wrapper.querySelector('[data-style-group]');
      button.setAttribute('aria-pressed', String(group.id === selectedId));
      const sample = button.querySelector('svg');
      // Edit only the preview SVG; never replace a focused color input.
      sample.outerHTML = preview(group);
      const input = wrapper.querySelector('[data-style-fill]');
      if (input) {
        input.closest('label').style.setProperty('--swatch-color', valuesFor(group).fill);
        if (input !== document.activeElement) input.value = valuesFor(group).fill;
      }
    }
  };
  const render = () => {
    const group = chosen(), values = valuesFor(group);
    renderGroups();
    strokeInput.value = values.stroke;
    strokeInput.closest('label')?.style.setProperty('--swatch-color', values.stroke);
    widthInput.value = String(values.width);
    widthValue.textContent = values.width + '×';
    const defaultDash = appearanceDefaultLineStyle(group);
    const chosenDash = values.dash === 'default' ? defaultDash : values.dash;
    for (const button of dashButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.styleDash === chosenDash));
      button.querySelector('[data-dash-default]').hidden = button.dataset.styleDash !== defaultDash;
    }
    const low = values.to ? scaleIndex(values.to) : 0;
    const high = values.from ? scaleIndex(values.from) : APPEARANCE_SCALE_OPTIONS.length - 1;
    lowInput.value = String(Math.max(0, low));
    highInput.value = String(Math.max(0, high));
    const left = Number(lowInput.value) / 6 * 100, right = Number(highInput.value) / 6 * 100;
    scaleFill.style.left = left + '%';
    scaleFill.style.width = (right - left) + '%';
    resetOne.disabled = !overrides[group.id];
    resetAll.disabled = !Object.keys(overrides).length;
  };
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (!disposed) store.put('meta', { key: ENVIRONMENT_APPEARANCE_KEY, value: overrides })
        .catch(() => setStatus('Opslaan mislukt'));
    }, 250);
  };
  const update = (key, value, groupId = selectedId) => {
    if (!loaded) return;
    const group = APPEARANCE_GROUPS.find(item => item.id === groupId);
    if (!group) return;
    const entry = { ...(overrides[groupId] || {}) };
    const defaults = appearanceDefaults(group);
    if (value === defaults[key] || key === 'dash' && value === 'default' ||
        key === 'width' && value === 1 ||
        (key === 'from' || key === 'to') && !value) delete entry[key];
    else entry[key] = value;
    if (Object.keys(entry).length) overrides[groupId] = entry;
    else delete overrides[groupId];
    overrides = sanitizeEnvironmentAppearance(overrides);
    notify(groupId);
    render();
    setStatus('Direct zichtbaar op de kaart · lokaal opgeslagen');
    persist();
  };
  const setStyleMode = active => {
    if (!floating || disposed) return;
    readout.classList.toggle('is-style-active', active);
    host.hidden = !active;
    styleSide.setAttribute('aria-hidden', String(!active));
    positionSide.setAttribute('aria-hidden', String(active));
    returnButton.tabIndex = active ? 0 : -1;
    resetOne.tabIndex = active ? 0 : -1;
    resetAll.tabIndex = active ? 0 : -1;
    if (active) host.querySelector('[data-style-group]')?.focus();
  };
  // Only a deliberate rightward gesture starting at the left 50 px of the
  // *position bar* activates the editor. This never starts on the map.
  let touchStart = null;
  const beginSwipe = event => {
    if (!floating || readout.classList.contains('is-style-active') ||
        event.touches.length !== 1) return;
    const touch = event.touches[0], bounds = readout.getBoundingClientRect();
    const x = touch.clientX - bounds.left;
    if (x < 0 || x > 50) return;
    touchStart = { x: touch.clientX, y: touch.clientY, locked: false };
  };
  const moveSwipe = event => {
    if (!touchStart || event.touches.length !== 1) return;
    const touch = event.touches[0], dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (dx < -8 || Math.abs(dy) > Math.max(16, dx * 1.15)) {
      touchStart = null; track.style.transform = ''; return;
    }
    if (dx > 8) touchStart.locked = true;
    if (!touchStart.locked) return;
    if (event.cancelable) event.preventDefault();
    track.classList.add('is-dragging');
    track.style.transform = `translate3d(${Math.min(readout.clientWidth, dx) - readout.clientWidth}px,0,0)`;
  };
  const finishSwipe = event => {
    if (!touchStart) return;
    const dx = (event.changedTouches?.[0]?.clientX ?? touchStart.x) - touchStart.x;
    const horizontal = touchStart.locked;
    touchStart = null;
    track.classList.remove('is-dragging');
    track.style.transform = '';
    if (horizontal && dx >= 58) setStyleMode(true);
  };

  listen(groups, 'click', event => {
    const button = event.target.closest('[data-style-group]');
    if (!button) return;
    selectedId = button.dataset.styleGroup;
    render();
  });
  listen(groups, 'input', event => {
    const input = event.target.closest('[data-style-fill]');
    if (!input) return;
    selectedId = input.dataset.styleFill;
    update('fill', input.value, selectedId);
  });
  listen(strokeInput, 'input', () => update('stroke', strokeInput.value));
  listen(widthInput, 'input', () => update('width', Number(widthInput.value)));
  for (const button of dashButtons) listen(button, 'click', () => {
    const defaultDash = appearanceDefaultLineStyle(chosen());
    update('dash', button.dataset.styleDash === defaultDash ? 'default' : button.dataset.styleDash);
  });
  const adjustScale = changed => {
    let low = Number(lowInput.value), high = Number(highInput.value);
    if (low > high) {
      if (changed === 'low') high = low;
      else low = high;
    }
    // Apply both range limits as one state change, not two MapLibre repaints.
    const group = chosen(), entry = { ...(overrides[group.id] || {}) };
    if (low === 0) delete entry.to;
    else entry.to = APPEARANCE_SCALE_OPTIONS[low].id;
    if (high === 6) delete entry.from;
    else entry.from = APPEARANCE_SCALE_OPTIONS[high].id;
    if (Object.keys(entry).length) overrides[group.id] = entry;
    else delete overrides[group.id];
    overrides = sanitizeEnvironmentAppearance(overrides);
    notify(group.id);
    render();
    setStatus('Direct zichtbaar op de kaart · lokaal opgeslagen');
    persist();
  };
  listen(lowInput, 'input', () => { if (loaded) adjustScale('low'); });
  listen(highInput, 'input', () => { if (loaded) adjustScale('high'); });
  listen(resetOne, 'click', () => {
    if (!loaded) return;
    delete overrides[selectedId];
    notify(selectedId);
    render();
    setStatus('Onderdeel hersteld · lokaal opgeslagen');
    persist();
  });
  listen(resetAll, 'click', () => {
    if (!loaded) return;
    overrides = {};
    notify();
    render();
    setStatus('Alles standaard · lokaal opgeslagen');
    persist();
  });
  listen(returnButton, 'click', () => setStyleMode(false));
  listen(closeButton, 'click', () => setStyleMode(false));
  listen(positionSide, 'touchstart', beginSwipe, { passive: true });
  listen(positionSide, 'touchmove', moveSwipe, { passive: false });
  listen(positionSide, 'touchend', finishSwipe, { passive: true });
  listen(positionSide, 'touchcancel', () => {
    touchStart = null;
    track?.classList.remove('is-dragging');
    if (track) track.style.transform = '';
  }, { passive: true });

  // Controls are inert until locally stored customizations have been read.
  const allControls = [...host.querySelectorAll('input,button'), resetOne, resetAll];
  for (const control of allControls) control.disabled = true;
  if (floating) setStyleMode(false);
  store.get('meta', ENVIRONMENT_APPEARANCE_KEY).then(saved => {
    if (disposed) return;
    overrides = sanitizeEnvironmentAppearance(saved?.value);
    loaded = true;
    for (const control of allControls) control.disabled = false;
    render();
    notify();
  }).catch(() => {
    if (disposed) return;
    loaded = true;
    for (const control of allControls) control.disabled = false;
    render();
    notify();
    setStatus('Kon lokale instellingen niet laden');
  });

  const dispose = () => {
    if (disposed) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      store.put('meta', { key: ENVIRONMENT_APPEARANCE_KEY, value: overrides }).catch(() => {});
    }
    disposed = true;
    for (const [node, name, callback, options] of listeners)
      node.removeEventListener(name, callback, options);
    if (floating) host.remove();
  };
  dispose.apply = () => { if (loaded && !disposed) notify(); };
  return dispose;
}
