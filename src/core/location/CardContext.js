import { resolveLocation } from './LocationHierarchy.js?v=0.3.71';
import { distanceBetween } from './LocationTriggerService.js?v=0.3.71';

export const CARD_CONTEXT_MAX_AGE_MS = 120_000;

export function hasLeftCardLocation(objects, cardId, point, now = Date.now()) {
  if (!point || point.lat == null || point.lng == null || !Number.isFinite(Number(point.lat)) ||
      !Number.isFinite(Number(point.lng)) || Math.abs(Number(point.lat)) > 90 || Math.abs(Number(point.lng)) > 180 ||
      !Number.isFinite(point.at) || point.at > now || now - point.at >= CARD_CONTEXT_MAX_AGE_MS ||
      !Number.isFinite(Number(point.accuracy)) || Number(point.accuracy) < 0) return false;
  const card = objects.find(item => item.type === 'card' && item.id === cardId);
  const places = new Map(objects.filter(item => item.type === 'location' && !item.deletedAt).map(item => [String(item.id), item]));
  const place = places.get(String(card?.locationId || ''));
  if (!place) return false;
  const coordinates = resolveLocation(place, places).coordinates;
  const radius = Math.min(2000, Math.max(20, Number(place.data?.radiusM) || 100));
  return Boolean(coordinates && distanceBetween(point, coordinates) - Number(point.accuracy) > radius);
}

// Uses only explicit, local card/location links. No name guessing or GPS polling.
export function suggestCards(objects, point, now = Date.now()) {
  if (!point || point.lat == null || point.lng == null ||
      !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng)) ||
      Math.abs(Number(point.lat)) > 90 || Math.abs(Number(point.lng)) > 180 ||
      !Number.isFinite(point.at) || point.at > now || now - point.at >= CARD_CONTEXT_MAX_AGE_MS) return [];
  const accuracy = Number(point.accuracy);
  if (!Number.isFinite(accuracy) || accuracy < 0) return [];
  const active = item => !item.deletedAt && !item.archivedAt && item.status !== 'archived';
  const places = new Map(objects.filter(item => item.type === 'location' && active(item)).map(item => [String(item.id), item]));
  return objects.filter(item => item.type === 'card' && active(item)).flatMap(card => {
    const place = places.get(String(card.locationId || ''));
    if (!place) return [];
    const coordinates = resolveLocation(place, places).coordinates;
    if (!coordinates) return [];
    const radiusM = Math.min(2000, Math.max(20, Number(place.data?.radiusM) || 100));
    const distanceM = distanceBetween(point, coordinates);
    // Uncertain GPS must not claim arrival. The accuracy circle must fit inside.
    // A GPS uncertainty circle overlapping the zone is enough to offer a board.\n    // Do not require the entire accuracy circle to fit inside the geofence.\n    if (distanceM > radiusM + accuracy) return [];
    return [{ card, location: place, distanceM, reason: 'linked-location' }];
  }).sort((a, b) => a.distanceM - b.distanceM || String(a.card.name || '').localeCompare(String(b.card.name || ''), 'nl'));
}
