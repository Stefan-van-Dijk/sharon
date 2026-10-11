import { environmentStyle } from './EnvironmentStyle.js?v=0.1.81';
import { registerEnvironmentHatches, environmentHatchImageId, HATCH_OPTIONS, applyEnvironmentLandHatch, applyEnvironmentColoredHatch, DEFAULT_HATCH_COLOR } from './EnvironmentHatch.js?v=0.1.81';
import { sanitizeHeightBands, buildBuildingBandExpression, buildLandReliefExpression } from './EnvironmentHeight.js?v=0.1.81';
import { ENVIRONMENT_SCALES, environmentScaleForSpan, environmentSpanForZoom }
  from './EnvironmentScale.js?v=0.1.81';

// Keep v1: all individual customizations made in previous Sharon versions survive.
export const ENVIRONMENT_APPEARANCE_KEY = 'environment-appearance:v1';

export const APPEARANCE_GROUPS = Object.freeze([
  { id: 'land', label: 'Land', background: 'background' },
  { id: 'borders', label: 'Grenzen', lines: ['boundary_2', 'boundary_3', 'boundary_disputed'] },
  { id: 'water', label: 'Water', fill: 'water', lines: ['water-outline'] },
  { id: 'waterways', label: 'Waterlopen', lines: ['waterway'] },
  { id: 'minor', label: 'Lokale wegen', lines: ['highway_minor'] },
  { id: 'major', label: 'Hoofdwegen', lines: ['highway_major_inner', 'highway_major_subtle'] },
  { id: 'motorway', label: 'Snelwegen', lines: [
    'highway_motorway_inner', 'highway_motorway_subtle',
    'highway_motorway_bridge_inner', 'tunnel_motorway_inner'
  ] },
  { id: 'paths', label: 'Paden', lines: ['highway_path'] },
  { id: 'rail', label: 'Spoor', lines: ['railway', 'railway_service', 'railway_transit'] },
  { id: 'runways', label: 'Startbanen', lines: ['aeroway-runway'] },
  { id: 'taxiways', label: 'Taxibanen', lines: ['aeroway-taxiway'] },
  { id: 'piers', label: 'Pieren', lines: ['road_pier'] },
  { id: 'bridges', label: 'Bruggen', lines: ['structure_bridge'] },
  { id: 'tunnels', label: 'Tunnels', lines: ['structure_tunnel'] },
  { id: 'fords', label: 'Doorwaadbaar', lines: ['structure_ford'] },
  { id: 'dams', label: 'Dammen', fill: 'structure_dam', lines: ['structure_dam-outline'] },
  { id: 'buildings', label: 'Gebouwen', fill: 'building', lines: ['building-outline'] },
  { id: 'green', label: 'Groen', fill: 'green', lines: ['green-outline'] },
  { id: 'forest', label: 'Bos', fill: 'forest', lines: ['forest-outline'] },
  { id: 'grassland', label: 'Grasland', fill: 'grassland', lines: ['grassland-outline'] },
  { id: 'heath', label: 'Heide', fill: 'heath', lines: ['heath-outline'] },
  { id: 'scrub', label: 'Struikgewas', fill: 'scrub', lines: ['scrub-outline'] },
  { id: 'meadow', label: 'Weiland', fill: 'meadow', lines: ['meadow-outline'] },
  { id: 'tundra', label: 'Toendra', fill: 'tundra', lines: ['tundra-outline'] },
  { id: 'beach', label: 'Strand', fill: 'beach', lines: ['beach-outline'] },
  { id: 'dunes', label: 'Duinen', fill: 'dunes', lines: ['dunes-outline'] },
  { id: 'sand', label: 'Zandvlaktes', fill: 'sand', lines: ['sand-outline'] },
  { id: 'wetland', label: 'Nat grasland', fill: 'wetland', lines: ['wetland-outline'] },
  { id: 'bog', label: 'Veen', fill: 'bog', lines: ['bog-outline'] },
  { id: 'marsh', label: 'Moeras', fill: 'marsh', lines: ['marsh-outline'] },
  { id: 'reedbed', label: 'Rietland', fill: 'reedbed', lines: ['reedbed-outline'] },
  { id: 'tidalflat', label: 'Slikken', fill: 'tidalflat', lines: ['tidalflat-outline'] },
  { id: 'mangrove', label: 'Mangrove', fill: 'mangrove', lines: ['mangrove-outline'] },
  { id: 'farmland', label: 'Akkerland', fill: 'farmland', lines: ['farmland-outline'] },
  { id: 'orchard', label: 'Boomgaarden', fill: 'orchard', lines: ['orchard-outline'] },
  { id: 'vineyard', label: 'Wijngaarden', fill: 'vineyard', lines: ['vineyard-outline'] },
  { id: 'allotments', label: 'Volkstuinen', fill: 'allotments', lines: ['allotments-outline'] },
  { id: 'nursery', label: 'Kwekerijen', fill: 'nursery', lines: ['nursery-outline'] },
  { id: 'rock', label: 'Rotsen', fill: 'rock', lines: ['rock-outline'] },
  { id: 'scree', label: 'Puinhellingen', fill: 'scree', lines: ['scree-outline'] },
  { id: 'glacier', label: 'Gletsjers', fill: 'glacier', lines: ['glacier-outline'] }
]);

