import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.3.66';

export function locationConclusion(name, point, current, radiusM = 100, now = Date.now()) {
  const label = String(name ?? '').trim();
  if (!label) return 'Waar is deze plek?';
  const prefix = 'Je bekijkt ' + label + '.';
  if (!point || !current || !Number.isFinite(Number(current.at)) ||
      now - Number(current.at) < 0 || now - Number(current.at) > 10 * 60_000) return prefix;
  const lat = Number(current.lat), lng = Number(current.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return prefix;
  const metres = distanceBetween(point, { lat, lng });
  if (!Number.isFinite(metres)) return prefix;
  const accuracy = Math.max(0, Number(current.accuracy) || 0);
  const radius = Math.max(20, Number(radiusM) || 100);
  if (metres + accuracy <= radius) return 'Je bent nu bij ' + label + '.';
  if (metres <= radius + accuracy) return 'Je bent in de buurt van ' + label + '.';
  const distance = metres < 1000
    ? Math.max(10, Math.round(metres / 10) * 10) + ' m'
    : (metres / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' km';
  return 'Je bent ongeveer ' + distance + ' van ' + label + '.';
}

// Animation is cancellable so switching between locations never leaks timers.
export function typeLocationConclusion(element, sentence, { reducedMotion = false, speed = 25 } = {}) {
  if (!element) return () => {};
  let stopped = false;
  let handle = null;
  const value = String(sentence || '');
  if (reducedMotion || !value) {
    element.textContent = value;
    return () => {};
  }
  element.textContent = '';
  element.classList?.add?.('is-typing');
  let index = 0;
  function writeNext() {
    if (stopped || !element.isConnected) return;
    index += 1;
    element.textContent = value.slice(0, index);
    if (index < value.length) {
      const char = value[index - 1];
      const delay = /[.,:]/.test(char) ? 100 : char === ' ' ? 12 : speed;
      handle = setTimeout(writeNext, delay);
    } else {
      element.classList?.remove?.('is-typing');
    }
  }
  writeNext();
  return () => {
    stopped = true;
    if (handle !== null) clearTimeout(handle);
    element.classList?.remove?.('is-typing');
  };
}
