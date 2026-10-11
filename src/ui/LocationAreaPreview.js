import { environmentStyle } from './EnvironmentStyle.js?v=0.1.96';

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';
const MAPLIBRE_WORKER = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs';
export const AREA_RADIUS_PX = 72;

const radiusMeters = value => Math.max(20, Math.min(2000, Number(value) || 100));
const validPoint = raw => {
  if (raw?.lat == null || raw?.lng == null || raw.lat === '' || raw.lng === '') return null;
  const lat = Number(raw.lat), lng = Number(raw.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng } : null;
};

// GPS error is expressed in metres, not as a fraction of the chosen radius.
// Therefore an error of 20 m appears much narrower on a 1000 m area than on 50 m.
export function uncertaintyMeters(accuracy) {
  const number = Number(accuracy);
  return Math.max(10, Math.min(150, Number.isFinite(number) && number > 0 ? number : 15));
}
export function metersPerPixel(latitude, zoom) {
  const lat = Math.max(-85, Math.min(85, Number(latitude) || 0));
  return Math.cos(lat * Math.PI / 180) * 40075016.686 / (512 * 2 ** zoom);
}
export function fadedRadiusPixels(radius, accuracy, latitude, zoom) {
  const meters = radiusMeters(radius);
  const uncertainty = uncertaintyMeters(accuracy);
  const resolution = metersPerPixel(latitude, zoom);
  return { core: meters / resolution, outer: (meters + uncertainty) / resolution, uncertainty };
}
export function zoomForArea(radius, latitude, screenRadius = AREA_RADIUS_PX) {
  const target = Math.max(30, Number(screenRadius) || AREA_RADIUS_PX);
  const metres = radiusMeters(radius);
  const worldWidth = Math.cos(Math.max(-85, Math.min(85, Number(latitude) || 0)) * Math.PI / 180) * 40075016.686;
  return Math.max(9, Math.min(22, Math.log2(worldWidth * target / (512 * metres))));
}
export function fadeStartPercent(radius, accuracy) {
  const percentage = 100 * (1 - uncertaintyMeters(accuracy) / radiusMeters(radius));
  return Math.max(20, Math.min(94, percentage));
}

// Non-interactive preview of a radius on Sharon's shared vector basemap.
// No separate geolocation watches, map tiles or GPS checks are initiated.
export function mountLocationArea(host, {
  getPoint, getRadius, getAccuracy = () => 0,
  loadRenderer = () => import(MAPLIBRE_JS)
} = {}) {
  let map = null;
  let alive = true;
  let loading = false;
  let ready = false;
  host.innerHTML = '<div class="sh-radius-map" data-map aria-label="Kaart van de herkenningszone"></div>' +
    '<div class="sh-radius-overlay" data-area-overlay aria-hidden="true"><span class="sh-radius-fade"></span><span class="sh-radius-center"></span></div>' +
    '<div class="sh-radius-map-placeholder" data-map-placeholder role="status">Kaart voorbereiden…</div>' +
    '<small class="sh-radius-map-note" data-map-note></small>';
  const element = host.querySelector('[data-map]');
  const overlay = host.querySelector('[data-area-overlay]');
  const ring = host.querySelector('.sh-radius-fade');
  const placeholder = host.querySelector('[data-map-placeholder]');
  const note = host.querySelector('[data-map-note]');

  function refresh() {
    const position = validPoint(getPoint?.());
    overlay.hidden = !position;
    if (!position) {
      placeholder.hidden = false;
      placeholder.textContent = 'Kies een GPS-positie of zoek GPS bij het adres.';
      note.textContent = '';
      return;
    }
    // Screen geometry stays fixed, while the basemap zoom changes.
    ring.style.width = AREA_RADIUS_PX * 2 + 'px';
    ring.style.height = AREA_RADIUS_PX * 2 + 'px';
    const start = fadeStartPercent(getRadius?.(), getAccuracy?.());
    ring.style.setProperty('--sh-area-fade-start', start + '%');
    ring.style.setProperty('--sh-area-fade-middle', (start + 100) / 2 + '%');
    const accuracy = Number(getAccuracy?.()) || 0;
    note.textContent = accuracy > 0
      ? 'Herkenningsafstand ' + radiusMeters(getRadius?.()) + ' m · GPS ±' + Math.round(accuracy) + ' m'
      : 'Herkenningsafstand ' + radiusMeters(getRadius?.()) + ' m · zachte grens';
    placeholder.hidden = ready;
  }

  async function update() {
    if (!alive) return;
    const position = validPoint(getPoint?.());
    refresh();
    if (!position) return;
    if (map) {
      map.jumpTo({
        center: [position.lng, position.lat],
        zoom: zoomForArea(getRadius?.(), position.lat)
      });
      refresh();
      return;
    }
    if (loading) return;
    loading = true;
    placeholder.hidden = false;
    placeholder.textContent = 'Kaart laden…';
    try {
      if (!document.querySelector('link[data-sh-location-map-css]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = MAPLIBRE_CSS;
        css.dataset.shLocationMapCss = '';
        document.head.append(css);
      }
      const lib = await loadRenderer();
      if (!alive || !element.isConnected) return;
      if (typeof lib?.Map !== 'function') throw new Error('Kaartbibliotheek ontbreekt.');
      // Same explicit module worker used in Omgeving. Required for MapLibre 6 ESM.
      lib.setWorkerUrl?.(MAPLIBRE_WORKER);
      lib.setWorkerCount?.(1);
      const center = validPoint(getPoint?.()) || position;
      map = new lib.Map({
        container: element,
        style: environmentStyle,
        center: [center.lng, center.lat],
        zoom: zoomForArea(getRadius?.(), center.lat),
        interactive: false,
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
        maxPitch: 0,
        fadeDuration: 0
      });
      map.on('load', () => {
        if (!alive) return;
        ready = true;
        map.resize();
        refresh();
      });
      map.on('zoom', refresh);
      map.on('error', () => {
        if (!alive || ready) return;
        placeholder.hidden = false;
        placeholder.textContent = 'Kaart tijdelijk niet beschikbaar. Controleer je verbinding.';
      });
      refresh();
    } catch {
      if (alive) {
        placeholder.hidden = false;
        placeholder.textContent = 'Kaart tijdelijk niet beschikbaar. Wijzig de afstand om opnieuw te proberen.';
      }
    } finally {
      loading = false;
    }
  }

  function dispose() {
    alive = false;
    if (map) {
      map.remove();
      map = null;
    }
    host.replaceChildren();
  }
  refresh();
  return { update, refresh, dispose };
}