export const APPEARANCE_SECTIONS = Object.freeze([
  { id: 'basis', label: 'Basis', items: ['land', 'borders', 'buildings'] },
  { id: 'water', label: 'Water', items: ['water', 'waterways'] },
  { id: 'roads', label: 'Wegen', items: ['minor', 'major', 'motorway', 'paths'] },
  { id: 'transport', label: 'Transport', items: ['rail', 'runways', 'taxiways'] },
  { id: 'structures', label: 'Objecten', items: [
    'bridges', 'tunnels', 'piers', 'dams', 'fords'
  ] },
  { id: 'green', label: 'Groen', items: ['green', 'forest', 'grassland', 'heath', 'scrub', 'meadow', 'tundra'] },
  { id: 'coast', label: 'Zand & kust', items: ['beach', 'dunes', 'sand'] },
  { id: 'wetlands', label: 'Natte natuur', items: ['wetland', 'bog', 'marsh', 'reedbed', 'tidalflat', 'mangrove'] },
  { id: 'farming', label: 'Landbouw', items: ['farmland', 'orchard', 'vineyard', 'allotments', 'nursery'] },
  { id: 'stone', label: 'Rots & ijs', items: ['rock', 'scree', 'glacier'] }
]);

export const APPEARANCE_SCALE_OPTIONS = Object.freeze(ENVIRONMENT_SCALES
  .map(({ id, label }) => ({ id, label })));
const scaleIndex = id => ENVIRONMENT_SCALES.findIndex(scale => scale.id === id);
const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
const groupsById = new Map(APPEARANCE_GROUPS.map(group => [group.id, group]));
const sectionsById = new Map(APPEARANCE_SECTIONS.map(section => [section.id, section]));
const DASHES = { solid: [1, 0], dotted: [0.5, 2], dashed: [3, 2] };
const validColor = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const validWidth = value => typeof value === 'number' && Number.isFinite(value) &&
  value >= 0.25 && value <= 4;
const validDash = value => ['solid', 'dotted', 'dashed'].includes(value);
const validHatch = value => HATCH_OPTIONS.some(option => option.id === value);

export function appearanceSectionFor(groupId) {
  return APPEARANCE_SECTIONS.find(section => section.items.includes(groupId)) || null;
}
export function appearanceDefaultLineStyle(group) {
  if (!group.lines?.length) return 'solid';
  const pattern = layers.get(group.lines[0])?.paint?.['line-dasharray'];
  if (Array.isArray(pattern) && typeof pattern[0] === 'number' && typeof pattern[1] === 'number') {
    if (pattern[0] <= 1 && pattern[1] >= 1.5) return 'dotted';
    if (pattern[1] > 0) return 'dashed';
  }
  return 'solid';
}
export function appearanceDefaults(group) {
  const fillLayer = layers.get(group.fill || group.background);
  const lineLayer = group.lines?.length ? layers.get(group.lines[0]) : null;
  return {
    fill: group.background ? fillLayer?.paint?.['background-color'] :
      fillLayer?.paint?.['fill-color'] || null,
    stroke: lineLayer?.paint?.['line-color'] || null,
    width: 1,
    dash: 'default',
    hatch: 'none',
    hatchColor: DEFAULT_HATCH_COLOR,
    from: '',
    to: ''
  };
}
// A group edits only properties which exist on at least one of its members.
export function appearanceSectionProperties(section) {
  const children = section.items.map(id => groupsById.get(id));
  return {
    fill: children.some(group => group.fill || group.background),
    hatch: children.some(group => !!(group.fill || group.background)),
    hatchColor: children.some(group => !!(group.fill || group.background)),
    stroke: children.some(group => group.lines?.length),
    scale: children.some(group => !group.background),
    width: children.some(group => group.lines?.length),
    dash: children.some(group => group.lines?.length)
  };
}
export function appearanceSectionDefaults(section) {
  const children = section.items.map(id => groupsById.get(id));
  const fillGroup = children.find(group => group.fill || group.background);
  const lineGroup = children.find(group => group.lines?.length);
  return {
    fill: fillGroup ? appearanceDefaults(fillGroup).fill : null,
    stroke: lineGroup ? appearanceDefaults(lineGroup).stroke : null,
    width: 1, dash: 'default', hatch: 'none', hatchColor: DEFAULT_HATCH_COLOR, from: '', to: ''
  };
}

