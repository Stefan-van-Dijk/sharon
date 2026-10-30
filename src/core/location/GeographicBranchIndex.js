import { environmentIdForPoint } from './EnvironmentIdentifier.js?v=0.4.36';

const EARTH_RADIUS_METERS = 6371008.8;
const RAD = Math.PI / 180;

export function distanceMeters(a, b) {
  const lat1 = Number(a?.lat) * RAD, lat2 = Number(b?.lat) * RAD;
  const deltaLat = lat2 - lat1;
  const deltaLng = (Number(b?.lng) - Number(a?.lng)) * RAD;
  if (![lat1, lat2, deltaLng].every(Number.isFinite)) throw new Error('Ongeldige coordinaten');
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Stores multiple branches per six-character geographic cell, independently of personal location IDs.
export function createBranchIndex(branches, length = 6) {
  const cells = new Map();
  for (const branch of branches) {
    const code = environmentIdForPoint(branch, length);
    if (!cells.has(code)) cells.set(code, []);
    cells.get(code).push(branch);
  }
  return { cells, length };
}

// Sample neighbouring cells using geographic offsets; exact distance is always checked afterwards.
export function nearbyBranches(index, position, radiusMeters = 100) {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) throw new Error('Ongeldige straal');
  const latitude = Number(position?.lat), longitude = Number(position?.lng);
  if (![latitude, longitude].every(Number.isFinite)) throw new Error('Ongeldige coordinaten');
  const latStep = 180 / (64 ** (index.length / 2));
  const lngStep = 360 / (64 ** (index.length / 2));
  const latDelta = radiusMeters / 111195;
  const lngDelta = Math.min(180, radiusMeters / Math.max(0.001, 111195 * Math.cos(latitude * RAD)));
  const codes = new Set();
  const south = Math.max(-90, latitude - latDelta), north = Math.min(90, latitude + latDelta);
  const yCount = Math.ceil((north - south) / latStep) + 1;
  const xCount = Math.ceil(2 * lngDelta / lngStep) + 1;
  // A large uncertainty near a pole can span hundreds of thousands of cells.
  // In that case inspect only the occupied cells, never enumerate the globe.
  if ((yCount + 1) * (xCount + 1) > 10000) {
    return [...index.cells.values()].flat().map(branch=>({branch,distanceMeters:distanceMeters(position,branch)}))
      .filter(item=>item.distanceMeters<=radiusMeters).sort((a,b)=>a.distanceMeters-b.distanceMeters);
  }
  for (let y = 0; y <= yCount; y++) {
    const lat = Math.min(north, south + y * latStep);
    for (let x = 0; x <= xCount; x++) {
      const lng = longitude - lngDelta + x * lngStep;
      codes.add(environmentIdForPoint({ lat, lng }, index.length));
    }
  }
  const matches = [];
  for (const code of codes) for (const branch of index.cells.get(code) ?? []) {
    const distance = distanceMeters(position, branch);
    if (distance <= radiusMeters) matches.push({ branch, distanceMeters: distance });
  }
  return matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
