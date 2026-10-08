import { IDENTIFIER_ALPHABET } from '../ids/IdentifierService.js?v=0.1.42';

const VALID_LENGTHS = new Set([2, 4, 6, 8]);

const SCALE_LENGTHS = Object.freeze({
  near: 6,
  detail: 6,
  street: 6,
  district: 6,
  place: 4,
  region: 4
});

export function environmentIdForPoint(point, length = 8) {
  assertLength(length);

  const lat = clampLatitude(point?.lat);
  const lng = wrapLongitude(point?.lng);

  let west = -180;
  let east = 180;
  let south = -90;
  let north = 90;
  let id = '';

  for (let offset = 0; offset < length; offset += 2) {
    const width = (east - west) / 64;
    const height = (north - south) / 64;

    const x = clampIndex(Math.floor((lng - west) / width));
    const y = clampIndex(Math.floor((lat - south) / height));

    id += IDENTIFIER_ALPHABET[x] + IDENTIFIER_ALPHABET[y];

    const nextWest = west + x * width;
    const nextSouth = south + y * height;

    west = nextWest;
    east = nextWest + width;
    south = nextSouth;
    north = nextSouth + height;
  }

  return id;
}

export function environmentBoundsForId(value) {
  const id = String(value ?? '');
  assertId(id);

  let west = -180;
  let east = 180;
  let south = -90;
  let north = 90;

  for (let offset = 0; offset < id.length; offset += 2) {
    const x = IDENTIFIER_ALPHABET.indexOf(id[offset]);
    const y = IDENTIFIER_ALPHABET.indexOf(id[offset + 1]);

    const width = (east - west) / 64;
    const height = (north - south) / 64;

    const nextWest = west + x * width;
    const nextSouth = south + y * height;

    west = nextWest;
    east = nextWest + width;
    south = nextSouth;
    north = nextSouth + height;
  }

  return {
    id,
    level: id.length / 2,
    west,
    east,
    south,
    north,
    center: {
      lat: (south + north) / 2,
      lng: (west + east) / 2
    }
  };
}

export function environmentParentId(value) {
  const id = String(value ?? '');
  assertId(id);
  return id.length > 2 ? id.slice(0, -2) : '';
}

export function environmentTileId(point, scaleId) {
  const length = SCALE_LENGTHS[String(scaleId)] ?? 6;
  return environmentIdForPoint(point, length);
}

export function environmentPointId(point) {
  return environmentIdForPoint(point, 8);
}

export function environmentIdLengthForScale(scaleId) {
  return SCALE_LENGTHS[String(scaleId)] ?? 6;
}

export function isEnvironmentId(value) {
  const id = String(value ?? '');
  return (
    VALID_LENGTHS.has(id.length) &&
    [...id].every(character => IDENTIFIER_ALPHABET.includes(character))
  );
}

function assertId(id) {
  if (!isEnvironmentId(id)) {
    throw new Error('Gebiedsidentifier moet 2, 4, 6 of 8 geldige tekens bevatten.');
  }
}

function assertLength(length) {
  if (!VALID_LENGTHS.has(Number(length))) {
    throw new Error('Gebiedsidentifier ondersteunt 2, 4, 6 of 8 tekens.');
  }
}

function clampIndex(value) {
  return Math.max(0, Math.min(63, Number(value) || 0));
}

function clampLatitude(value) {
  const latitude = Number(value);
  if (!Number.isFinite(latitude)) {
    throw new Error('Latitude ontbreekt voor gebiedsidentifier.');
  }

  // Keep the north pole inside the final row rather than producing index 64.
  return Math.max(-90, Math.min(90 - Number.EPSILON * 180, latitude));
}

function wrapLongitude(value) {
  const longitude = Number(value);
  if (!Number.isFinite(longitude)) {
    throw new Error('Longitude ontbreekt voor gebiedsidentifier.');
  }

  let wrapped = longitude;
  while (wrapped < -180) wrapped += 360;
  while (wrapped >= 180) wrapped -= 360;
  return wrapped;
}
