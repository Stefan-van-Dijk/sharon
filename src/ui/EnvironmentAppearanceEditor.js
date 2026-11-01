import {
  APPEARANCE_GROUPS, APPEARANCE_SECTIONS, APPEARANCE_SCALE_OPTIONS, ENVIRONMENT_APPEARANCE_KEY,
  appearanceDefaults, appearanceDefaultLineStyle, appearanceSectionDefaults,
  appearanceSectionProperties, resolvedEnvironmentAppearance, sanitizeEnvironmentAppearance
} from './EnvironmentAppearance.js?v=0.4.52';
import {
  HEIGHT_TARGETS, MAX_HEIGHT_CUTS, addHeightCut, moveHeightCut,
  removeHeightCut, editHeightBand, heightBandLabel
} from './EnvironmentHeight.js?v=0.4.52';
import { HATCH_OPTIONS, environmentHatchPreview } from './EnvironmentHatch.js?v=0.4.52';
import {
  ENVIRONMENT_SCENARIOS_KEY, STYLE_SCENARIOS,
  createEnvironmentScenarioDeck, saveEnvironmentScenario, changeEnvironmentScenario,
  isStandardScenario, parseEnvironmentStyle, serializeEnvironmentStyle, MAX_STYLE_FILE_BYTES
} from './EnvironmentScenarios.js?v=0.4.52';

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
    '<section id="environment-style-editor" class="environment-style-flyout" data-map-style-settings aria-label="Kaartstijl aanpassen" hidden></section>');
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
        '<div class="environment-style-color-row" data-style-hatch-color-row>',
          '<span>Arceerkleur</span>',
          '<label class="environment-color-edit">',
            '<span class="environment-color-swatch" data-hatch-color-swatch>',
              '<input data-style-hatch-color type="color" aria-label="Arceerkleur kiezen"/>',
            '</span>',
            '<output data-style-hatch-color-hex></output>',
          '</label>',
          '<button type="button" data-inherit-field="hatchColor" aria-label="Arceerkleur van groep overnemen" disabled>↶</button>',
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
  if (floating) host.insertAdjacentHTML('afterbegin',
    '<button type="button" class="environment-style-dismiss-handle" data-style-dismiss aria-label="Kaartstijleditor sluiten" title="Sleep omlaag om te sluiten"><span aria-hidden="true"></span></button>');

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
  const hatchColorRow = get('[data-style-hatch-color-row]');
  const hatchColorInput = get('[data-style-hatch-color]');
  const hatchColorHex = get('[data-style-hatch-color-hex]');
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
  const exportButton = floating ? root.querySelector('[data-style-export]') : null;
  const importButton = floating ? root.querySelector('[data-style-import]') : null;
  const importFile = floating ? root.querySelector('[data-style-import-file]') : null;
  const status = floating ? root.querySelector('[data-style-status]') : get('[data-style-status]');
  const returnButton = floating ? root.querySelector('[data-style-return]') : null;
  const readout = floating ? root.querySelector('[data-map-readout]') : null;
  const track = floating ? root.querySelector('[data-readout-track]') : null;
  const positionSide = floating ? root.querySelector('[data-readout-position]') : null;
  const styleSide = floating ? root.querySelector('[data-readout-style]') : null;
  const desktopStyleToggle = floating ? root.querySelector('[data-desktop-style-toggle]') : null;
  const dismissHandle = floating ? get('[data-style-dismiss]') : null;
  const scenarioBar = floating ? root.querySelector('[data-style-scenarios]') : null;
  const scenarioLabel = floating ? root.querySelector('[data-style-scenario-label]') : null;
  const scenarioPrev = floating ? root.querySelector('[data-style-scenario-prev]') : null;
  const scenarioNext = floating ? root.querySelector('[data-style-scenario-next]') : null;

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
  let scenarioDeck = null;
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
  const renderScenario = () => {
    if (!scenarioLabel || !scenarioDeck) return;
    const {active} = scenarioDeck;
    scenarioLabel.textContent = STYLE_SCENARIOS[active].label +
      ' · ' + (active + 1) + '/' + STYLE_SCENARIOS.length;
  };
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
    hatchColor: selectedId === 'buildings',
    stroke: selectedId === 'buildings', width: false, dash: false, scale: false
  } : selectedId ? {
    fill: !!(child().fill || child().background),
    hatch: !!(child().fill || child().background),
    hatchColor: !!(child().fill || child().background),
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

  const hatchOverlay = (group, hatch, color, suffix = '') => {
    if (!hatch || hatch === 'none') return '';
    // Use the exact same texture pixels in the preview as on the MapLibre map.
    return environmentHatchPreview(hatch, 'part-' + group.id + suffix, color).replace(
      '<svg viewBox="0 0 64 30"',
      '<svg x="12" y="3" width="48" height="19" viewBox="0 0 64 30"'
    );
  };
  // No miniature maps: one fill patch or a single line, with current effective style.
  const preview = (group, bandIndex = null) => {
    const base = resolvedEnvironmentAppearance(overrides, group.id) || appearanceDefaults(group);
    const v = bandIndex === null ? base : {
      ...base, ...(overrides.heightBands?.[group.id]?.styles?.[bandIndex] || {})
    };
    if (group.fill || group.background) {
      return '<svg viewBox="0 0 72 25" aria-hidden="true">' +
        '<rect x="12" y="3" width="48" height="19" fill="' + v.fill +
        '" stroke="' + (v.stroke || '#b9b9bf') + '" stroke-width="1.3"/>' +
        hatchOverlay(group, v.hatch, v.hatchColor, bandIndex === null ? '' : '-h' + bandIndex) + '</svg>';
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
  // The real height classes appear directly after Land/Buildings in the same
  // horizontal rail. No additional row, tabs, detached popover or dummy cells.
  const subgroupEntries = () => section().items.flatMap(id => {
    const result = [{ groupId: id, bandIndex: null, key: id }];
    const cuts = overrides.heightBands?.[id]?.cuts || [];
    for (let i = 0; i <= cuts.length; i++) {
      if (cuts.length) result.push({ groupId: id, bandIndex: i, key: id + ':height:' + i });
    }
    return result;
  });
  const renderGrid = () => {
    const entries = subgroupEntries();
    const signature = sectionId + '/' + section().items.map(id =>
      id + ':' + (overrides.heightBands?.[id]?.cuts || []).join(',')).join('|');
    if (shownSectionId !== signature) {
      const sameSection = shownSectionId?.startsWith(sectionId + '/');
      const scrollBefore = sameSection ? groups.scrollLeft : 0;
      const fragment = document.createDocumentFragment();
      for (const entry of entries) {
        const group = APPEARANCE_GROUPS.find(item => item.id === entry.groupId);
        const wrapper = document.createElement('div');
        wrapper.className = 'environment-style-group';
        wrapper.dataset.groupCard = entry.key;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'environment-style-group-main';
        const label = document.createElement('span');
        if (entry.bandIndex === null) {
          button.dataset.styleGroup = entry.groupId;
          button.setAttribute('aria-label', group.label);
          label.textContent = group.label;
        } else {
          wrapper.classList.add('is-height-band');
          button.dataset.heightParent = entry.groupId;
          button.dataset.heightIndex = String(entry.bandIndex);
          const range = heightBandLabel(overrides.heightBands, entry.groupId, entry.bandIndex);
          button.setAttribute('aria-label', group.label + ', hoogte ' + range);
          label.textContent = range;
        }
        const sample = document.createElement('svg');
        const deviation = document.createElement('i');
        deviation.className = 'environment-style-deviation';
        deviation.setAttribute('aria-hidden', 'true');
        button.append(sample, label, deviation);
        wrapper.append(button);
        fragment.append(wrapper);
      }
      groups.replaceChildren(fragment);
      groups.scrollLeft = scrollBefore;
      shownSectionId = signature;
    }
    for (const entry of entries) {
      const wrapper = [...groups.children].find(node => node.dataset.groupCard === entry.key);
      const isSelected = selectedId === entry.groupId && activeHeightBand === entry.bandIndex;
      const style = entry.bandIndex === null
        ? overrides[entry.groupId]
        : overrides.heightBands?.[entry.groupId]?.styles?.[entry.bandIndex];
      wrapper.classList.toggle('is-selected', isSelected);
      wrapper.classList.toggle('has-deviation', !!style && Object.keys(style).length > 0);
      const button = wrapper.querySelector('button');
      button.setAttribute('aria-pressed', String(isSelected));
      button.querySelector('svg').outerHTML = preview(
        APPEARANCE_GROUPS.find(item => item.id === entry.groupId), entry.bandIndex);
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
    // A pigment has no meaning while the current hatch is "Geen".
    // Keep the saved hatchColor intact so it comes back with the next motif.
    const hasHatch = caps.hatch && values.hatch && values.hatch !== 'none';
    const showHatchColor = !!caps.hatchColor && !!hasHatch;
    hatchColorRow.hidden = !showHatchColor;
    strokeRow.hidden = !caps.stroke;
    strokeLabel.textContent = selectedId && child()?.fill ? 'Rand' :
      !selectedId && section().items.some(id =>
        APPEARANCE_GROUPS.find(group => group.id === id)?.fill) ? 'Rand/lijn' : 'Lijn';
    const colorCount = Number(caps.fill) + Number(caps.hatch) +
      Number(showHatchColor) + Number(caps.stroke);
    const colorGrid = get('.environment-style-colors');
    colorGrid.style.gridTemplateColumns =
      'repeat(' + Math.max(1, colorCount) + ', minmax(0,1fr))';
    colorGrid.classList.toggle('is-four-col', colorCount === 4);
    fillInput.disabled = !caps.fill;
    hatchInput.disabled = !caps.hatch;
    hatchColorInput.disabled = !showHatchColor;
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
      hatchPreview.innerHTML = environmentHatchPreview(active, 'current', values.hatchColor);
      const label = HATCH_OPTIONS.find(option => option.id === active)?.label || 'Geen';
      hatchInput.setAttribute('aria-label', 'Arcering kiezen: ' + label);
      for (const button of hatchPicker.querySelectorAll('[data-hatch-choice]')) {
        button.setAttribute('aria-pressed', String(button.dataset.hatchChoice === active));
        if (!hatchPicker.hidden) button.querySelector('.environment-hatch-sample').innerHTML =
          environmentHatchPreview(button.dataset.hatchChoice,
            'choice-' + button.dataset.hatchChoice, values.hatchColor);
      }
    } else closeHatchPicker();
    if (caps.hatchColor) {
      const hatchColor = values.hatchColor || '#3e4549';
      get('[data-hatch-color-swatch]').style.setProperty('--style-color', hatchColor);
      hatchColorHex.textContent = hatchColor.toUpperCase();
      if (hatchColorInput !== document.activeElement) hatchColorInput.value = hatchColor;
    }
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
    // Standaard is always the original renderer appearance, not an editable
    // slot. All other scenarios remain separately editable.
    if (scenarioDeck && isStandardScenario(scenarioDeck)) {
      host.classList.add('is-standard-scenario');
      for (const button of host.querySelectorAll('input,button')) {
        if (button === dismissHandle ||
            button.matches('[data-style-section],[data-style-parent],[data-style-group]'))
          continue;
        button.disabled = true;
      }
    } else host.classList.remove('is-standard-scenario');
  };
  const persistNow = () => {
    const saves = [store.put('meta', {key:ENVIRONMENT_APPEARANCE_KEY,value:overrides})];
    if (scenarioDeck) saves.push(store.put('meta', {
      key:ENVIRONMENT_SCENARIOS_KEY,value:scenarioDeck
    }));
    Promise.all(saves).catch(() => setStatus('Opslaan mislukt'));
  };
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (!disposed) persistNow();
    },250);
  };
  const saveChanges = category => {
    // Standaard is an immutable reference style. When someone edits it,
    // continue in Eigen instead of silently discarding the adjustment.
    if (isStandardScenario(scenarioDeck)) {
      scenarioDeck = { ...scenarioDeck, active: 0 };
    }
    overrides = sanitizeEnvironmentAppearance(overrides);
    if (scenarioDeck) scenarioDeck = saveEnvironmentScenario(scenarioDeck,overrides);
    notify(category);
    render();
    renderScenario();
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
      for (const field of ['fill', 'stroke', 'hatch', 'hatchColor']) {
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
  const selectScenario = direction => {
    if (!loaded || !scenarioDeck) return;
    scenarioDeck = saveEnvironmentScenario(scenarioDeck,overrides);
    scenarioDeck = changeEnvironmentScenario(scenarioDeck,direction);
    overrides = {...scenarioDeck.slots[scenarioDeck.active]};
    for (const control of host.querySelectorAll('input,button')) control.disabled = false;
    activeHeightBand = null; editingHeightCut = null;
    closeHatchPicker(); closeHeightPicker();
    notify(); render(); renderScenario();
    setStatus('Stijl '+STYLE_SCENARIOS[scenarioDeck.active].label+' · lokaal opgeslagen');
    persist();
  };
  const setStyleMode = active => {
    if (!floating || disposed) return;
    readout.classList.toggle('is-style-active', active);
    host.hidden = !active;
    host.style.translate = '';
    desktopStyleToggle?.setAttribute('aria-pressed', String(active));
    desktopStyleToggle?.setAttribute('aria-expanded', String(active));
    desktopStyleToggle?.setAttribute('aria-label', active ?
      'Kaartstijl sluiten' : 'Kaartstijl aanpassen');
    if (desktopStyleToggle) desktopStyleToggle.title = active ?
      'Kaartstijl sluiten' : 'Kaartstijl aanpassen';
    styleSide.setAttribute('aria-hidden', String(!active));
    positionSide.setAttribute('aria-hidden', String(active));
    returnButton.tabIndex = active ? 0 : -1;
    if (exportButton) exportButton.tabIndex = active ? 0 : -1;
    if (importButton) importButton.tabIndex = active ? 0 : -1;
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
    const band = event.target.closest('[data-height-parent][data-height-index]');
    const group = event.target.closest('[data-style-group]');
    if (!band && !group) return;
    selectedId = band?.dataset.heightParent || group.dataset.styleGroup;
    activeHeightBand = band ? Number(band.dataset.heightIndex) : null;
    editingHeightCut = null;
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
  listen(hatchColorInput, 'input', () => update('hatchColor', hatchColorInput.value));
  listen(hatchInput, 'click', () => {
    if (hatchInput.disabled) return;
    hatchPicker.hidden = !hatchPicker.hidden;
    if (!hatchPicker.hidden) {
      const color = currentStyle().hatchColor || '#3e4549';
      for (const button of hatchPicker.querySelectorAll('[data-hatch-choice]'))
        button.querySelector('.environment-hatch-sample').innerHTML =
          environmentHatchPreview(button.dataset.hatchChoice,
            'choice-' + button.dataset.hatchChoice, color);
    }
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
  // Exports contain only whitelisted map appearance values, never positions,
  // objects, identifiers, notes or app settings.
  listen(exportButton,'click',()=>{
    if(!loaded||!scenarioDeck)return;
    try{
      const selected=STYLE_SCENARIOS[scenarioDeck.active];
      const json=serializeEnvironmentStyle(selected.id,overrides);
      const blob=new Blob([json],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download='sharon-kaartstijl-'+selected.id+'.json';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      setStatus('Stijl '+selected.label+' geëxporteerd');
    }catch(error){
      setStatus('Exporteren mislukt');
      window.alert?.('Kon de stijl niet exporteren: '+error.message);
    }
  });
  listen(importButton,'click',()=>{
    if(!loaded||!scenarioDeck)return;
    if(isStandardScenario(scenarioDeck)){
      window.alert?.('Standaard blijft ongewijzigd. Kies eerst een bewerkbaar scenario.');
      return;
    }
    importFile?.click();
  });
  listen(importFile,'change',async()=>{
    const file=importFile?.files?.[0];
    if(importFile)importFile.value='';
    if(!file||disposed)return;
    try{
      if(file.size>MAX_STYLE_FILE_BYTES)throw new Error('Bestand is te groot');
      const incoming=parseEnvironmentStyle(await file.text());
      if(disposed||!loaded||!scenarioDeck)return;
      overrides=incoming;
      scenarioDeck=saveEnvironmentScenario(scenarioDeck,overrides);
      activeHeightBand=null;editingHeightCut=null;
      closeHatchPicker();closeHeightPicker();
      notify();render();renderScenario();persist();
      setStatus('Kaartstijl geïmporteerd · lokaal opgeslagen');
    }catch(error){
      setStatus('Importeren mislukt');
      window.alert?.('Kon de kaartstijl niet importeren: '+error.message);
    }
  });
  listen(returnButton, 'click', () => setStyleMode(false));
  listen(scenarioPrev, 'click', () => selectScenario(-1));
  listen(scenarioNext, 'click', () => selectScenario(1));
  // Swipe only the scenario name, never the restore buttons or map.
  let scenarioTouch = null;
  listen(scenarioBar, 'touchstart', event => {
    if (event.touches.length !== 1 || event.target.closest('button')) return;
    scenarioTouch={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  listen(scenarioBar, 'touchend', event => {
    if (!scenarioTouch) return;
    const touch=event.changedTouches?.[0];
    const dx=(touch?.clientX ?? scenarioTouch.x)-scenarioTouch.x;
    const dy=(touch?.clientY ?? scenarioTouch.y)-scenarioTouch.y;
    scenarioTouch=null;
    if (Math.abs(dx)>=42 && Math.abs(dx)>Math.abs(dy)*1.5)
      selectScenario(dx<0?1:-1);
  },{passive:true});
  listen(scenarioBar, 'touchcancel', () => {scenarioTouch=null;},{passive:true});

  // The grab handle dismisses the floating panel and does not capture any
  // touches on color inputs, lines, height sliders or the map.
  let dismissTouch=null;
  listen(dismissHandle,'click',()=>setStyleMode(false));
  listen(dismissHandle,'touchstart',event=>{
    if(event.touches.length!==1)return;
    dismissTouch={x:event.touches[0].clientX,y:event.touches[0].clientY,dy:0};
  },{passive:true});
  listen(dismissHandle,'touchmove',event=>{
    if(!dismissTouch||event.touches.length!==1)return;
    const dx=event.touches[0].clientX-dismissTouch.x;
    const dy=event.touches[0].clientY-dismissTouch.y;
    if(dy< -12 || Math.abs(dx)>Math.max(16,dy)){
      dismissTouch=null;host.style.translate='';return;
    }
    dismissTouch.dy=Math.max(0,dy);
    if(dy>6 && event.cancelable)event.preventDefault();
    host.style.translate='0px '+Math.min(160,dismissTouch.dy)+'px';
  },{passive:false});
  listen(dismissHandle,'touchend',event=>{
    if(!dismissTouch){host.style.translate='';return;}
    const end=event.changedTouches?.[0]?.clientY??dismissTouch.y;
    const dy=Math.max(dismissTouch.dy,end-dismissTouch.y);
    dismissTouch=null;host.style.translate='';
    if(dy>=65)setStyleMode(false);
  },{passive:true});
  listen(dismissHandle,'touchcancel',()=>{
    dismissTouch=null;host.style.translate='';
  },{passive:true});
  // The desktop dot is an alternative entry point; the swipe on the position
  // bar remains unchanged for phone users.
  listen(desktopStyleToggle, 'click', () => {
    setStyleMode(host.hidden);
  });
  listen(host, 'keydown', event => {
    if (event.key === 'Escape' && !host.hidden &&
        hatchPicker.hidden && heightPicker.hidden) {
      setStyleMode(false);
      desktopStyleToggle?.focus();
    }
  });

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
  const allControls = [...host.querySelectorAll('input,button'), exportButton, importButton,
    scenarioPrev, scenarioNext].filter(Boolean);
  for (const control of allControls) control.disabled = true;
  if (floating) setStyleMode(false);
  Promise.all([
    store.get('meta',ENVIRONMENT_APPEARANCE_KEY),
    store.get('meta',ENVIRONMENT_SCENARIOS_KEY).catch(()=>null)
  ]).then(([saved,scenarios])=>{
    if(disposed)return;
    overrides=sanitizeEnvironmentAppearance(saved?.value);
    scenarioDeck=createEnvironmentScenarioDeck(overrides,scenarios?.value);
    overrides={...scenarioDeck.slots[scenarioDeck.active]};
    loaded=true;
    for(const control of allControls)control.disabled=false;
    render();renderScenario();notify();
  }).catch(()=>{
    if(disposed)return;
    scenarioDeck=createEnvironmentScenarioDeck({});
    loaded=true;
    for(const control of allControls)control.disabled=false;
    render();renderScenario();notify();
    setStatus('Kon lokale instellingen niet laden');
  });

  const dispose = () => {
    if (disposed) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      persistNow();
    }
    disposed = true;
    for (const [node, name, callback, options] of listeners)
      node.removeEventListener(name, callback, options);
    if (floating) host.remove();
  };
  dispose.apply = () => { if (loaded && !disposed) notify(); };
  return dispose;
}
