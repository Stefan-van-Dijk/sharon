import {
  environmentIdForPoint,
  environmentPointId
} from '../core/location/EnvironmentIdentifier.js?v=0.1.57';
import { environmentGeoJSON } from './EnvironmentData.js?v=0.1.57';
import { bindEnvironmentPositionButton } from './EnvironmentPosition.js?v=0.1.57';
import { bindEnvironmentTouchGestures, bindEnvironmentButton } from './EnvironmentGestures.js?v=0.1.57';
import { environmentStyle } from './EnvironmentStyle.js?v=0.1.57';
import { environmentScaleForSpan, nextEnvironmentScale, environmentSpanForZoom,
  environmentZoomForSpan, configureEnvironmentGestures, environmentZoomTransition
} from './EnvironmentScale.js?v=0.1.57';

// World geography stays with a vector tile provider; Sharon saves only its own objects.
// Pin the renderer version instead of relying on a moving CDN "latest".
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css';
const MAPLIBRE_WORKER = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs';
const CAMERA_KEY = 'environment-camera:v1';
let lastCamera = null;
const LOCAL_LAYERS = Object.freeze(['sharon-points', 'sharon-lines', 'sharon-polygons', 'sharon-polygon-outlines']);

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

function visibleSpanMeters(map) {
  return environmentSpanForZoom(map.getZoom(), map.getCenter().lat, map.getContainer());
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

export function installSharonLayers(map) {
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
      'fill-color': ['get', 'color'],
      'fill-opacity': ['*', ['get', 'opacity'], ['case', ['get', 'seen'], 0.035, 0.16]]
    }
  });
  map.addLayer({
    id: 'sharon-polygon-outlines', type: 'line', source: 'sharon-objects',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': ['get', 'color'], 'line-width': 1.4,
      'line-opacity': ['*', ['get', 'opacity'], ['case', ['get', 'seen'], 0.2, 0.85]]
    }
  });
  map.addLayer({
    id: 'sharon-lines',
    type: 'line',
    source: 'sharon-objects',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1, 17, 2.5],
      'line-opacity': ['*', ['get', 'opacity'], ['case', ['get', 'seen'], 0.2, 0.9]]
    }
  });
  map.addLayer({
    id: 'sharon-points',
    type: 'circle',
    source: 'sharon-objects',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#fff',
      'circle-opacity': ['*', ['get', 'opacity'], ['case', ['get', 'seen'], 0.2, 1]],
      'circle-stroke-opacity': ['*', ['get', 'opacity'], ['case', ['get', 'seen'], 0.2, 1]],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 15, 6],
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 2
    }
  });
}

