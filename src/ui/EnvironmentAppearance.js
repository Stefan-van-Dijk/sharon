import { environmentStyle } from './EnvironmentStyle.js?v=0.1.74';
import { ENVIRONMENT_SCALES, environmentScaleForSpan, environmentSpanForZoom }
  from './EnvironmentScale.js?v=0.1.74';

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
  { id: 'buildings', label: 'Gebouwen', fill: 'building', lines: ['building-outline'] },
  { id: 'green', label: 'Groen', fill: 'green' },
  { id: 'forest', label: 'Bos', fill: 'forest' }
]);

export const APPEARANCE_SECTIONS = Object.freeze([
  { id: 'basis', label: 'Basis', items: ['land', 'borders'] },
  { id: 'water', label: 'Water', items: ['water', 'waterways'] },
  { id: 'roads', label: 'Wegen', items: ['minor', 'major', 'motorway', 'paths'] },
  { id: 'transport', label: 'Transport', items: ['rail', 'runways', 'taxiways', 'piers'] },
  { id: 'buildings', label: 'Gebouwen', items: ['buildings'] },
  { id: 'green', label: 'Groen', items: ['green', 'forest'] }
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
    from: '',
    to: ''
  };
}
// A group edits only properties which exist on at least one of its members.
export function appearanceSectionProperties(section) {
  const children = section.items.map(id => groupsById.get(id));
  return {
    fill: children.some(group => group.fill || group.background),
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
    width: 1, dash: 'default', from: '', to: ''
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
    const entry = data[group.id] ||
      ((group.id === 'runways' || group.id === 'taxiways') ? data.airfields : null);
    const caps = {
      fill: !!(group.fill || group.background),
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
  return [...(group.fill ? [group.fill] : []), ...(group.lines || [])];
}
export function applyEnvironmentAppearance(map, appearance, category = null) {
  const clean = sanitizeEnvironmentAppearance(appearance);
  for (const group of APPEARANCE_GROUPS) {
    if (!affectedByCategory(group, category)) continue;
    const section = appearanceSectionFor(group.id);
    const override = { ...(clean.groupStyles?.[section.id] || {}), ...(clean[group.id] || {}) };
    if (group.background && map.getLayer(group.background)) {
      const base = layers.get(group.background);
      map.setPaintProperty(group.background, 'background-color',
        override.fill ?? base.paint['background-color']);
    }
    if (group.fill && map.getLayer(group.fill)) {
      const base = layers.get(group.fill);
      map.setPaintProperty(group.fill, 'fill-color',
        override.fill ?? base.paint['fill-color']);
    }
    for (const id of group.lines || []) {
      if (!map.getLayer(id)) continue;
      const base = layers.get(id);
      map.setPaintProperty(id, 'line-color', override.stroke ?? base.paint['line-color']);
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
    const value = visible ? 'visible' : 'none';
    for (const id of groupLayerIds(group)) {
      if (!map.getLayer(id)) continue;
      if ((map.getLayoutProperty(id, 'visibility') || 'visible') !== value) {
        map.setLayoutProperty(id, 'visibility', value);
      }
    }
  }
}
// Attach only after the map's load event. An asynchronous IndexedDB load can
// never overwrite an edit made in the active editor session.
export function bindEnvironmentAppearance(map, store) {
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