function sanitizeEntry(entry, caps) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {};
  const clean = {};
  for (const [name, value] of Object.entries(entry)) {
    if (name === 'fill' && caps.fill && validColor(value)) clean.fill = value.toLowerCase();
    if (name === 'stroke' && caps.stroke && validColor(value)) clean.stroke = value.toLowerCase();
    if (name === 'width' && caps.width && validWidth(value)) clean.width = value;
    if (name === 'dash' && caps.dash && validDash(value)) clean.dash = value;
    if (name === 'hatch' && caps.hatch && validHatch(value)) clean.hatch = value;
    if (name === 'hatchColor' && caps.hatchColor && validColor(value)) clean.hatchColor = value.toLowerCase();
    if ((name === 'from' || name === 'to') && caps.scale &&
        typeof value === 'string' && (scaleIndex(value) >= 0 || value === 'all')) clean[name] = value;
  }
  if (clean.from && clean.to && clean.from !== 'all' && clean.to !== 'all' &&
      scaleIndex(clean.from) < scaleIndex(clean.to)) delete clean.to;
  return clean;
}
// Legacy airfields customization applies to both new separate child categories.
// Individual values override the group's values on a property-by-property basis.
export function sanitizeEnvironmentAppearance(data) {
  const result = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return result;
  for (const group of APPEARANCE_GROUPS) {
    // Legacy "Gebouwen" main-group style becomes the child's own style when
    // buildings move to Basis, so old colors/width/hatch preferences survive.
    const entry = group.id === 'buildings'
      ? {
          ...(data.groupStyles?.buildings || {}),
          ...(data.buildings || {})
        }
      : data[group.id] ||
        ((group.id === 'runways' || group.id === 'taxiways') ? data.airfields : null);
    const caps = {
      fill: !!(group.fill || group.background),
      hatch: !!(group.fill || group.background),
      hatchColor: !!(group.fill || group.background),
      stroke: !!group.lines?.length,
      width: !!group.lines?.length,
      dash: !!group.lines?.length,
      scale: !group.background
    };
    const clean = sanitizeEntry(entry, caps);
    if (Object.keys(clean).length) result[group.id] = clean;
  }
  const sectionStyles = {};
  for (const section of APPEARANCE_SECTIONS) {
    const clean = sanitizeEntry(data.groupStyles?.[section.id],
      appearanceSectionProperties(section));
    if (Object.keys(clean).length) sectionStyles[section.id] = clean;
  }
  if (Object.keys(sectionStyles).length) result.groupStyles = sectionStyles;
  const heightBands = sanitizeHeightBands(data.heightBands);
  if (Object.keys(heightBands).length) result.heightBands = heightBands;
  return result;
}
// The native/default values differ between individual layers. Never replace a
// child's native values with another child's defaults: inherit only explicit
// group overrides, then explicit child overrides.
export function resolvedEnvironmentAppearance(data, groupId) {
  const group = groupsById.get(groupId);
  if (!group) return null;
  const clean = sanitizeEnvironmentAppearance(data);
  const section = appearanceSectionFor(groupId);
  return {
    ...appearanceDefaults(group),
    ...(clean.groupStyles?.[section?.id] || {}),
    ...(clean[groupId] || {})
  };
}
function widthPaint(original, multiplier) {
  if (multiplier === 1) return original;
  if (typeof original === 'number') return Math.round(original * multiplier * 1000) / 1000;
  return ['*', original, multiplier];
}
function affectedByCategory(group, category) {
  return !category || category === group.id ||
    (category.startsWith('group:') && sectionsById.get(category.slice(6))?.items.includes(group.id));
}
function groupLayerIds(group) {
  return [...(group.fill ? [group.fill, group.fill + '-hatch'] : []), ...(group.lines || [])];
}
const RELIEF_SOURCE = 'sharon-height-dem';
const RELIEF_LAYER = 'sharon-height-relief';
function syncLandHeightRelief(map, clean) {
  if (typeof map.getSource !== 'function' || typeof map.getLayer !== 'function') return;
  const bands = clean.heightBands?.land;
  if (!bands?.cuts?.length) {
    if (map.getLayer(RELIEF_LAYER) && map.removeLayer) map.removeLayer(RELIEF_LAYER);
    if (map.getSource(RELIEF_SOURCE) && map.removeSource) map.removeSource(RELIEF_SOURCE);
    return;
  }
  if (!map.addSource || !map.addLayer || !map.setPaintProperty) return;
  if (!map.getSource(RELIEF_SOURCE)) map.addSource(RELIEF_SOURCE, {
    type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json',
    tileSize: 512, encoding: 'terrarium',
    attribution: '<a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener">© Mapterhorn</a>'
  });
  const base = resolvedEnvironmentAppearance(clean, 'land')?.fill || '#ffffff';
  const expression = buildLandReliefExpression(bands, base, style => style.fill || base);
  if (!map.getLayer(RELIEF_LAYER)) {
    // Under vector water/roads/landcover: altitude colors the land surface only.
    map.addLayer({
      id: RELIEF_LAYER, type: 'color-relief', source: RELIEF_SOURCE,
      paint: { 'color-relief-color': expression }
    }, map.getLayer('forest') ? 'forest' : 'water');
  } else map.setPaintProperty(RELIEF_LAYER, 'color-relief-color', expression);
}
export function applyEnvironmentAppearance(map, appearance, category = null) {
  const clean = sanitizeEnvironmentAppearance(appearance);
  for (const group of APPEARANCE_GROUPS) {
    if (!affectedByCategory(group, category)) continue;
    const section = appearanceSectionFor(group.id);
    const override = { ...(clean.groupStyles?.[section.id] || {}), ...(clean[group.id] || {}) };
    const bands = group.id === 'buildings' ? clean.heightBands?.buildings : null;
    const bandValue = (style, field, base) => style[field] ?? base;
    const expression = (field, base) => bands?.cuts.length
      ? buildBuildingBandExpression(bands, field, base,
        style => bandValue(style, field, base)) : base;
    if (group.background && map.getLayer(group.background)) {
      const base = layers.get(group.background);
      const color = override.fill ?? base.paint['background-color'];
      map.setPaintProperty(group.background, 'background-color', color);
      // The background image must include the user's color: MapLibre
      // disables background-color as soon as background-pattern is used.
      applyEnvironmentLandHatch(map, color, override.hatch || 'none', override.hatchColor || DEFAULT_HATCH_COLOR);
    }
    if (group.fill && map.getLayer(group.fill)) {
      const base = layers.get(group.fill);
      map.setPaintProperty(group.fill, 'fill-color',
        expression('fill', override.fill ?? base.paint['fill-color']));
    }
    // Independent transparent overlay: fill-color stays fully editable.
    const hatchId = group.fill ? group.fill + '-hatch' : null;
    if (hatchId && map.getLayer(hatchId) && typeof map.setPaintProperty === 'function') {
      const baseHatch = override.hatch || 'none';
      const baseColor = override.hatchColor || DEFAULT_HATCH_COLOR;
      const basePattern = applyEnvironmentColoredHatch(map, group.id, baseHatch, baseColor);
      if (bands?.cuts.length) {
        const expression = buildBuildingBandExpression(
          bands, 'hatch', ['image', basePattern], (style, index) =>
            ['image', applyEnvironmentColoredHatch(
              map, group.id, style.hatch ?? baseHatch,
              style.hatchColor ?? baseColor, index
            )]
        );
        map.setPaintProperty(hatchId, 'fill-pattern', expression);
      } else if (baseHatch !== 'none') {
        map.setPaintProperty(hatchId, 'fill-pattern', basePattern);
      }
    }
    for (const id of group.lines || []) {
      if (!map.getLayer(id)) continue;
      const base = layers.get(id);
      map.setPaintProperty(id, 'line-color',
        expression('stroke', override.stroke ?? base.paint['line-color']));
      map.setPaintProperty(id, 'line-width',
        widthPaint(base.paint['line-width'] ?? 1, override.width ?? 1));
      map.setPaintProperty(id, 'line-dasharray', override.dash ?
        [...DASHES[override.dash]] : (base.paint['line-dasharray'] || [1, 0]));
    }
    if (typeof map.setLayerZoomRange === 'function') {
      for (const id of groupLayerIds(group)) {
        if (!map.getLayer(id)) continue;
        const base = layers.get(id);
        map.setLayerZoomRange(id,
          (override.from && override.from !== 'all') || (override.to && override.to !== 'all') ? 0 : (base.minzoom ?? 0),
          (override.from && override.from !== 'all') || (override.to && override.to !== 'all') ? 24 : (base.maxzoom ?? 24));
      }
    }
  }
  syncLandHeightRelief(map, clean);
  applyEnvironmentVisibility(map, clean);
}
export function applyEnvironmentVisibility(map, appearance) {
  if (typeof map.getZoom !== 'function' ||
    typeof map.getCenter !== 'function' ||
    typeof map.getLayoutProperty !== 'function') return;
  const span = environmentSpanForZoom(map.getZoom(), map.getCenter().lat, map.getContainer());
  const current = scaleIndex(environmentScaleForSpan(span).id);
  const clean = sanitizeEnvironmentAppearance(appearance);
  for (const group of APPEARANCE_GROUPS) {
    if (group.background) continue; // The land background always fills the canvas.
    const section = appearanceSectionFor(group.id);
    const override = { ...(clean.groupStyles?.[section.id] || {}), ...(clean[group.id] || {}) };
    const visible = (!override.from || override.from === 'all' || current <= scaleIndex(override.from)) &&
      (!override.to || override.to === 'all' || current >= scaleIndex(override.to));
    for (const id of groupLayerIds(group)) {
      if (!map.getLayer(id)) continue;
      const isHatch = group.fill && id === group.fill + '-hatch';
      const heightBand = group.id === 'buildings' ? clean.heightBands?.buildings : null;
      const hasHeightHatch = heightBand?.styles.some(style =>
        (style.hatch ?? override.hatch ?? 'none') !== 'none');
      const allowed = !isHatch || (!!override.hatch && override.hatch !== 'none') || !!hasHeightHatch;
      const value = visible && allowed ? 'visible' : 'none';
      const defaultVisibility = layers.get(id)?.layout?.visibility || 'visible';
      if ((map.getLayoutProperty(id, 'visibility') || defaultVisibility) !== value) {
        map.setLayoutProperty(id, 'visibility', value);
      }
    }
  }
}
// Attach only after the map's load event. An asynchronous IndexedDB load can
// never overwrite an edit made in the active editor session.
export function bindEnvironmentAppearance(map, store) {
  registerEnvironmentHatches(map);
  let disposed = false, changedInSession = false;
  let appearance = {}, lastScaleId = null;
  const currentScale = () => environmentScaleForSpan(environmentSpanForZoom(
    map.getZoom(), map.getCenter().lat, map.getContainer())).id;
  const update = () => {
    if (disposed) return;
    const scale = currentScale();
    if (scale === lastScaleId) return;
    lastScaleId = scale;
    applyEnvironmentVisibility(map, appearance);
  };
  map.on('zoom', update);
  map.on('moveend', update);
  const setAppearance = (next, category = null) => {
    if (disposed) return;
    changedInSession = true;
    appearance = sanitizeEnvironmentAppearance(next);
    applyEnvironmentAppearance(map, appearance, category);
    lastScaleId = currentScale();
  };
  store.get('meta', ENVIRONMENT_APPEARANCE_KEY).then(saved => {
    if (disposed || changedInSession) return;
    appearance = sanitizeEnvironmentAppearance(saved?.value);
    applyEnvironmentAppearance(map, appearance);
    lastScaleId = currentScale();
  }).catch(error => {
    if (!disposed) console.warn('Sharon kaartstijl: lokaal laden mislukt', error);
  });
  const dispose = () => {
    disposed = true;
    map.off('zoom', update);
    map.off('moveend', update);
  };
  dispose.setAppearance = setAppearance;
  return dispose;
}
