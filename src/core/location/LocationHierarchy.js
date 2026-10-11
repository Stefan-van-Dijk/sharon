// Existing identifiers (home/work/business/private/other) remain stable.
// Practical destinations appear first; less frequently used types are further
// along the horizontally scrolling category strip.
export const LOCATION_TYPES = Object.freeze([
  ['work', 'Werk'],
  ['customer', 'Klant'],
  ['parking', 'Parkeren'],
  ['fuel', 'Tankstation'],
  ['supermarket', 'Supermarkt'],
  ['shop', 'Winkel'],
  ['restaurant', 'Restaurant'],
  ['hospitality', 'Horeca'],
  ['family', 'Familie'],
  ['sport', 'Sport'],
  ['school', 'School'],
  ['healthcare', 'Zorg'],
  ['hotel', 'Overnachten'],
  ['construction', 'Bouwplaats'],
  ['public', 'Openbaar'],
  ['home', 'Thuis'],
  ['business', 'Zakelijk'],
  ['private', 'Privé'],
  ['other', 'Overig']
]);

export function ownCoordinates(item) {
  const raw = item?.data?.coordinates;
  if (!raw || raw.lat === '' || raw.lng === '' || raw.lat == null || raw.lng == null) return null;
  const lat = Number(raw.lat), lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, accuracy: Number(raw.accuracy) || 0 };
}

export function addressText(value) {
  if (typeof value === 'string') return value.trim();
  if (!value) return '';
  if (String(value.text || '').trim()) return String(value.text).trim();
  return [[value.street, value.number].filter(Boolean).join(' '), [value.postcode, value.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function parentIdOf(item) {
  return String(item?.data?.parentId || item?.parentId || '');
}

export function locationMap(locations) {
  return new Map(locations.filter(item => !item.deletedAt).map(item => [String(item.id), item]));
}

export function resolveLocation(item, lookup, visited = new Set()) {
  if (!item || visited.has(String(item.id))) return { coordinates: null, address: '', coordinateSourceId: null, addressSourceId: null };
  const next = new Set(visited);
  next.add(String(item.id));
  const parent = lookup.get(parentIdOf(item));
  const inherited = parent ? resolveLocation(parent, lookup, next) : {
    coordinates: null, address: '', coordinateSourceId: null, addressSourceId: null
  };
  const coordinates = ownCoordinates(item);
  const address = addressText(item.data?.address);
  return {
    coordinates: coordinates || inherited.coordinates,
    address: address || inherited.address,
    coordinateSourceId: coordinates ? item.id : inherited.coordinateSourceId,
    addressSourceId: address ? item.id : inherited.addressSourceId
  };
}

export function isDescendant(candidateParentId, currentId, lookup) {
  let cursor = String(candidateParentId || '');
  const visited = new Set();
  while (cursor) {
    if (cursor === String(currentId)) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parentIdOf(lookup.get(cursor));
  }
  return false;
}

export function pathForLocation(item, lookup) {
  const names = [];
  const visited = new Set();
  let current = item;
  while (current && !visited.has(String(current.id))) {
    visited.add(String(current.id));
    names.unshift(current.data?.title || 'Locatie');
    current = lookup.get(parentIdOf(current));
  }
  return names.join(' › ');
}

export function orderedLocations(items, mode = 'alpha', order = []) {
  const byId = locationMap(items);
  const children = new Map();
  for (const item of items.filter(item => !item.deletedAt)) {
    const id = parentIdOf(item);
    const parent = id && id !== item.id && byId.has(id) ? id : '';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(item);
  }
  const rank = new Map(order.map((id, index) => [String(id), index]));
  const sorter = (a, b) => {
    if (mode === 'custom') return (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
      || String(a.data?.title || '').localeCompare(String(b.data?.title || ''), 'nl');
    if (mode === 'recent') return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)
      || String(a.data?.title || '').localeCompare(String(b.data?.title || ''), 'nl');
    return String(a.data?.title || '').localeCompare(String(b.data?.title || ''), 'nl', { sensitivity: 'base' });
  };
  const result = [], seen = new Set();
  const walk = (parent, depth) => {
    for (const item of (children.get(parent) || []).sort(sorter)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push({ item, depth });
      walk(item.id, depth + 1);
    }
  };
  walk('', 0);
  // Legacy/corrupt cycles must never hide locations or recurse forever.
  for (const item of items.filter(item => !item.deletedAt)) {
    if (!seen.has(item.id)) {
      result.push({ item, depth: 0 });
      seen.add(item.id);
      walk(item.id, 1);
    }
  }
  return result;
}