function updateReadout(map, userPoint, scaleButton, readout) {
  const span = visibleSpanMeters(map);
  const center = map.getCenter();
  const areaId = environmentIdForPoint(center, areaLengthForWidth(span));
  const scale = environmentScaleForSpan(span);
  scaleButton.textContent = `${scale.label} · ${formatDistance(span)}`;
  scaleButton.setAttribute('aria-label', `Schaal wijzigen: ${scale.label}. Volgende niveau: ${nextEnvironmentScale(scale.id).label}`);

  const values = [
    ['Positie', userPoint ? environmentPointId(userPoint) : 'Nog niet bepaald',
      userPoint ? `GPS ±${Math.round(Number(userPoint.accuracy) || 0)} m` : 'Gebruik Positie'],
    ['Gebied', areaId, `Kaartbereik ${formatDistance(span)}`]
  ];
  if (readout.children.length !== values.length) {
    readout.replaceChildren();
    for (const _ of values) {
      const column = document.createElement('div');
      column.append(document.createElement('span'), document.createElement('strong'), document.createElement('small'));
      readout.append(column);
    }
  }
  values.forEach(([label, value, info], index) => {
    const column = readout.children[index];
    const [labelNode, valueNode, detailNode] = column.children;
    if (labelNode.textContent !== label) labelNode.textContent = label;
    if (valueNode.textContent !== value) valueNode.textContent = value;
    if (detailNode.textContent !== info) detailNode.textContent = info;
  });
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
                aria-label="Schaal wijzigen"></button>
        <button type="button" class="environment-refresh" data-map-position
                aria-label="Ik ben hier: terug naar mijn huidige positie">Ik ben hier</button>
        <div class="environment-zoom" aria-label="Kaartzoom">
          <button type="button" data-map-zoom-in aria-label="Inzoomen">+</button>
          <button type="button" data-map-zoom-out aria-label="Uitzoomen">−</button>
        </div>
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
  let followingPosition = true;
  let map = null;
  let rendererLibrary = null;
  let gpsMarker = null;
  let objectsRevision = 0;
  let mapReady = false;
  let resizeObserver = null;
  const unsubscribers = [];
  let popup = null;
  let awaitingFirstPosition = !userPoint;
  let readoutFrame = 0;
  let saveTimer = null;
  let scaleTarget = null;
  let positionRequested = false;

  const displayFailure = description => {
    if (disposed) return;
    if (!map) {
      statusMessage(mapElement, 'Kaart tijdelijk niet beschikbaar', description);
    } else {
      errorBanner.textContent = description;
      errorBanner.hidden = false;
    }
  };

  const placePosition = point => {
    if (!isCoordinate(point) || disposed) return;
    userPoint = point;
    if (!map) return;
    if (!gpsMarker) {
      const dot = document.createElement('div');
      dot.className = 'sharon-gps-dot';
      gpsMarker = new rendererLibrary.Marker({ element: dot, anchor: 'center' }).addTo(map);
    }
    gpsMarker.setLngLat(coordinateArray(point));
    if (followingPosition) {
      map.easeTo({ center: coordinateArray(point),
        ...(awaitingFirstPosition ? { zoom: environmentZoomForSpan(700, point.lat, mapElement) } : {}), duration: 650 });
      awaitingFirstPosition = false;
    }
    updateReadout(map, userPoint, scaleButton, readout);
  };

  unsubscribers.push(bindEnvironmentPositionButton(positionButton, {
    location, getPoint: () => userPoint,
    onRequest: () => {
      positionRequested = true;
      followingPosition = true;
      scaleTarget = null;
    },
    onPoint: placePosition,
    // A later GPS result updates the marker without undoing intervening drags.
    onRefreshPoint: placePosition,
    onUnavailable: () => displayFailure('GPS niet beschikbaar. Een bekende positie blijft bruikbaar.')
  }));

  try {
    ensureRendererStyle();
    const [lib, saved] = await Promise.all([
      import(MAPLIBRE_JS),
      lastCamera ? Promise.resolve({ value: lastCamera }) : store.get('meta', CAMERA_KEY).catch(() => null)
    ]);
    rendererLibrary = lib;
    // MapLibre 6 ESM requires an explicit module-worker URL.
    lib.setWorkerUrl?.(MAPLIBRE_WORKER);
    lib.setWorkerCount?.(2);
    const camera = saved?.value;
    const hasCamera = !positionRequested && isCoordinate(camera) && Number.isFinite(camera.zoom);
    if (hasCamera) { followingPosition = false; awaitingFirstPosition = false; }
    if (disposed) return () => {};
    map = createMapLibreInstance(lib, {
      container: mapElement,
      style: environmentStyle,
      center: hasCamera ? coordinateArray(camera) : userPoint ? coordinateArray(userPoint) : [5.3, 52.2],
      zoom: hasCamera ? Math.max(1, Math.min(22, camera.zoom))
        : environmentZoomForSpan(userPoint ? 700 : 700000, userPoint?.lat ?? 52.2, mapElement),
      minZoom: 1,
      maxZoom: 22,
      refreshExpiredTiles: true,
      fadeDuration: 100,
      dragRotate: false,
      doubleClickZoom: false,
      touchPitch: false,
      maxPitch: 0,
      attributionControl: { compact: true },
      renderWorldCopies: true
    });

    const render = () => {
      if (!disposed && map) updateReadout(map, userPoint, scaleButton, readout);
    };

    const stopFollowing = () => {
      followingPosition = false;
      awaitingFirstPosition = false;
      scaleTarget = null;
    };
    configureEnvironmentGestures(map);
    unsubscribers.push(bindEnvironmentTouchGestures(map, stopFollowing));

    const updateObjects = async () => {
      const revision = ++objectsRevision;
      const objects = await store.getAll('objects');
      if (disposed || revision !== objectsRevision || !mapReady) return;
      map.getSource('sharon-objects')?.setData(environmentGeoJSON(objects));
    };

    map.on('load', () => {
      if (disposed) return;
      mapReady = true;
      errorBanner.hidden = true;
      installSharonLayers(map);
      updateObjects().catch(() => {});
      render();
    });
    // Update small readouts once per frame; never rebuild geometry while zooming.
    map.on('move', () => {
      if (!readoutFrame) readoutFrame = requestAnimationFrame(() => {
        readoutFrame = 0; render();
      });
    });
    map.on('moveend', () => {
      scaleTarget = null;
      render();
      const center = map.getCenter().wrap();
      lastCamera = { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        store.put('meta', { key: CAMERA_KEY, value: lastCamera }).catch(() => {});
      }, 300);
    });
    // Programmatic GPS/camera movements must not cancel following.
    for (const type of ['dragstart', 'zoomstart']) {
      map.on(type, event => { if (event.originalEvent) stopFollowing(); });
    }
    map.on('sourcedata', event => {
      if (event.isSourceLoaded) errorBanner.hidden = true;
    });

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
      displayFailure('Kaartgegevens tijdelijk niet beschikbaar. Probeer opnieuw met verbinding.');
      console.warn('Sharon Omgeving: vectorkaart', event.error);
    });
    unsubscribers.push(bindEnvironmentButton(scaleButton, () => {
      const currentId = scaleTarget || environmentScaleForSpan(visibleSpanMeters(map)).id;
      const next = nextEnvironmentScale(currentId);
      stopFollowing();
      environmentZoomTransition(map, environmentZoomForSpan(next.spanM, map.getCenter().lat, mapElement));
      // easeTo may end the interrupted animation synchronously. Set the new
      // target afterwards so rapid taps continue through the level sequence.
      scaleTarget = next.id;
    }));
    const stepZoom = (direction, around) => {
      stopFollowing();
      environmentZoomTransition(map, map.getZoom() + direction * 0.25, { duration: 650, around });
    };
    unsubscribers.push(bindEnvironmentButton(root.querySelector('[data-map-zoom-in]'), () => stepZoom(1)));
    unsubscribers.push(bindEnvironmentButton(root.querySelector('[data-map-zoom-out]'), () => stepZoom(-1)));
    unsubscribers.push(events.on('location.changed', event => placePosition(event.detail)));
    for (const name of ['location.created', 'location.updated', 'location.deleted',
      'environment.objects.changed']) {
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
    cancelAnimationFrame(readoutFrame);
    clearTimeout(saveTimer);
    if (lastCamera) store.put('meta', { key: CAMERA_KEY, value: lastCamera }).catch(() => {});
    for (const unsubscribe of unsubscribers) unsubscribe();
    resizeObserver?.disconnect();
    popup?.remove();
    gpsMarker?.remove();
    map?.remove();
  };
}
