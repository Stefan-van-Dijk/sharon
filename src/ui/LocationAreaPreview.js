import { environmentStyle } from './EnvironmentStyle.js?v=0.4.37';
import { MAPLIBRE_JS, loadSharonRenderer, createSharonMap } from './SharonMapRuntime.js?v=0.4.37';
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

// The chosen recognition radius is the real-world distance represented by the
// fixed on-screen circle. Zooming the map changes the radius, not the GPS point.
export function radiusForZoom(zoom, latitude, screenRadius = AREA_RADIUS_PX) {
  const metres = Math.max(1, Number(screenRadius) || AREA_RADIUS_PX) *
    metersPerPixel(latitude, zoom);
  // Match the existing stored form constraint (min 20, max 2000, step 10).
  const rounded = Math.round(metres / 10) * 10;
  return radiusMeters(rounded);
}

// Non-interactive preview of a radius on Sharon's shared vector basemap.
// No separate geolocation watches, map tiles or GPS checks are initiated.
export function mountLocationArea(host, {
  getPoint, getRadius, getUserPoint = () => null, getAccuracy = () => 0, onPointChange = () => {},
  onRadiusChange = () => {},
  loadRenderer = () => import(MAPLIBRE_JS)
} = {}) {
  let map = null;
  let marker = null;
  let userMarker = null;
  let positionEditable = false;
  let alive = true;
  let loading = false;
  let ready = false;
  let tileError = false;
  let resizeObserver = null;
  let pendingUpdate = false;
  host.innerHTML = '<div class="sh-radius-map" data-map aria-label="Kaart van de herkenningszone"></div>' +
    '<div class="sh-radius-overlay" data-area-overlay aria-hidden="true"><span class="sh-radius-fade"></span><span class="sh-radius-center"></span></div>' +
    '<div class="sh-radius-map-placeholder" data-map-placeholder role="status">Kaart voorbereiden…</div>' +
    '<small class="sh-radius-map-note" data-map-note></small>';
  const element = host.querySelector('[data-map]');
  const overlay = host.querySelector('[data-area-overlay]');
  const ring = host.querySelector('.sh-radius-fade');
  const placeholder = host.querySelector('[data-map-placeholder]');
  const note = host.querySelector('[data-map-note]');
  const dimensions = () => {
    if (typeof element.getBoundingClientRect !== 'function') return { width: 300, height: 245 };
    return element.getBoundingClientRect();
  };
  const canRender = () => {
    const { width, height } = dimensions();
    return width >= 16 && height >= 16;
  };
  const resize = () => {
    if (!alive || !canRender()) return;
    if (map) {
      map.resize();
      placeOverlay();
    } else if (pendingUpdate) {
      pendingUpdate = false;
      void update();
    }
  };
  if (typeof ResizeObserver !== 'undefined' && typeof element.getBoundingClientRect === 'function') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
  }

  const placeOverlay = () => {
    const point = validPoint(getPoint?.());
    if (!map || !point || typeof map.project !== 'function') return;
    const xy = map.project([point.lng, point.lat]);
    if (!xy || !Number.isFinite(xy.x) || !Number.isFinite(xy.y)) return;
    overlay.style.left = xy.x + 'px';
    overlay.style.top = xy.y + 'px';
  };
  function updatePoint(next) {
    if (!positionEditable) return;
    const point = validPoint(next);
    if (!point || !alive) return;
    marker?.setLngLat([point.lng, point.lat]);
    onPointChange(point);
    map?.easeTo?.({ center: [point.lng, point.lat], duration: 250 });
    placeOverlay();
  }

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
    note.textContent = radiusMeters(getRadius?.()) + ' m';
    note.title = accuracy > 0 ? 'GPS-nauwkeurigheid ±' + Math.round(accuracy) + ' m' :
      'Herkenningsstraal. Zoom om deze te wijzigen.';
    placeholder.hidden = ready && !tileError;
    placeOverlay();
  }

  async function update() {
    if (!alive) return;
    const position = validPoint(getPoint?.());
    refresh();
    if (!position) return;
    if (!canRender()) {
      pendingUpdate = true;
      placeholder.hidden = false;
      placeholder.textContent = 'Kaart wordt zichtbaar zodra het scherm is opgebouwd…';
      return;
    }
    if (map) {
      marker?.setLngLat([position.lng, position.lat]);
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
      // Exact same stylesheet/module/worker settings as Omgeving.
      const lib = await loadSharonRenderer(loadRenderer);
      if (!alive || !element.isConnected) return;
      const center = validPoint(getPoint?.()) || position;
      map = createSharonMap(lib, {
        container: element,
        style: environmentStyle,
        center: [center.lng, center.lat],
        zoom: zoomForArea(getRadius?.(), center.lat),
        interactive: true,
        dragPan: true,
        scrollZoom: true,
        boxZoom: false,
        doubleClickZoom: true,
        touchZoomRotate: true,
        minZoom: zoomForArea(2000, center.lat),
        maxZoom: zoomForArea(20, center.lat),
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
        maxPitch: 0,
        fadeDuration: 0
      });
      map.touchZoomRotate?.disableRotation?.();
      if (typeof lib.Marker === 'function') {
        const user=validPoint(getUserPoint());
        if(user){const dot=document.createElement('div');dot.className='sharon-gps-dot';dot.setAttribute('aria-label','Jouw GPS-positie');userMarker=new lib.Marker({element:dot}).setLngLat([user.lng,user.lat]).addTo(map);}
        const pin = document.createElement('div');
        pin.className = 'sh-location-map-pin';
        pin.setAttribute('aria-label', 'Versleep om de GPS-positie te wijzigen');
        marker = new lib.Marker({ element: pin, draggable: positionEditable, anchor: 'center' })
          .setLngLat([center.lng, center.lat]).addTo(map);
        marker.on('drag', () => {
          if (!positionEditable) return;
          const dragged = marker.getLngLat();
          const pixels = map.project?.([dragged.lng, dragged.lat]);
          if (pixels) {
            overlay.style.left = pixels.x + 'px';
            overlay.style.top = pixels.y + 'px';
          }
        });
        marker.on('dragend', () => {
          if (!positionEditable) return;
          const point = marker.getLngLat();
          updatePoint({ lat: point.lat, lng: point.lng });
        });
      }
      map.on('click', event => {
        if (positionEditable && event?.lngLat) updatePoint({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });
      map.on('move', placeOverlay);
      map.on('load', () => {
        if (!alive) return;
        ready = true;
        resize();
        refresh();
      });
      // A zoom gesture changes only the radius; no GPS coordinate mutation.
      map.on('zoom', () => {
        if (!alive) return;
        const current = validPoint(getPoint?.());
        if (!current) return;
        const nextRadius = radiusForZoom(map.getZoom(), current.lat);
        if (nextRadius !== radiusMeters(getRadius?.())) onRadiusChange(nextRadius);
        refresh();
      });
      map.on('error', event => {
        if (!alive) return;
        tileError = true;
        placeholder.hidden = false;
        placeholder.textContent = 'Kaartgegevens niet beschikbaar. Controleer de verbinding.';
        // Diagnostic details are useful when debugging the device but never block saving.
        console.warn('Sharon locatiekaart', event?.error?.message || 'Kaartfout');
      });
      map.on('idle', () => {
        if (!alive || !ready || !tileError) return;
        // Do not mask the basemap if the error was intermittent.
        tileError = false;
        refresh();
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

  function setPositionEditable(value) {
    positionEditable = Boolean(value);
    marker?.setDraggable?.(positionEditable);
    const pinElement = marker?.getElement?.();
    pinElement?.classList?.toggle?.('is-editable', positionEditable);
    return positionEditable;
  }

  function zoom(delta) {
    if (!map || !ready) return;
    const current = map.getZoom?.();
    if (!Number.isFinite(current)) return;
    const position = validPoint(getPoint?.());
    const low = position ? zoomForArea(2000, position.lat) : 1;
    const high = position ? zoomForArea(20, position.lat) : 22;
    const next = Math.max(low, Math.min(high, current + Number(delta || 0)));
    map.easeTo?.({ zoom: next, duration: 180 });
  }

  function dispose() {
    alive = false;
    resizeObserver?.disconnect();
    resizeObserver = null;
    userMarker?.remove();userMarker=null;
    if (marker) {
      marker.remove();
      marker = null;
    }
    if (map) {
      map.remove();
      map = null;
    }
    host.replaceChildren();
  }
  refresh();
  return { update, refresh, dispose, setPositionEditable, zoom };
}
