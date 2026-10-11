import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, APPEARANCE_SCALE_OPTIONS, ENVIRONMENT_APPEARANCE_KEY,
  appearanceDefaults, appearanceDefaultLineStyle, appearanceSectionDefaults,
  appearanceSectionProperties, resolvedEnvironmentAppearance, sanitizeEnvironmentAppearance
} from './EnvironmentAppearance.js?v=0.1.78';
import {
  HEIGHT_TARGETS, MAX_HEIGHT_CUTS, addHeightCut, moveHeightCut,
  removeHeightCut, editHeightBand, heightBandLabel
} from './EnvironmentHeight.js?v=0.1.78';
import { HATCH_OPTIONS, environmentHatchPreview } from './EnvironmentHatch.js?v=0.1.78';

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

  // All controls have a stable DOM node, especially native color inputs on iOS.
  host.innerHTML = [
    '<div class="environment-style-panel" aria-label="Kaartstijl">',
      '<nav class="environment-style-tabs" data-style-sections aria-label="Kaartgroepen"></nav>',
      '<div class="environment-style-scope">',
        '<button type="button" data-style-parent aria-pressed="true">Groep</button>',
        '<span data-style-selection aria-live="polite"></span>',
        '<button type="button" class="environment-height-trigger" data-height-open hidden aria-label="Hoogtegroepen instellen" aria-expanded="false">Hoogte</button>',
        '<button type="button" data-style-inherit disabled>Groep overnemen ↶</button>',
      '</div>',
      '<div class="environment-style-subgroup-rail">',
        '<div class="environment-style-groups" data-style-groups role="group" aria-label="Subgroepen"></div>',
      '</div>',
      '<div class="environment-style-colors">',
        '<div class="environment-style-color-row" data-style-fill-row>',
          '<span>Vulling</span>',
          '<label class="environment-color-edit">',
            '<span class="environment-color-swatch" data-fill-swatch>',
              '<input data-style-fill type="color" aria-label="Vulkleur kiezen"/>',
            '</span>',
            '<output data-style-fill-hex></output>',
          '</label>',
          '<button type="button" data-inherit-field="fill" aria-label="Vulkleur van groep overnemen" disabled>↶</button>',
        '</div>',
        '<div class="environment-style-color-row" data-style-hatch-row>',
          '<span>Arcering</span>',
          '<button type="button" class="environment-hatch-current" data-style-hatch aria-label="Arcering kiezen" aria-expanded="false">',
            '<span data-hatch-current-preview></span>',
          '</button>',
          '<button type="button" data-inherit-field="hatch" aria-label="Arcering van groep overnemen" disabled>↶</button>',
        '</div>',
        '<div class="environment-style-color-row" data-style-stroke-row>',
          '<span data-style-stroke-label>Lijn</span>',
          '<label class="environment-color-edit">',
            '<span class="environment-color-swatch" data-stroke-swatch>',
              '<input data-style-stroke type="color" aria-label="Lijnkleur kiezen"/>',
            '</span>',
            '<output data-style-stroke-hex></output>',
          '</label>',
          '<button type="button" data-inherit-field="stroke" aria-label="Lijnkleur van groep overnemen" disabled>↶</button>',
        '</div>',
      '</div>',
      '<div class="environment-hatch-picker" data-hatch-picker role="group" aria-label="Kies een arcering" hidden></div>',
      '<div class="environment-height-picker" data-height-picker hidden>',
        '<div class="environment-height-head"><strong data-height-title>Hoogte</strong><span data-height-count>1 groep</span>',
          '<button type="button" data-height-close aria-label="Sluiten">×</button></div>',
        '<div class="environment-height-edit"><input data-height-slider type="range" aria-label="Hoogtegrens" />',
          '<output data-height-value>20 m</output>',
          '<button type="button" data-height-add>Grens toevoegen</button></div>',
        '<div class="environment-height-cut-list" data-height-cuts></div>',
        '<div class="environment-height-band-list" data-height-bands></div>',
        '<small data-height-note>Verplaats de schuif en kies Grens toevoegen. Zonder grens blijft alles één geheel.</small>',
      '</div>',
      '<div class="environment-style-width">',
        '<span>Dikte</span>',
        '<input data-style-width type="range" min="0.25" max="4" step="0.25" value="1" aria-label="Lijndikte"/>',
        '<output data-style-width-value>1×</output>',
        '<button type="button" data-inherit-field="width" aria-label="Lijndikte van groep overnemen" disabled>↶</button>',
      '</div>',
      '<div class="environment-style-dash-choices" role="group" aria-label="Lijnstijl"></div>',
      '<div class="environment-style-range">',
        '<div class="environment-style-range-head"><span>Schaal</span>',
          '<button type="button" data-inherit-field="scale" aria-label="Schaalbereik van groep overnemen" disabled>↶</button>',
        '</div>',
        '<div class="environment-scale-range">',
          '<div class="environment-scale-rail"><div data-scale-fill></div></div>',
          '<input data-scale-low type="range" min="0" max="6" step="1" value="0" aria-label="Kleinste zichtbare schaalniveau"/>',
          '<input data-scale-high type="range" min="0" max="6" step="1" value="6" aria-label="Grootste zichtbare schaalniveau"/>',
        '</div>',
        '<div class="environment-scale-labels">',
          APPEARANCE_SCALE_OPTIONS.map(scale => '<small>' + scale.label + '</small>').join(''),
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  const get = selector => host.querySelector(selector);
  const tabs = get('[data-style-sections]');
  const groups = get('[data-style-groups]');
  const parentButton = get('[data-style-parent]');
  const selection = get('[data-style-selection]');
  const heightOpen = get('[data-height-open]');
  const heightPicker = get('[data-height-picker]');
  const heightTitle = get('[data-height-title]');
  const heightCount = get('[data-height-count]');
  const heightSlider = get('[data-height-slider]');
  const heightValue = get('[data-height-value]');
  const heightAdd = get('[data-height-add]');
  const heightCuts = get('[data-height-cuts]');
  const heightBandsList = get('[data-height-bands]');
  const inheritButton = get('[data-style-inherit]');
  const fillRow = get('[data-style-fill-row]');
  const fillInput = get('[data-style-fill]');
  const fillHex = get('[data-style-fill-hex]');
  const hatchRow = get('[data-style-hatch-row]');
  const hatchInput = get('[data-style-hatch]');
  const hatchPicker = get('[data-hatch-picker]');
  const hatchPreview = get('[data-hatch-current-preview]');
  const strokeLabel = get('[data-style-stroke-label]');
  const strokeRow = get('[data-style-stroke-row]');
  const strokeInput = get('[data-style-stroke]');
  const strokeHex = get('[data-style-stroke-hex]');
  const widthRow = get('.environment-style-width');
  const widthInput = get('[data-style-width]');
  const widthValue = get('[data-style-width-value]');
  const dashRow = get('.environment-style-dash-choices');
  const rangeRow = get('.environment-style-range');
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

  for (const item of APPEARANCE_SECTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.styleSection = item.id;
    button.textContent = item.label;
    tabs.append(button);
  }
  for (const hatch of HATCH_OPTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'environment-hatch-choice';
    button.dataset.hatchChoice = hatch.id;
    button.setAttribute('aria-label', hatch.label);
    button.setAttribute('aria-pressed', 'false');
    const picture = document.createElement('span');
    picture.className = 'environment-hatch-sample';
    picture.innerHTML = environmentHatchPreview(hatch.id, 'choice-' + hatch.id);
    const name = document.createElement('small');
    name.textContent = hatch.label;
    button.append(picture, name);
    hatchPicker.append(button);
  }
  for (const option of dashOptions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.styleDash = option.id;
    button.setAttribute('aria-label', option.label);
    button.setAttribute('aria-pressed', 'false');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 78 18');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    for (const [key, val] of Object.entries({
      x1: '6', y1: '9', x2: '72', y2: '9', stroke: 'currentColor',
      'stroke-width': '2.5', 'stroke-linecap': 'round'
    })) line.setAttribute(key, val);
    if (option.pattern) line.setAttribute('stroke-dasharray', option.pattern);
    svg.append(line);
    const small = document.createElement('small');
    small.dataset.dashDefault = '';
    small.textContent = 'Standaard';
    button.append(svg, small);
    dashRow.append(button);
  }
  const dashButtons = [...dashRow.querySelectorAll('[data-style-dash]')];

  let overrides = {}, disposed = false, loaded = false, saveTimer = null;
  let sectionId = 'basis', selectedId = null, shownSectionId = null;
  let activeHeightBand = null, editingHeightCut = null;
  const heightDraft = { land: HEIGHT_TARGETS.land.suggested,
    buildings: HEIGHT_TARGETS.buildings.suggested };
  const listeners = [];
  const listen = (node, event, callback, options) => {
    node?.addEventListener(event, callback, options);
    if (node) listeners.push([node, event, callback, options]);
  };
  const setStatus = message => { if (!disposed && status) status.textContent = message; };
  const section = () => APPEARANCE_SECTIONS.find(item => item.id === sectionId);
  const child = () => APPEARANCE_GROUPS.find(group => group.id === selectedId);
  const isHeightClass = () => activeHeightBand !== null && !!selectedId &&
    !!overrides.heightBands?.[selectedId]?.styles?.[activeHeightBand];
  const currentStyle = () => {
    const base = selectedId ?
      resolvedEnvironmentAppearance(overrides, selectedId) :
      { ...appearanceSectionDefaults(section()), ...(overrides.groupStyles?.[sectionId] || {}) };
    return isHeightClass() ? {
      ...base, ...overrides.heightBands[selectedId].styles[activeHeightBand]
    } : base;
  };
  const currentCaps = () => isHeightClass() ? {
    fill: true, hatch: selectedId === 'buildings',
    stroke: selectedId === 'buildings', width: false, dash: false, scale: false
  } : selectedId ? {
    fill: !!(child().fill || child().background),
    hatch: !!(child().fill || child().background),
    stroke: !!child().lines?.length,
    width: !!child().lines?.length,
    dash: !!child().lines?.length,
    scale: !child().background
  } : appearanceSectionProperties(section());
  const currentEntry = () => isHeightClass()
    ? overrides.heightBands[selectedId].styles[activeHeightBand]
    : selectedId ? (overrides[selectedId] || {}) :
    (overrides.groupStyles?.[sectionId] || {});
  const notify = category => { if (floating && !disposed) onChange(overrides, category); };

  const hatchOverlay = (group, hatch) => {
    if (!hatch || hatch === 'none') return '';
    // Use the exact same texture pixels in the preview as on the MapLibre map.
    return environmentHatchPreview(hatch, 'part-' + group.id).replace(
      '<svg viewBox="0 0 64 30"',
      '<svg x="12" y="3" width="48" height="19" viewBox="0 0 64 30"'
    );
  };
  // No miniature maps: one fill patch or a single line, with current effective style.
  const preview = group => {
    const v = resolvedEnvironmentAppearance(overrides, group.id) || appearanceDefaults(group);
    if (group.fill || group.background) {
      return '<svg viewBox="0 0 72 25" aria-hidden="true">' +
        '<rect x="12" y="3" width="48" height="19" fill="' + v.fill +
        '" stroke="' + (v.stroke || '#b9b9bf') + '" stroke-width="1.3"/>' +
        (group.fill ? hatchOverlay(group, v.hatch) : '') + '</svg>';
    }
    const pattern = v.dash === 'dotted' ? '1 6' : v.dash === 'dashed' ? '9 5' :
      v.dash === 'solid' ? '' :
      ({ solid: '', dotted: '1 6', dashed: '9 5' }[appearanceDefaultLineStyle(group)]);
    return '<svg viewBox="0 0 72 25" aria-hidden="true">' +
      '<line x1="10" y1="13" x2="62" y2="13" stroke="' + v.stroke +
      '" stroke-width="' + Math.min(5, 2.2 * v.width) + '"' +
      (pattern ? ' stroke-dasharray="' + pattern + '"' : '') +
      ' stroke-linecap="round"/></svg>';
  };
  const renderGrid = () => {
    if (shownSectionId !== sectionId) {
      const fragment = document.createDocumentFragment();
      for (const id of section().items) {
        const group = APPEARANCE_GROUPS.find(item => item.id === id);
        const wrapper = document.createElement('div');
        wrapper.className = 'environment-style-group';
        wrapper.dataset.groupCard = id;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'environment-style-group-main';
        button.dataset.styleGroup = id;
        button.setAttribute('aria-label', group.label);
        const sample = document.createElement('svg');
        const label = document.createElement('span');
        label.textContent = group.label;
        const deviation = document.createElement('i');
        deviation.className = 'environment-style-deviation';
        deviation.setAttribute('aria-hidden', 'true');
        button.append(sample, label, deviation);
        wrapper.append(button);
        fragment.append(wrapper);
      }
      // Only real groups create separators: one child has zero separators,
      // four children have three, longer rows naturally continue sideways.
      groups.replaceChildren(fragment);
      // Every group starts at its first four tiles. Horizontal dragging stays
      // local to this raster; no extra rows or jump in the surrounding map.
      groups.scrollLeft = 0;
      shownSectionId = sectionId;
    }
    for (const id of section().items) {
      const wrapper = [...groups.children].find(node => node.dataset.groupCard === id);
      wrapper.classList.toggle('is-selected', id === selectedId);
      wrapper.classList.toggle('has-deviation', !!overrides[id]);
      const button = wrapper.querySelector('[data-style-group]');
      button.setAttribute('aria-pressed', String(id === selectedId));
      button.querySelector('svg').outerHTML = preview(APPEARANCE_GROUPS.find(item => item.id === id));
    }
  };
  const closeHatchPicker = () => {
    hatchPicker.hidden = true;
    hatchInput.setAttribute('aria-expanded', 'false');
  };
  const closeHeightPicker = () => {
    heightPicker.hidden = true;
    heightOpen.setAttribute('aria-expanded', 'false');
  };
  const renderHeightPicker = () => {
    const target = HEIGHT_TARGETS[selectedId];
    if (!target) { closeHeightPicker(); return; }
    const band = overrides.heightBands?.[selectedId];
    const cuts = band?.cuts || [];
    heightTitle.textContent = target.label;
    heightCount.textContent = (cuts.length + 1) + (cuts.length ? ' groepen' : ' groep');
    heightSlider.min = String(target.min + target.step);
    heightSlider.max = String(target.max - target.step);
    heightSlider.step = String(target.step);
    heightSlider.value = String(heightDraft[selectedId]);
    heightValue.textContent = heightDraft[selectedId] + ' m';
    get('[data-height-note]').textContent = selectedId === 'land'
      ? 'Hoogte op basis van Mapterhorn-terreinmodel. De extra kaartlaag laadt pas zodra een grens bestaat.'
      : 'Geschatte gebouwhoogte uit kaartgegevens. Zonder grens blijft de gebouwstijl ongewijzigd.';
    heightAdd.textContent = editingHeightCut === null ? 'Grens toevoegen' : 'Grens verplaatsen';
    heightAdd.disabled = editingHeightCut === null && cuts.length >= MAX_HEIGHT_CUTS;
    heightCuts.replaceChildren();
    cuts.forEach((height, index) => {
      const row = document.createElement('span');
      row.className = 'environment-height-cut';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.dataset.heightCut = String(index);
      edit.textContent = height + ' m';
      edit.setAttribute('aria-pressed', String(editingHeightCut === index));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.dataset.heightRemove = String(index);
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Hoogtegrens ' + height + ' meter verwijderen');
      row.append(edit, remove);
      heightCuts.append(row);
    });
    heightBandsList.replaceChildren();
    if (!cuts.length) {
      const label = document.createElement('small');
      label.textContent = 'Alle hoogtes samen · geen verdeling';
      heightBandsList.append(label);
    } else {
      // The original subgroup remains unchanged; altitude bands inherit
      // its styling until a band is explicitly customized.
      const normal = document.createElement('button');
      normal.type = 'button'; normal.dataset.heightBand = 'all';
      normal.textContent = 'Alle hoogtes';
      normal.setAttribute('aria-pressed', String(activeHeightBand === null));
      heightBandsList.append(normal);
      for (let i = 0; i <= cuts.length; i++) {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.heightBand = String(i);
        button.textContent = heightBandLabel(overrides.heightBands, selectedId, i);
        button.setAttribute('aria-pressed', String(activeHeightBand === i));
        heightBandsList.append(button);
      }
    }
  };
  const render = () => {
    if (!loaded) return;
    const s = section(), values = currentStyle(), caps = currentCaps(), entry = currentEntry();
    for (const tab of tabs.querySelectorAll('[data-style-section]'))
      tab.setAttribute('aria-pressed', String(tab.dataset.styleSection === sectionId));
    renderGrid();
    parentButton.setAttribute('aria-pressed', String(!selectedId));
    const bandTitle = isHeightClass()
      ? ' · ' + heightBandLabel(overrides.heightBands, selectedId, activeHeightBand) : '';
    selection.textContent = selectedId ? child().label + bandTitle : '';
    heightOpen.hidden = !HEIGHT_TARGETS[selectedId];
    if (HEIGHT_TARGETS[selectedId]) {
      const count = overrides.heightBands?.[selectedId]?.cuts?.length || 0;
      heightOpen.textContent = 'Hoogte ' + (count + 1);
      renderHeightPicker();
    } else closeHeightPicker();
    inheritButton.disabled = !selectedId || !Object.keys(entry).length;
    // Keep all property rows at fixed positions. Unsupported properties
    // visibly remain as disabled controls rather than collapsing the sheet.
    for (const [row, applicable] of [
      [widthRow, caps.width],
      [dashRow, caps.dash], [rangeRow, caps.scale]
    ]) {
      row.classList.toggle('is-unavailable', !applicable);
      row.setAttribute('aria-disabled', String(!applicable));
    }
    // Only the applicable color properties appear in this specific row.
    fillRow.hidden = !caps.fill;
    hatchRow.hidden = !caps.hatch;
    strokeRow.hidden = !caps.stroke;
    strokeLabel.textContent = selectedId && child()?.fill ? 'Rand' :
      !selectedId && section().items.some(id =>
        APPEARANCE_GROUPS.find(group => group.id === id)?.fill) ? 'Rand/lijn' : 'Lijn';
    const colorCount = Number(caps.fill) + Number(caps.hatch) + Number(caps.stroke);
    get('.environment-style-colors').style.gridTemplateColumns =
      'repeat(' + Math.max(1, colorCount) + ', minmax(0,1fr))';
    fillInput.disabled = !caps.fill;
    hatchInput.disabled = !caps.hatch;
    strokeInput.disabled = !caps.stroke;
    widthInput.disabled = !caps.width;
    for (const button of dashButtons) button.disabled = !caps.dash;
    lowInput.disabled = !caps.scale;
    highInput.disabled = !caps.scale;
    if (!caps.fill) {
      get('[data-fill-swatch]').style.setProperty('--style-color', '#e3e3e7');
      fillHex.textContent = '—';
    }
    if (!caps.stroke) {
      get('[data-stroke-swatch]').style.setProperty('--style-color', '#e3e3e7');
      strokeHex.textContent = '—';
      widthValue.textContent = '—';
      for (const button of dashButtons) button.setAttribute('aria-pressed', 'false');
    }
    if (caps.hatch) {
      const active = values.hatch || 'none';
      hatchPreview.innerHTML = environmentHatchPreview(active, 'current');
      const label = HATCH_OPTIONS.find(option => option.id === active)?.label || 'Geen';
      hatchInput.setAttribute('aria-label', 'Arcering kiezen: ' + label);
      for (const button of hatchPicker.querySelectorAll('[data-hatch-choice]'))
        button.setAttribute('aria-pressed', String(button.dataset.hatchChoice === active));
    } else closeHatchPicker();
    if (caps.fill) {
      get('[data-fill-swatch]').style.setProperty('--style-color', values.fill);
      fillHex.textContent = values.fill?.toUpperCase() || '';
      if (fillInput !== document.activeElement && values.fill) fillInput.value = values.fill;
    }
    if (caps.stroke) {
      get('[data-stroke-swatch]').style.setProperty('--style-color', values.stroke);
      strokeHex.textContent = values.stroke?.toUpperCase() || '';
      if (strokeInput !== document.activeElement && values.stroke) strokeInput.value = values.stroke;
      widthInput.value = String(values.width);
      widthValue.textContent = values.width + '×';
      const firstLine = APPEARANCE_GROUPS.find(group =>
        group.lines?.length && s.items.includes(group.id));
      const defaultDash = appearanceDefaultLineStyle(selectedId ? child() : firstLine);
      const chosenDash = values.dash === 'default' ? defaultDash : values.dash;
      for (const button of dashButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.styleDash === chosenDash));
        button.querySelector('[data-dash-default]').hidden = button.dataset.styleDash !== defaultDash;
      }
    }
    if (caps.scale) {
      const low = values.to && values.to !== 'all' ? scaleIndex(values.to) : 0;
      const high = values.from && values.from !== 'all' ? scaleIndex(values.from) : 6;
      lowInput.value = String(Math.max(0, low));
      highInput.value = String(Math.max(0, high));
      scaleFill.style.left = (Number(lowInput.value) / 6 * 100) + '%';
      scaleFill.style.width =
        ((Number(highInput.value) - Number(lowInput.value)) / 6 * 100) + '%';
    }
    for (const button of host.querySelectorAll('[data-inherit-field]')) {
      const field = button.dataset.inheritField;
      const available = field === 'scale' ? caps.scale : !!caps[field];
      button.disabled = !selectedId || !available ||
        (field === 'scale' ? !('from' in entry || 'to' in entry) : !(field in entry));
    }
    resetOne.disabled = !Object.keys(entry).length;
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
  const saveChanges = category => {
    overrides = sanitizeEnvironmentAppearance(overrides);
    notify(category);
    render();
    setStatus('Direct zichtbaar op de kaart · lokaal opgeslagen');
    persist();
  };
  const editEntry = fn => {
    if (!loaded) return;
    const entry = { ...currentEntry() };
    fn(entry);
    if (isHeightClass()) {
      const current = overrides.heightBands;
      const oldStyle = current[selectedId].styles[activeHeightBand];
      let next = { ...current };
      for (const field of ['fill', 'stroke', 'hatch']) {
        if (Object.hasOwn(entry, field) !== Object.hasOwn(oldStyle, field) ||
            entry[field] !== oldStyle[field])
          next = editHeightBand(next, selectedId, activeHeightBand, field,
            Object.hasOwn(entry, field) ? entry[field] : null);
      }
      overrides.heightBands = next;
    } else if (selectedId) {
      if (Object.keys(entry).length) overrides[selectedId] = entry;
      else delete overrides[selectedId];
    } else {
      const parent = { ...(overrides.groupStyles || {}) };
      if (Object.keys(entry).length) parent[sectionId] = entry;
      else delete parent[sectionId];
      if (Object.keys(parent).length) overrides.groupStyles = parent;
      else delete overrides.groupStyles;
    }
    saveChanges(selectedId || 'group:' + sectionId);
  };
  const inheritedValue = field => {
    if (!selectedId) return appearanceSectionDefaults(section())[field];
    if (isHeightClass()) return resolvedEnvironmentAppearance(overrides, selectedId)[field];
    return {
      ...appearanceDefaults(child()),
      ...(overrides.groupStyles?.[sectionId] || {})
    }[field];
  };
  const update = (field, value) => editEntry(entry => {
    const fallback = inheritedValue(field);
    if (value === fallback || (field === 'dash' && value === 'default' &&
        (fallback === 'default' || !fallback))) delete entry[field];
    else entry[field] = value;
  });
  const adjustScale = changed => {
    if (!loaded) return;
    let low = Number(lowInput.value), high = Number(highInput.value);
    if (low > high) {
      if (changed === 'low') high = low;
      else low = high;
    }
    editEntry(entry => {
      const inherit = selectedId ? (overrides.groupStyles?.[sectionId] || {}) : {};
      const to = low === 0 ? (inherit.to ? 'all' : '') : APPEARANCE_SCALE_OPTIONS[low].id;
      const from = high === 6 ? (inherit.from ? 'all' : '') : APPEARANCE_SCALE_OPTIONS[high].id;
      for (const [key, value] of [['to', to], ['from', from]]) {
        const parentValue = selectedId ? inherit[key] || '' : '';
        if (!value || value === parentValue) delete entry[key];
        else entry[key] = value;
      }
    });
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
    if (active) tabs.querySelector('[data-style-section]')?.focus();
    else { closeHatchPicker(); closeHeightPicker(); }
  };

  listen(tabs, 'click', event => {
    const tab = event.target.closest('[data-style-section]');
    if (!tab) return;
    sectionId = tab.dataset.styleSection;
    selectedId = null;
    activeHeightBand = null; editingHeightCut = null;
    closeHatchPicker(); closeHeightPicker();
    render();
  });
  listen(parentButton, 'click', () => {
    selectedId = null; activeHeightBand = null; editingHeightCut = null;
    closeHatchPicker(); closeHeightPicker(); render();
  });
  listen(groups, 'click', event => {
    const button = event.target.closest('[data-style-group]');
    if (!button) return;
    selectedId = button.dataset.styleGroup;
    activeHeightBand = null; editingHeightCut = null;
    closeHatchPicker(); closeHeightPicker();
    render();
  });
  listen(inheritButton, 'click', () => {
    if (!selectedId || !loaded) return;
    if (isHeightClass()) {
      const entry = currentEntry();
      let next = overrides.heightBands;
      for (const field of Object.keys(entry))
        next = editHeightBand(next, selectedId, activeHeightBand, field, null);
      overrides.heightBands = next;
    } else delete overrides[selectedId];
    saveChanges(selectedId);
  });
  listen(host, 'click', event => {
    const button = event.target.closest('[data-inherit-field]');
    if (!button || !selectedId || !loaded) return;
    editEntry(entry => {
      const field = button.dataset.inheritField;
      if (field === 'scale') { delete entry.from; delete entry.to; }
      else delete entry[field];
    });
  });
  listen(heightOpen, 'click', () => {
    if (!HEIGHT_TARGETS[selectedId]) return;
    const open = heightPicker.hidden;
    closeHatchPicker();
    heightPicker.hidden = !open;
    heightOpen.setAttribute('aria-expanded', String(open));
    if (open) renderHeightPicker();
  });
  listen(get('[data-height-close]'), 'click', closeHeightPicker);
  listen(heightSlider, 'input', () => {
    if (!HEIGHT_TARGETS[selectedId]) return;
    heightDraft[selectedId] = Number(heightSlider.value);
    heightValue.textContent = heightDraft[selectedId] + ' m';
  });
  listen(heightAdd, 'click', () => {
    if (!HEIGHT_TARGETS[selectedId] || !loaded) return;
    const bands = overrides.heightBands || {};
    const before = JSON.stringify(bands);
    const value = heightDraft[selectedId];
    const next = editingHeightCut === null
      ? addHeightCut(bands, selectedId, value)
      : moveHeightCut(bands, selectedId, editingHeightCut, value);
    if (JSON.stringify(next) === before) {
      setStatus('Deze grens bestaat al of valt buiten een bestaande klasse');
      return;
    }
    overrides.heightBands = next;
    editingHeightCut = null; activeHeightBand = null;
    saveChanges(selectedId);
  });
  listen(heightCuts, 'click', event => {
    const remove = event.target.closest('[data-height-remove]');
    const edit = event.target.closest('[data-height-cut]');
    if (!selectedId) return;
    if (remove) {
      overrides.heightBands = removeHeightCut(overrides.heightBands, selectedId,
        Number(remove.dataset.heightRemove));
      if (!Object.keys(overrides.heightBands).length) delete overrides.heightBands;
      editingHeightCut = null; activeHeightBand = null;
      saveChanges(selectedId);
    } else if (edit) {
      editingHeightCut = Number(edit.dataset.heightCut);
      heightDraft[selectedId] = overrides.heightBands[selectedId].cuts[editingHeightCut];
      renderHeightPicker();
    }
  });
  listen(heightBandsList, 'click', event => {
    const button = event.target.closest('[data-height-band]');
    if (!button) return;
    activeHeightBand = button.dataset.heightBand === 'all' ? null :
      Number(button.dataset.heightBand);
    closeHeightPicker(); closeHatchPicker(); render();
  });
  listen(fillInput, 'input', () => update('fill', fillInput.value));
  listen(hatchInput, 'click', () => {
    if (hatchInput.disabled) return;
    hatchPicker.hidden = !hatchPicker.hidden;
    hatchInput.setAttribute('aria-expanded', String(!hatchPicker.hidden));
  });
  listen(hatchPicker, 'click', event => {
    const button = event.target.closest('[data-hatch-choice]');
    if (!button || !loaded) return;
    closeHatchPicker();
    update('hatch', button.dataset.hatchChoice);
  });
  listen(host, 'click', event => {
    if (!hatchPicker.hidden &&
        !event.target.closest('[data-hatch-picker],[data-style-hatch]'))
      closeHatchPicker();
  });
  listen(host, 'keydown', event => {
    if (event.key === 'Escape' && !hatchPicker.hidden) {
      closeHatchPicker();
      hatchInput.focus();
    }
  });
  listen(strokeInput, 'input', () => update('stroke', strokeInput.value));
  listen(widthInput, 'input', () => update('width', Number(widthInput.value)));
  for (const button of dashButtons) listen(button, 'click', () => {
    const firstLine = APPEARANCE_GROUPS.find(group =>
      group.lines?.length && section().items.includes(group.id));
    const defaultDash = appearanceDefaultLineStyle(selectedId ? child() : firstLine);
    update('dash', button.dataset.styleDash === defaultDash ? 'default' : button.dataset.styleDash);
  });
  listen(lowInput, 'input', () => adjustScale('low'));
  listen(highInput, 'input', () => adjustScale('high'));
  listen(resetOne, 'click', () => {
    if (!loaded) return;
    if (isHeightClass()) {
      let next = overrides.heightBands;
      for (const field of Object.keys(currentEntry()))
        next = editHeightBand(next, selectedId, activeHeightBand, field, null);
      overrides.heightBands = next;
    } else if (selectedId) delete overrides[selectedId];
    else if (overrides.groupStyles) {
      delete overrides.groupStyles[sectionId];
      if (!Object.keys(overrides.groupStyles).length) delete overrides.groupStyles;
    }
    saveChanges(selectedId || 'group:' + sectionId);
  });
  listen(resetAll, 'click', () => {
    if (!loaded) return;
    overrides = {};
    activeHeightBand = null; editingHeightCut = null;
    closeHeightPicker(); saveChanges();
  });
  listen(returnButton, 'click', () => setStyleMode(false));

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
