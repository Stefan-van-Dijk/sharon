import { environmentStyle } from './EnvironmentStyle.js?v=0.1.95';

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';

export function metersPerPixel(latitude, zoom) {
  const lat = Math.max(-85, Math.min(85, Number(latitude)));
  return Math.cos(lat * Math.PI / 180) * 40075016.686 / (512 * 2 ** zoom);
}

export function fadedRadiusPixels(radius, accuracy, latitude, zoom) {
  const meters = Math.max(20, Math.min(2000, Number(radius) || 100));
  const uncertainty = Math.max(15, Math.min(200, Number(accuracy) || 0), meters * .18);
  return { core: meters / metersPerPixel(latitude, zoom),
    outer: (meters + uncertainty) / metersPerPixel(latitude, zoom),
    uncertainty };
}

function pointOf(raw) {
  const lat = Number(raw?.lat), lng = Number(raw?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng } : null;
}

/** Non-interactive map preview. The gradient depicts uncertainty, not a geofence boundary.
 * Reuses Sharon's existing basemap style and performs no GPS polling.
 */
export function mountLocationArea(host, { getPoint, getRadius, getAccuracy = () => 0 } = {}) {
  let map = null;
  let alive = true;
  let loading = false;
  let currentZoom = 17;
  let lastPoint = null;
  let overlay = null;
  let accuracyLabel = null;
  host.innerHTML = '<div class="sh-radius-map" data-map aria-label="Kaart met indicatief herkenningsgebied"></div>' +
    '<div class="sh-radius-overlay" aria-hidden="true"><span class="sh-radius-fade"></span><span class="sh-radius-center"></span></div>' +
    '<small class="sh-radius-map-note" data-map-note>De overgang is geleidelijk weergegeven vanwege GPS-onzekerheid.</small>';
  const element = host.querySelector('[data-map]');
  overlay = host.querySelector('.sh-radius-fade');
  accuracyLabel = host.querySelector('[data-map-note]');
  function refreshOverlay() {
    const pos = pointOf(getPoint?.());
    if (!pos) { host.hidden = true; return; }
    host.hidden = false;
    if (!map) return;
    const dims = fadedRadiusPixels(getRadius?.(), getAccuracy?.(), pos.lat, map.getZoom());
    const diameter = Math.min(1200, Math.max(12, dims.outer * 2));
    overlay.style.width = diameter + 'px';
    overlay.style.height = diameter + 'px';
    const accuracy = Math.round(Number(getAccuracy?.()) || 0);
    accuracyLabel.textContent = accuracy > 0
      ? 'Zachte overgang · gemeten GPS-nauwkeurigheid ±' + accuracy + ' m'
      : 'Zachte overgang · positie en herkenning zijn indicatief';
  }
  async function update() {
    if (!alive) return;
    const point = pointOf(getPoint?.());
    if (!point) { host.hidden = true; return; }
    host.hidden = false;
    lastPoint = point;
    if (map) {
      map.jumpTo({ center: [point.lng, point.lat] });
      refreshOverlay();
      return;
    }
    if (loading) return;
    loading = true;
    try {
      if (!document.querySelector('link[data-sh-location-map-css]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet';
        style.href = MAPLIBRE_CSS;
        style.dataset.shLocationMapCss = '';
        document.head.append(style);
      }
      const lib = await import(MAPLIBRE_JS);
      if (!alive || !element.isConnected) return;
      map = new lib.Map({
        container: element, style: environmentStyle,
        center: [point.lng, point.lat], zoom: currentZoom,
        interactive: false, attributionControl: false,
        pitchWithRotate: false, dragRotate: false, maxPitch: 0,
        fadeDuration: 0
      });
      map.on('load', refreshOverlay);
      map.on('zoom', refreshOverlay);
      map.on('error', () => { if (alive) accuracyLabel.textContent = 'Kaart tijdelijk niet beschikbaar · herkenningsstraal blijft instelbaar'; });
      refreshOverlay();
    } catch {
      if (alive) accuracyLabel.textContent = 'Kaart tijdelijk niet beschikbaar · herkenningsstraal blijft instelbaar';
    } finally { loading = false; }
  }
  function dispose() {
    alive = false;
    if (map) { map.remove(); map = null; }
    host.replaceChildren();
  }
  return { update, dispose, refresh: refreshOverlay };
}
