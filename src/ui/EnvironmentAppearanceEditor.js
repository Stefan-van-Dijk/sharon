import {
  APPEARANCE_GROUPS, APPEARANCE_SCALE_OPTIONS, ENVIRONMENT_APPEARANCE_KEY,
  appearanceDefaults, sanitizeEnvironmentAppearance
} from './EnvironmentAppearance.js?v=0.1.65';

export function createEnvironmentAppearanceEditor(root, store) {
  const host = root.querySelector('[data-map-style-settings]');
  if (!host) return () => {};
  host.innerHTML = `
    <div class="environment-style-panel" aria-label="Kaartstijl">
      <label>Onderdeel
        <select data-style-group aria-label="Kaartonderdeel"></select>
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
      <div class="environment-style-range">
        <strong>Zichtbaar op schaalniveaus</strong>
        <small>Vanaf = verst uitgezoomd. T/m = verst ingezoomd.</small>
        <label>Vanaf
          <select data-style-from aria-label="Zichtbaar vanaf schaalniveau"></select>
        </label>
        <label>Tot en met
          <select data-style-to aria-label="Zichtbaar tot en met schaalniveau"></select>
        </label>
        <small>Standaard volgt de oorspronkelijke kaartweergave.</small>
      </div>
      <div class="environment-style-actions">
        <button type="button" data-style-reset-one>Herstel onderdeel</button>
        <button type="button" data-style-reset-all>Alles standaard</button>
      </div>
      <small class="environment-style-status" data-style-status role="status">
        Instellingen worden alleen op dit apparaat opgeslagen.
      </small>
    </div>
  `;
  const get = selector => host.querySelector(selector);
  const groupInput = get('[data-style-group]');
  const fillRow = get('[data-style-fill-row]');
  const fillInput = get('[data-style-fill]');
  const strokeInput = get('[data-style-stroke]');
  const widthInput = get('[data-style-width]');
  const widthValue = get('[data-style-width-value]');
  const dashInput = get('[data-style-dash]');
  const fromInput = get('[data-style-from]');
  const toInput = get('[data-style-to]');
  const status = get('[data-style-status]');
  const resetOne = get('[data-style-reset-one]');
  const resetAll = get('[data-style-reset-all]');

  for (const group of APPEARANCE_GROUPS) {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.label;
    groupInput.append(option);
  }
  for (const select of [fromInput, toInput]) {
    const standard = document.createElement('option');
    standard.value = '';
    standard.textContent = 'Standaard kaart';
    select.append(standard);
    for (const scale of APPEARANCE_SCALE_OPTIONS) {
      const option = document.createElement('option');
      option.value = scale.id;
      option.textContent = scale.label;
      select.append(option);
    }
  }

  let overrides = {}, disposed = false, saveTimer = null, loaded = false;
  const controls = host.querySelectorAll('input, select, button');
  for (const control of controls) control.disabled = true;
  const currentGroup = () =>
    APPEARANCE_GROUPS.find(group => group.id === groupInput.value) || APPEARANCE_GROUPS[0];
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
    fromInput.value = values.from;
    toInput.value = values.to;
    resetOne.disabled = !overrides[group.id];
    resetAll.disabled = !Object.keys(overrides).length;
  };
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (!disposed) store.put('meta', {
        key: ENVIRONMENT_APPEARANCE_KEY, value: overrides
      }).catch(() => setStatus('Opslaan mislukt; probeer opnieuw.'));
    }, 250);
  };
  const update = (key, value) => {
    if (!loaded) return;
    const group = currentGroup();
    const entry = { ...(overrides[group.id] || {}) };
    const defaults = appearanceDefaults(group);
    if (value === defaults[key] || (key === 'dash' && value === 'default') ||
        (key === 'width' && value === 1) ||
        ((key === 'from' || key === 'to') && value === '')) {
      delete entry[key];
    } else {
      entry[key] = value;
    }
    // Keep the range valid even if the user changes either side first.
    const index = id => APPEARANCE_SCALE_OPTIONS.findIndex(scale => scale.id === id);
    if (entry.from && entry.to && index(entry.from) > index(entry.to)) {
      delete entry[key === 'from' ? 'to' : 'from'];
      setStatus('Bereik aangepast: de andere grens is weer standaard.');
    } else {
      setStatus('Aangepast · lokaal opgeslagen. Bekijk het resultaat in Omgeving.');
    }
    if (Object.keys(entry).length) overrides[group.id] = entry;
    else delete overrides[group.id];
    overrides = sanitizeEnvironmentAppearance(overrides);
    render();
    persist();
  };
  const onGroup = () => render();
  const onFill = () => update('fill', fillInput.value);
  const onStroke = () => update('stroke', strokeInput.value);
  const onWidth = () => update('width', Number(widthInput.value));
  const onDash = () => update('dash', dashInput.value);
  const onFrom = () => update('from', fromInput.value);
  const onTo = () => update('to', toInput.value);
  const onResetOne = () => {
    delete overrides[currentGroup().id];
    render();
    setStatus('Standaard voor dit onderdeel hersteld.');
    persist();
  };
  const onResetAll = () => {
    overrides = {};
    render();
    setStatus('Alle standaardinstellingen hersteld.');
    persist();
  };
  const listeners = [
    [groupInput, 'change', onGroup], [fillInput, 'input', onFill],
    [strokeInput, 'input', onStroke], [widthInput, 'input', onWidth],
    [dashInput, 'change', onDash], [fromInput, 'change', onFrom],
    [toInput, 'change', onTo], [resetOne, 'click', onResetOne],
    [resetAll, 'click', onResetAll]
  ];
  for (const [element, name, callback] of listeners) element.addEventListener(name, callback);

  store.get('meta', ENVIRONMENT_APPEARANCE_KEY).then(saved => {
    if (disposed) return;
    overrides = sanitizeEnvironmentAppearance(saved?.value);
    loaded = true;
    for (const control of controls) control.disabled = false;
    render();
  }).catch(() => {
    if (disposed) return;
    loaded = true;
    for (const control of controls) control.disabled = false;
    render();
    setStatus('Lokale instellingen konden niet worden geladen.');
  });

  return () => {
    if (disposed) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      store.put('meta', { key: ENVIRONMENT_APPEARANCE_KEY, value: overrides }).catch(() => {});
    }
    disposed = true;
    for (const [element, name, callback] of listeners) element.removeEventListener(name, callback);
  };
}
