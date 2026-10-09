import {
  environmentIdForPoint,
  environmentPointId
} from '../core/location/EnvironmentIdentifier.js?v=0.1.52';
import { environmentGeoJSON } from './EnvironmentData.js?v=0.1.52';

// World geography stays with a vector tile provider; Sharon saves only its own objects.
// Pin the renderer version instead of relying on a moving CDN "latest".
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const LOCAL_LAYERS = Object.freeze(['sharon-points', 'sharon-lines', 'sharon-polygons']);

const isCoordinate = point => point &&
  point.lat !== null && point.lng !== null &&
  point.lat !== undefined && point.lng !== undefined &&
  Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) &&
  Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;

function coordinateArray(point) {
  return [Number(point.lng), Number(point.lat)];
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

function visibleWidthMeters(map) {
  const { lat } = map.getCenter();
  const metersPerPixel = EARTH_CIRCUMFERENCE_M *
    Math.max(0.00001, Math.cos(lat * Math.PI / 180)) /
    (512 * 2 ** map.getZoom());
  return Math.max(1, map.getContainer().clientWidth * metersPerPixel);
}

function areaLengthForWidth(meters) {
  return meters < 3000 ? 6 : meters < 100000 ? 4 : 2;
}

function ensureRendererStyle() {
  if (document.querySelector('[data-sharon-maplibre-css]')) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = MAPLIBRE_CSS;
  css.dataset.sharonMaplibreCss = 'true';
  document.head.append(css);
}

function statusMessage(container, title, detail) {
  container.replaceChildren();
  const message = document.createElement('div');
  message.className = 'environment-empty';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const description = document.createElement('small');
  description.textContent = detail;
  message.append(heading, description);
  container.append(message);
}

function suppressProviderPoiLabels(map) {
  // Keep streets and place names. Suppress decorative POI labels, not geography.
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    if (/poi|housenumber|house_number|transit/.test(layer.id.toLowerCase())) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

function installSharonLayers(map) {
  if (map.getSource('sharon-objects')) return;
  map.addSource('sharon-objects', {
    type: 'geojson',
    data: environmentGeoJSON([]),
    promoteId: 'id'
  });
  map.addLayer({
    id: 'sharon-polygons',
    type: 'fill',
    source: 'sharon-objects',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': '#262629',
      'fill-opacity': 0.12,
      'fill-outline-color': '#252528'
    }
  });
  map.addLayer({
    id: 'sharon-lines',
    type: 'line',
    source: 'sharon-objects',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': '#252528',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1, 17, 2.5],
      'line-opacity': 0.86
    }
  });
  map.addLayer({
    id: 'sharon-points',
    type: 'circle',
    source: 'sharon-objects',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#fff',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 15, 6],
      'circle-stroke-color': '#17171a',
      'circle-stroke-width': 2
    }
  });
}

function updateReadout(map, userPoint, scaleButton, readout) {
  const span = visibleWidthMeters(map);
  const center = map.getCenter();
  const areaId = environmentIdForPoint(center, areaLengthForWidth(span));
  scaleButton.textContent = formatDistance(span);
  readout.replaceChildren();
  for (const [label, value, info] of [
    ['Positie', userPoint ? environmentPointId(userPoint) : 'Nog niet bepaald',
      userPoint ? `GPS ±${Math.round(Number(userPoint.accuracy) || 0)} m` : 'Gebruik Positie'],
    ['Gebied', areaId, `Kaartbreedte ${formatDistance(span)}`]
  ]) {
    const column = document.createElement('div');
    const labelNode = document.createElement('span');
    labelNode.textContent = label;
    const valueNode = document.createElement('strong');
    valueNode.textContent = value;
    const detailNode = document.createElement('small');
    detailNode.textContent = info;
    column.append(labelNode, valueNode, detailNode);
    readout.append(column);
  }
}

/**
 * Display a ready-made vector basemap. Only objects deliberately marked for
 * the map (and local locations) are rendered on top. Nothing is published.
 */
// MapLibre 6's ESM namespace exposes Map, but no supported() helper.
export function createMapLibreInstance(library, options) {
  if (typeof library?.Map !== 'function') {
    throw new Error('De kaartbibliotheek kon niet worden geladen.');
  }
  // A genuine GPU/WebGL failure will be raised by the constructor itself.
  return new library.Map(options);
}

