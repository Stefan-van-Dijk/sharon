// Converts opt-in local Sharon objects to map-only geometry.
// No private object payloads, notes, tracks or sharing secrets leave IndexedDB.
const GEO_TYPES = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);
const MAX_VERTICES_PER_OBJECT = 10000;

function coordinatePair(input) {
  if (!Array.isArray(input) || input.length < 2 ||
      input[0] == null || input[1] == null || input[0] === '' || input[1] === '') return null;
  const lng = Number(input[0]);
  const lat = Number(input[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) ||
      lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function countAndValidateCoordinates(value, depth, state) {
  if (depth === 0) {
    state.vertices++;
    return state.vertices <= MAX_VERTICES_PER_OBJECT && Boolean(coordinatePair(value));
  }
  return Array.isArray(value) && value.length > 0 &&
    value.every(child => countAndValidateCoordinates(child, depth - 1, state));
}

export function validMapGeometry(geometry) {
  if (!geometry || !GEO_TYPES.has(geometry.type)) return false;
  const depth = {
    Point: 0, MultiPoint: 1, LineString: 1,
    MultiLineString: 2, Polygon: 2, MultiPolygon: 3
  }[geometry.type];
  if (!countAndValidateCoordinates(geometry.coordinates, depth, { vertices: 0 })) return false;
  if (geometry.type === 'LineString' && geometry.coordinates.length < 2) return false;
  if (geometry.type === 'Polygon' && !geometry.coordinates.every(ring => ring.length >= 4)) return false;
  return true;
}

function pointForObject(item) {
  const coord = item.data?.coordinates || item.coordinates;
  if (!coord || coord.lng == null || coord.lat == null ||
      coord.lng === '' || coord.lat === '') return null;
  const pair = coordinatePair([coord.lng, coord.lat]);
  return pair ? { type: 'Point', coordinates: pair } : null;
}

export function environmentFeatureForObject(item) {
  if (!item || item.deletedAt || !item.id) return null;
  const location = item.type === 'location';
  const mapObject = item.data?.environment?.visible === true || item.data?.showOnMap === true;
  if (!location && !mapObject) return null;

  const candidate = item.data?.environment?.geometry ||
    item.data?.geometry || item.data?.geojson?.geometry;
  const geometry = validMapGeometry(candidate) ? candidate :
    location ? pointForObject(item) : null;
  if (!geometry || !validMapGeometry(geometry)) return null;

  const presentation = item.data?.environment || {};
  const color = /^#[0-9a-f]{6}$/i.test(presentation.color) ? presentation.color : '#262629';
  const opacity = typeof presentation.opacity === 'number' && Number.isFinite(presentation.opacity)
    ? Math.max(0, Math.min(1, presentation.opacity)) : 1;
  const title = String(item.data?.title || item.data?.name || (location ? 'Locatie' : 'Object'));
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: String(item.id),
      externalId: String(item.externalId || ''),
      title: title.slice(0, 180),
      kind: String(item.type || 'object').slice(0, 50),
      color, opacity, seen: presentation.seen === true,
      sourceId: String(item.data?.environment?.sourceId || '').slice(0, 160)
    }
  };
}

export function environmentGeoJSON(objects) {
  return {
    type: 'FeatureCollection',
    features: (Array.isArray(objects) ? objects : [])
      .map(environmentFeatureForObject)
      .filter(Boolean)
  };
}
