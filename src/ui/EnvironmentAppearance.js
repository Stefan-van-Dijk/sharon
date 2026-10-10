import { environmentStyle } from './EnvironmentStyle.js?v=0.1.65';
import { ENVIRONMENT_SCALES, environmentScaleForSpan, environmentSpanForZoom }
  from './EnvironmentScale.js?v=0.1.65';

export const ENVIRONMENT_APPEARANCE_KEY = 'environment-appearance:v1';
export const APPEARANCE_GROUPS = Object.freeze([
  { id: 'water', label: 'Water', fill: 'water', lines: ['water-outline'] },
  { id: 'buildings', label: 'Gebouwen', fill: 'building', lines: ['building-outline'] },
  { id: 'waterways', label: 'Waterlopen', lines: ['waterway'] },
  { id: 'minor', label: 'Lokale wegen', lines: ['highway_minor'] },
  { id: 'major', label: 'Hoofdwegen', lines: ['highway_major_inner', 'highway_major_subtle'] },
  { id: 'motorway', label: 'Snelwegen', lines: ['highway_motorway_inner', 'highway_motorway_subtle',
    'highway_motorway_bridge_inner', 'tunnel_motorway_inner'] },
  { id: 'paths', label: 'Paden', lines: ['highway_path'] },
  { id: 'rail', label: 'Spoor', lines: ['railway', 'railway_service', 'railway_transit'] },
  { id: 'borders', label: 'Grenzen', lines: ['boundary_2', 'boundary_3', 'boundary_disputed'] },
  { id: 'airfields', label: 'Start- en taxibanen', lines: ['aeroway-runway', 'aeroway-taxiway'] },
  { id: 'piers', label: 'Pieren', lines: ['road_pier'] }
]);

// The seven scale levels are ordered from near (index 0) to country (index 6).
// "Vanaf" is the furthest-out level; "t/m" is the closest-in level.
export const APPEARANCE_SCALE_OPTIONS = Object.freeze([...ENVIRONMENT_SCALES].reverse()
  .map(({ id, label }) => ({ id, label })));
const scaleIndex = id => ENVIRONMENT_SCALES.findIndex(scale => scale.id === id);
const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
const DASHES = {
  solid: [1, 0],
  dotted: [0.5, 2],
  dashed: [3, 2]
};
const FIELDS = new Set(['fill', 'stroke', 'width', 'dash', 'from', 'to']);
const validColor = color => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
const validWidth = value => typeof value === 'number' && Number.isFinite(value) &&
  value >= 0.25 && value <= 4;
const validDash = value => ['default', 'solid', 'dotted', 'dashed'].includes(value);

export function appearanceDefaults(group) {
  const fillLayer = group.fill ? layers.get(group.fill) : null;
  const lineLayer = layers.get(group.lines[0]);
  return {
    fill: fillLayer?.paint?.['fill-color'] || null,
    stroke: lineLayer?.paint?.['line-color'] || '#999999',
    width: 1,
    dash: 'default',
    from: '',
    to: ''
  };
}

// Preserve saved colors from 0.1.64. Invalid scale boundaries are ignored;
// no arbitrary layers, paint expressions, or other untrusted data are accepted.
export function sanitizeEnvironmentAppearance(data) {
  const result = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return result;
  for (const group of APPEARANCE_GROUPS) {
    const entry = data[group.id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const clean = {};
    for (const [name, value] of Object.entries(entry)) {
      if (!FIELDS.has(name)) continue;
      if (name === 'fill' && group.fill && validColor(value)) clean.fill = value.toLowerCase();
      if (name === 'stroke' && validColor(value)) clean.stroke = value.toLowerCase();
      if (name === 'width' && validWidth(value)) clean.width = value;
      if (name === 'dash' && validDash(value) && value !== 'default') clean.dash = value;
      if ((name === 'from' || name === 'to') && typeof value === 'string' &&
          scaleIndex(value) >= 0) clean[name] = value;
    }
    if (clean.from && clean.to && scaleIndex(clean.from) < scaleIndex(clean.to)) {
      delete clean.to;
    }
    if (Object.keys(clean).length) result[group.id] = clean;
  }
  return result;
}

function widthPaint(original, multiplier) {
  if (multiplier === 1) return original;
  if (typeof original === 'number') return Math.round(original * multiplier * 1000) / 1000;
  return ['*', original, multiplier];
}

// Preserve MapLibre's original min/max zoom when no visibility override exists.
// Explicit scale ranges may reveal details earlier than their built-in minzoom.
export function applyEnvironmentAppearance(map, appearance, category = null) {
  const clean = sanitizeEnvironmentAppearance(appearance);
  for (const group of APPEARANCE_GROUPS) {
    if (category && category !== group.id) continue;
    const override = clean[group.id] || {};
    const ids = [...(group.fill ? [group.fill] : []), ...group.lines];
    const fill = group.fill && layers.get(group.fill);
    if (fill && map.getLayer(group.fill)) {
      map.setPaintProperty(group.fill, 'fill-color', override.fill ?? fill.paint['fill-color']);
    }
    for (const id of group.lines) {
      if (!map.getLayer(id)) continue;
      const base = layers.get(id);
      map.setPaintProperty(id, 'line-color', override.stroke ?? base.paint['line-color']);
      map.setPaintProperty(id, 'line-width',
        widthPaint(base.paint['line-width'] ?? 1, override.width ?? 1));
      map.setPaintProperty(id, 'line-dasharray', override.dash ?
        [...DASHES[override.dash]] : (base.paint['line-dasharray'] || [1, 0]));
    }
    if (typeof map.setLayerZoomRange === 'function') {
      for (const id of ids) {
        if (!map.getLayer(id)) continue;
        const base = layers.get(id);
        map.setLayerZoomRange(id,
          override.from || override.to ? 0 : (base.minzoom ?? 0),
          override.from || override.to ? 24 : (base.maxzoom ?? 24));
      }
    }
  }
  applyEnvironmentVisibility(map, clean);
}

// Called on zoom changes, but changes layout only when crossing a scale
// boundary, avoiding repeated MapLibre style rebuilds during pinch gestures.
export function applyEnvironmentVisibility(map, appearance) {
  if (typeof map.getZoom !== 'function' ||
      typeof map.getCenter !== 'function' ||
      typeof map.getLayoutProperty !== 'function') return;
  const span = environmentSpanForZoom(map.getZoom(), map.getCenter().lat, map.getContainer());
  const current = scaleIndex(environmentScaleForSpan(span).id);
  const clean = sanitizeEnvironmentAppearance(appearance);
  for (const group of APPEARANCE_GROUPS) {
    const override = clean[group.id] || {};
    const visible = (!override.from || current <= scaleIndex(override.from)) &&
      (!override.to || current >= scaleIndex(override.to));
    const value = visible ? 'visible' : 'none';
    for (const id of [...(group.fill ? [group.fill] : []), ...group.lines]) {
      if (!map.getLayer(id)) continue;
      if ((map.getLayoutProperty(id, 'visibility') || 'visible') !== value) {
        map.setLayoutProperty(id, 'visibility', value);
      }
    }
  }
}

// Attach only when the MapLibre 'load' event has completed. Closing the map
// invalidates any late settings result before it can touch a removed renderer.
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
