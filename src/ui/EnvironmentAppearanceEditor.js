import {
  APPEARANCE_GROUPS, ENVIRONMENT_APPEARANCE_KEY,
  appearanceDefaults, sanitizeEnvironmentAppearance, applyEnvironmentAppearance
} from './EnvironmentAppearance.js?v=0.1.64';

export function createEnvironmentAppearanceEditor(root, store, getMap) {
  const controls = root.querySelector('[data-map-controls]');
  if (!controls) return { apply: () => {}, dispose: () => {} };
  controls.insertAdjacentHTML('beforeend', `
    <button type="button" class="environment-style-toggle" data-style-open
      aria-label="Kaartstijl aanpassen" aria-expanded="false" aria-controls="environment-style-editor">Stijl</button>
    <section class="environment-style-panel" data-style-panel id="environment-style-editor"
      aria-label="Kaartstijl" hidden>
      <header class="environment-style-heading">
        <strong>Kaartstijl</strong>
        <button type="button" data-style-close aria-label="Sluit kaartstijl">×</button>
      </header>
      <label>Onderdeel
        <select data-style-group></select>
      </label>
      <label data-style-fill-row>Vulkleur
        <input data-style-fill type="color" aria-label="Vulkleur"/>
      </label>
      <label>Lijnkleur
        <input data-style-stroke type="color" aria-label="Lijnkleur"/>
      </label>
      <label>Lijndikte <small data-style-width-value>1× standaard</small>
        <input data-style-width type="range" min="0.25" max="4" step="0.25" value="1"
          aria-label="Lijndikte ten opzichte van standaard"/>
      </label>
      <label>Lijnstijl
        <select data-style-dash>
          <option value="default">Standaard</option>
          <option value="solid">Doorgetrokken</option>
          <option value="dotted">Gestippeld</option>
          <option value="dashed">Gestreept</option>
        </select>
      </label>
      <div class="environment-style-actions">
        <button type="button" data-style-reset-one>Herstel onderdeel</button>
        <button type="button" data-style-reset-all>Alles standaard</button>
      </div>
      <small class="environment-style-status" data-style-status role="status">
        Instellingen worden alleen op dit apparaat bewaard.
      </small>
    </section>
  `);
  const get = selector => controls.querySelector(selector);
  const toggle = get('[data-style-open]');
  const panel = get('[data-style-panel]');
  const groupInput = get('[data-style-group]');
  const fillRow = get('[data-style-fill-row]');
  const fillInput = get('[data-style-fill]');
  const strokeInput = get('[data-style-stroke]');
  const widthInput = get('[data-style-width]');
  const widthValue = get('[data-style-width-value]');
  const dashInput = get('[data-style-dash]');
  const status = get('[data-style-status]');
  const close = get('[data-style-close]');
  const resetOne = get('[data-style-reset-one]');
  const resetAll = get('[data-style-reset-all]');

  for (const group of APPEARANCE_GROUPS) {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.label;
    groupInput.append(option);
  }

  let overrides = {}, disposed = false, saveTimer = null;
  let loaded = false, dirty = false;
  toggle.disabled = true;
  const currentGroup = () => APPEARANCE_GROUPS.find(g => g.id === groupInput.value) || APPEARANCE_GROUPS[0];
  const setStatus = text => { if (!disposed) status.textContent = text; };
  const render = () => {
    const group = currentGroup();
    const values = { ...appearanceDefaults(group), ...(overrides[group.id] || {}) };
    fillRow.hidden = !group.fill;
    if (group.fill) fillInput.value = values.fill;
    strokeInput.value = values.stroke;
    widthInput.value = String(values.width);
    widthValue.textContent = values.width + '× standaard';
    dashInput.value = values.dash;
    resetOne.disabled = !overrides[group.id];
    resetAll.disabled = !Object.keys(overrides).length;
  };
  const apply = (category = null) => {
    const map = getMap();
    if (!map) return;
    try {
      applyEnvironmentAppearance(map, overrides, category);
    } catch (error) {
      setStatus('Kaartstijl kan niet worden toegepast.');
      console.warn('Sharon kaartstijl', error);
    }
  };
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!disposed) store.put('meta', {
        key: ENVIRONMENT_APPEARANCE_KEY, value: overrides
      }).catch(() => setStatus('Opslaan mislukt; probeer opnieuw.'));
    }, 250);
  };
  const update = (key, value) => {
    if (!loaded) return;
    const group = currentGroup();
    const original = appearanceDefaults(group);
    const entry = { ...(overrides[group.id] || {}) };
    if (value === original[key] || (key === 'dash' && value === 'default') ||
        (key === 'width' && value === 1)) {
      delete entry[key];
    } else {
      entry[key] = value;
    }
    if (Object.keys(entry).length) overrides[group.id] = entry;
    else delete overrides[group.id];
    overrides = sanitizeEnvironmentAppearance(overrides);
    dirty = true;
    apply(group.id);
    render();
    setStatus('Aangepast · lokaal opgeslagen');
    persist();
  };
  const show = visible => {
    panel.hidden = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
    if (visible) groupInput.focus();
    else toggle.focus();
  };
  const onOpen = () => show(panel.hidden);
  const onClose = () => show(false);
  const onGroup = () => { render(); setStatus('Kies kleuren en lijnweergave.'); };
  const onFill = () => update('fill', fillInput.value);
  const onStroke = () => update('stroke', strokeInput.value);
  const onWidth = () => update('width', Number(widthInput.value));
  const onDash = () => update('dash', dashInput.value);
  const onResetOne = () => {
    delete overrides[currentGroup().id];
    dirty = true;
    apply(currentGroup().id);
    render();
    setStatus('Standaard voor dit onderdeel hersteld.');
    persist();
  };
  const onResetAll = () => {
    overrides = {};
    dirty = true;
    apply();
    render();
    setStatus('Alle standaardinstellingen hersteld.');
    persist();
  };
  const listeners = [
    [toggle, 'click', onOpen], [close, 'click', onClose],
    [groupInput, 'change', onGroup], [fillInput, 'input', onFill],
    [strokeInput, 'input', onStroke], [widthInput, 'input', onWidth],
    [dashInput, 'change', onDash], [resetOne, 'click', onResetOne],
    [resetAll, 'click', onResetAll]
  ];
  for (const [element, name, fn] of listeners) element.addEventListener(name, fn);

  store.get('meta', ENVIRONMENT_APPEARANCE_KEY)
    .then(saved => {
      if (disposed) return;
      if (!dirty) overrides = sanitizeEnvironmentAppearance(saved?.value);
      loaded = true;
      toggle.disabled = false;
      render();
      apply();
    })
    .catch(() => {
      if (disposed) return;
      loaded = true;
      toggle.disabled = false;
      render();
      setStatus('Lokale instellingen niet geladen; standaard actief.');
    });

  return {
    apply: () => { if (loaded) apply(); },
    dispose: () => {
      if (disposed) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        store.put('meta', { key: ENVIRONMENT_APPEARANCE_KEY, value: overrides }).catch(() => {});
      }
      disposed = true;
      for (const [element, name, fn] of listeners) element.removeEventListener(name, fn);
      toggle.remove();
      panel.remove();
    }
  };
}