export async function openEnvironmentView(root, {
  store, location, events, setTitle = () => {}
}) {
  setTitle('Omgeving');
  root.innerHTML = `
    <section class="module-view environment-view environment-maplibre">
      <div class="environment-canvas" data-map-canvas>
        <div class="environment-map" data-maplibre-map role="application" aria-label="Interactieve wereldkaart"></div>
        <button type="button" class="environment-scale-chip" data-map-scale
                aria-label="Inzoomen op de kaart"></button>
        <button type="button" class="environment-refresh" data-map-position
                aria-label="Huidige positie bepalen">Positie</button>
        <div class="environment-readout" data-map-readout></div>
        <div class="environment-map-error" data-map-error hidden role="status"></div>
      </div>
    </section>
  `;
  const mapElement = root.querySelector('[data-maplibre-map]');
  const readout = root.querySelector('[data-map-readout]');
  const scaleButton = root.querySelector('[data-map-scale]');
  const positionButton = root.querySelector('[data-map-position]');
  const errorBanner = root.querySelector('[data-map-error]');
  let disposed = false;
  let userPoint = isCoordinate(location.latest) ? location.latest : null;
  let followingPosition = Boolean(userPoint);
  let map = null;
  let gpsMarker = null;
  let objectsRevision = 0;
  let mapReady = false;
  let resizeObserver = null;
  const unsubscribers = [];
  let popup = null;

  const displayFailure = description => {
    if (disposed) return;
    if (!map) {
      statusMessage(mapElement, 'Kaart tijdelijk niet beschikbaar', description);
    } else {
      errorBanner.textContent = description;
      errorBanner.hidden = false;
    }
  };

  try {
    ensureRendererStyle();
    const lib = await import(MAPLIBRE_JS);
    if (disposed) return () => {};
    map = createMapLibreInstance(lib, {
      container: mapElement,
      style: BASEMAP_STYLE,
      center: userPoint ? coordinateArray(userPoint) : [0, 20],
      zoom: userPoint ? 15 : 1.65,
      minZoom: 1,
      maxZoom: 20,
      dragRotate: false,
      touchPitch: false,
      maxPitch: 0,
      attributionControl: true,
      renderWorldCopies: true
    });

    const render = () => {
      if (!disposed && map) updateReadout(map, userPoint, scaleButton, readout);
    };

    const placePosition = point => {
      if (!isCoordinate(point) || disposed || !map) return;
      userPoint = point;
      if (!gpsMarker) {
        const dot = document.createElement('div');
        dot.className = 'sharon-gps-dot';
        gpsMarker = new lib.Marker({ element: dot, anchor: 'center' }).addTo(map);
      }
      gpsMarker.setLngLat(coordinateArray(point));
      if (followingPosition) {
        map.easeTo({ center: coordinateArray(point), duration: 260 });
      }
      render();
    };

    const updateObjects = async () => {
      const revision = ++objectsRevision;
      const objects = await store.getAll('objects');
      if (disposed || revision !== objectsRevision || !mapReady) return;
      map.getSource('sharon-objects')?.setData(environmentGeoJSON(objects));
    };

    map.on('load', () => {
      if (disposed) return;
      mapReady = true;
      suppressProviderPoiLabels(map);
      installSharonLayers(map);
      updateObjects().catch(() => {});
      render();
    });
    map.on('moveend', render);
    map.on('dragstart', () => { followingPosition = false; });
    map.on('zoomstart', () => { followingPosition = false; });

    map.on('click', event => {
      if (!mapReady) return;
      const features = map.queryRenderedFeatures(event.point, { layers: LOCAL_LAYERS });
      const selected = features[0];
      if (!selected) return;
      popup?.remove();
      const element = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = String(selected.properties?.title || 'Object');
      element.append(heading);
      if (selected.properties?.sourceId) {
        const detail = document.createElement('small');
        detail.style.display = 'block';
        detail.textContent = `Bron: ${selected.properties.sourceId}`;
        element.append(detail);
      }
      popup = new lib.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(event.lngLat)
        .setDOMContent(element)
        .addTo(map);
    });

    // Loading failures do not trigger old Overpass requests.
    map.on('error', event => {
      if (!mapReady) displayFailure('De vectorkaart kan momenteel niet worden geladen.');
      console.warn('Sharon Omgeving: vectorkaart', event.error);
    });
    positionButton.addEventListener('click', async () => {
      positionButton.disabled = true;
      positionButton.textContent = 'Bepalen…';
      try {
        const point = await location.checkNow({
          reason: 'environment', maxAgeMs: 0,
          highAccuracy: true, browserMaxAgeMs: 0, timeoutMs: 10000
        });
        if (!disposed) {
          followingPosition = true;
          placePosition(point);
        }
      } catch {
        if (!disposed) displayFailure('Positie niet beschikbaar. De kaart blijft bruikbaar.');
      } finally {
        if (!disposed) {
          positionButton.disabled = false;
          positionButton.textContent = 'Positie';
        }
      }
    });
    scaleButton.addEventListener('click', () => {
      followingPosition = false;
      map.easeTo({ zoom: Math.min(20, map.getZoom() + 1), duration: 200 });
    });
    unsubscribers.push(events.on('location.changed', event => placePosition(event.detail)));
    for (const name of ['location.created', 'location.updated', 'location.deleted']) {
      unsubscribers.push(events.on(name, () => {
        updateObjects().catch(() => {});
      }));
    }
    if (userPoint) placePosition(userPoint);
    render();
    if (!userPoint) {
      location.checkNow({
        reason: 'environment', maxAgeMs: 30000, highAccuracy: false,
        browserMaxAgeMs: 30000, timeoutMs: 9000
      }).then(point => {
        if (!disposed) {
          followingPosition = true;
          placePosition(point);
        }
      }).catch(() => {});
    }
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        if (!disposed && map) map.resize();
      });
      resizeObserver.observe(mapElement);
    }
  } catch (error) {
    console.warn('Sharon Omgeving: MapLibre kan niet starten', error);
    displayFailure(error.message || 'Open de kaart opnieuw wanneer er verbinding is.');
  }

  return () => {
    disposed = true;
    objectsRevision++;
    for (const unsubscribe of unsubscribers) unsubscribe();
    resizeObserver?.disconnect();
    popup?.remove();
    gpsMarker?.remove();
    map?.remove();
  };
}
