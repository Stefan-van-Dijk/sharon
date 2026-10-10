import { environmentStyle } from './EnvironmentStyle.js?v=0.1.64';

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

const layers = new Map(environmentStyle.layers.map(layer => [layer.id, layer]));
const DASHES = {
  solid: [1, 0],
  dotted: [0.5, 2],
  dashed: [3, 2]
};
const FIELDS = new Set(['fill', 'stroke', 'width', 'dash']);
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
    dash: 'default'
  };
}

// Validate persisted state; reject arbitrary layer names, property names and
// MapLibre expression objects from storage. Overrides never change raw tiles.
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

export function applyEnvironmentAppearance(map, appearance, category = null) {
  const clean = sanitizeEnvironmentAppearance(appearance);
  for (const group of APPEARANCE_GROUPS) {
    if (category && category !== group.id) continue;
    const override = clean[group.id] || {};
    const fill = group.fill && layers.get(group.fill);
    if (fill && map.getLayer(group.fill)) {
      map.setPaintProperty(group.fill, 'fill-color',
        override.fill ?? fill.paint['fill-color']);
    }
    for (const id of group.lines) {
      if (!map.getLayer(id)) continue;
      const base = layers.get(id);
      map.setPaintProperty(id, 'line-color',
        override.stroke ?? base.paint['line-color']);
      map.setPaintProperty(id, 'line-width',
        widthPaint(base.paint['line-width'] ?? 1, override.width ?? 1));
      map.setPaintProperty(id, 'line-dasharray',
        override.dash ? [...DASHES[override.dash]] :
          (base.paint['line-dasharray'] || [1, 0]));
    }
  }
}
