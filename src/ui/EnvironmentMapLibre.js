import {
  environmentIdForPoint,
  environmentPointId
} from '../core/location/EnvironmentIdentifier.js?v=0.1.64';
import { environmentGeoJSON } from './EnvironmentData.js?v=0.1.64';
import { bindEnvironmentPositionButton } from './EnvironmentPosition.js?v=0.1.64';
import { bindEnvironmentTouchGestures, bindEnvironmentButton } from './EnvironmentGestures.js?v=0.1.64';
import { createEnvironmentCameraControls } from './EnvironmentCamera.js?v=0.1.64';
import { environmentStyle } from './EnvironmentStyle.js?v=0.1.64';
import { createEnvironmentAppearanceEditor } from './EnvironmentAppearanceEditor.js?v=0.1.64';
import { environmentScaleForSpan, nextEnvironmentScale, environmentSpanForZoom,
  environmentZoomForSpan, configureEnvironmentGestures
} from './EnvironmentScale.js?v=0.1.64';

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

// Set the GPS coordinate before MapLibre can render the marker on addTo().
export function createEnvironmentGpsMarker(library, map, element, point) {
  return new library.Marker({ element, anchor: 'center' })
    .setLngLat(coordinateArray(point))
    .addTo(map);
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

export function openEnvironmentView(root, {
  store, location, events, setTitle = () => {}, loadRenderer = () => import(MAPLIBRE_JS)
}) {
  setTitle('Omgeving');
  root.innerHTML = `
    <section class="module-view environment-view environment-maplibre">
      <div class="environment-canvas" data-map-canvas>
        <div class="environment-map" data-maplibre-map role="application" aria-label="Interactieve wereldkaart"></div>
      </div>
      <div class="environment-controls" data-map-controls>
        <button type="button" class="environment-scale-chip" data-map-scale
                aria-label="Schaal wijzigen" disabled>Kaart laden…</button>
        <button type="button" class="environment-refresh" data-map-position
                aria-label="Ik ben hier: terug naar mijn huidige positie">Ik ben hier</button>
        <div class="environment-zoom" aria-label="Kaartzoom">
          <button type="button" data-map-zoom-in aria-label="Inzoomen" disabled>+</button>
          <button type="button" data-map-zoom-out aria-label="Uitzoomen" disabled>−</button>
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
  // Opt-in diagnostics: local only; never log coordinates or identifiers.
  let reportControl = () => {};
  let reportCameraRequest = () => {};
  let registerCameraDiagnostics = () => {};
  let reportDiagnosticError = () => {};
  let reportDiagnosticStatus = () => {};
  let cleanupDiagnostics = () => {};
  if (new URLSearchParams(window.location.search).get('kaarttest') === '1') {
    const output = document.createElement('output');
    output.className = 'environment-control-check';
    output.style.whiteSpace = 'pre-line';
    output.style.lineHeight = '1.4';
    output.style.maxHeight = '40vh';
    output.style.overflow = 'hidden';
    root.querySelector('[data-map-controls]').append(output);

    let input = 'geen aanraking', action = 'geen actie';
    let cameraNote = 'Camera: renderer wordt geladen';
    let statusNote = 'Status: wachten op initialisatie';
    let errorNote = '';
    let diagnosticMap = null;
    let verificationTimer = null;
    let commandSequence = 0;
    const counts = { zoomstart: 0, zoom: 0, zoomend: 0, moveend: 0 };
    let detachMapEvents = () => {};
    const formatZoom = value => Number.isFinite(value) ? value.toFixed(2) : 'onbekend';
    const renderDiagnostic = () => {
      output.textContent = [
        'Kaartcontrole 0.1.64 · ' + input + ' · ' + action,
        cameraNote,
        statusNote,
        'Events: zoomstart ' + counts.zoomstart + ' / zoom ' + counts.zoom +
          ' / zoomend ' + counts.zoomend + ' / moveend ' + counts.moveend,
        ...(errorNote ? [errorNote] : [])
      ].join('\n');
    };
    reportControl = value => { action = value; renderDiagnostic(); };
    reportDiagnosticStatus = value => {
      statusNote = 'Status: ' + value;
      renderDiagnostic();
    };
    reportDiagnosticError = error => {
      const message = error?.message ?? error?.reason?.message ?? String(error || 'onbekende fout');
      errorNote = 'Fout: ' + String(message).slice(0, 170);
      renderDiagnostic();
    };
    reportCameraRequest = ({ from, to, scale }) => {
      if (!diagnosticMap) return;
      const sequence = ++commandSequence;
      clearTimeout(verificationTimer);
      cameraNote = 'Zoom: ' + formatZoom(from) + ' → doel ' + formatZoom(to) +
        ' → nu ' + formatZoom(diagnosticMap.getZoom());
      statusNote = 'Status: ' + (scale ? 'schaal ' + scale : 'zoom') + ' aangevraagd';
      renderDiagnostic();
      verificationTimer = setTimeout(() => {
        if (sequence !== commandSequence || !output.isConnected || !diagnosticMap) return;
        const actual = diagnosticMap.getZoom();
        const reached = Math.abs(actual - to) < 0.08;
        const moving = diagnosticMap.isMoving?.() || false;
        cameraNote = 'Zoom: ' + formatZoom(from) + ' → doel ' + formatZoom(to) +
          ' → na 2,6s ' + formatZoom(actual);
        statusNote = reached ? 'Status: DOEL BEREIKT' :
          moving ? 'Status: CAMERA BEWEEGT NOG' : 'Status: DOEL NIET BEREIKT / ONDERBROKEN';
        renderDiagnostic();
      }, 2600);
    };
    registerCameraDiagnostics = instance => {
      diagnosticMap = instance;
      reportDiagnosticStatus('kaartobject gemaakt');
      const handlers = [];
      for (const name of ['zoomstart', 'zoom', 'zoomend', 'moveend']) {
        const handler = () => {
          counts[name] += 1;
          if (name !== 'zoom') renderDiagnostic();
        };
        instance.on(name, handler);
        handlers.push([name, handler]);
      }
      detachMapEvents = () => {
        for (const [name, handler] of handlers) instance.off(name, handler);
        diagnosticMap = null;
      };
    };
    const inspect = event => {
      const target = event.target.closest?.('[data-map-position],[data-map-scale],[data-map-zoom-in],[data-map-zoom-out]');
      input = event.type + ': ' + (target?.getAttribute('aria-label') || 'kaart');
      renderDiagnostic();
    };
    const surface = root.querySelector('.environment-view');
    const names = ['touchstart', 'touchend', 'pointercancel', 'click'];
    for (const name of names) surface.addEventListener(name, inspect, true);
    const handleWindowError = event => {
      if (event.error || event.message) reportDiagnosticError(event.error || event.message);
    };
    const handleRejection = event => reportDiagnosticError(event.reason);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleRejection);
    cleanupDiagnostics = () => {
      clearTimeout(verificationTimer);
      detachMapEvents();
      for (const name of names) surface.removeEventListener(name, inspect, true);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
    renderDiagnostic();
  }

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
  let cameraControls = null;
  let positionRequested = false;
  const appearanceEditor = createEnvironmentAppearanceEditor(root, store, () => mapReady ? map : null);

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
      gpsMarker = createEnvironmentGpsMarker(rendererLibrary, map, dot, point);
    } else {
      gpsMarker.setLngLat(coordinateArray(point));
    }
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
      reportControl('positieknop ontvangen');
      positionRequested = true;
      followingPosition = true;
      cameraControls?.reset();
    },
    onPoint: placePosition,
    // A later GPS result updates the marker without undoing intervening drags.
    onRefreshPoint: placePosition,
    onUnavailable: () => displayFailure('GPS niet beschikbaar. Een bekende positie blijft bruikbaar.')
  }));

  const initialize = async () => {
  try {
    ensureRendererStyle();
    const [lib, saved] = await Promise.all([
      loadRenderer(),
      lastCamera ? Promise.resolve({ value: lastCamera }) : store.get('meta', CAMERA_KEY).catch(() => null)
    ]);
    if (disposed) return;
    rendererLibrary = lib;
    // MapLibre 6 ESM requires an explicit module-worker URL.
    lib.setWorkerUrl?.(MAPLIBRE_WORKER);
    lib.setWorkerCount?.(2);
    const camera = saved?.value;
    const hasCamera = !positionRequested && isCoordinate(camera) && Number.isFinite(camera.zoom);
    if (hasCamera) { followingPosition = false; awaitingFirstPosition = false; }
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
    registerCameraDiagnostics(map);

    const render = () => {
      if (!disposed && map) updateReadout(map, userPoint, scaleButton, readout);
    };

    const stopFollowing = () => {
      followingPosition = false;
      awaitingFirstPosition = false;
      cameraControls?.reset();
    };
    reportControl('kaart gestart');
    reportDiagnosticStatus('kaart gemaakt; bediening koppelen');
    cameraControls = createEnvironmentCameraControls(map, () => {
      followingPosition = false;
      awaitingFirstPosition = false;
    }, reportCameraRequest);
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
      reportDiagnosticStatus('kaartstijl geladen');
      errorBanner.hidden = true;
      installSharonLayers(map);
      appearanceEditor.apply();
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
      cameraControls?.settle();
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
      reportDiagnosticError(event.error || 'MapLibre-kaartfout');
      displayFailure('Kaartgegevens tijdelijk niet beschikbaar. Probeer opnieuw met verbinding.');
      console.warn('Sharon Omgeving: vectorkaart', event.error);
    });
    unsubscribers.push(bindEnvironmentButton(scaleButton, () => {
      reportControl('schaalknop ontvangen');
      cameraControls.nextScale();
    }));
    const stepZoom = direction => {
      reportControl(direction > 0 ? 'inzoomknop ontvangen' : 'uitzoomknop ontvangen');
      cameraControls.step(direction);
    };
    unsubscribers.push(bindEnvironmentButton(root.querySelector('[data-map-zoom-in]'), () => stepZoom(1)));
    unsubscribers.push(bindEnvironmentButton(root.querySelector('[data-map-zoom-out]'), () => stepZoom(-1)));
    for (const button of [scaleButton, root.querySelector('[data-map-zoom-in]'), root.querySelector('[data-map-zoom-out]')]) button.disabled = false;
    reportDiagnosticStatus('knoppen gekoppeld');
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
    reportControl('kaart starten mislukt');
    reportDiagnosticError(error);
    reportDiagnosticStatus('kaart starten mislukt');
    console.warn('Sharon Omgeving: MapLibre kan niet starten', error);
    displayFailure(error.message || 'Open de kaart opnieuw wanneer er verbinding is.');
  }

  };
  initialize();

  return () => {
    disposed = true;
    cleanupDiagnostics();
    appearanceEditor.dispose();
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
