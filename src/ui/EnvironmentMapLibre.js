import { openBoardViewer } from './BoardViewer.js?v=0.2.69';
import { mountWikipediaLayer } from './WikipediaLayer.js?v=0.2.69';
import { MAPLIBRE_JS, ensureRendererStyle, configureRenderer, createSharonMap } from './SharonMapRuntime.js?v=0.2.00';
import {
  environmentIdForPoint,
  environmentPointId
} from '../core/location/EnvironmentIdentifier.js?v=0.1.90';
import { environmentGeoJSON } from './EnvironmentData.js?v=0.1.90';
import { bindEnvironmentPositionButton } from './EnvironmentPosition.js?v=0.1.90';
import { bindEnvironmentTouchGestures, bindEnvironmentButton } from './EnvironmentGestures.js?v=0.1.90';
import { createEnvironmentCameraControls } from './EnvironmentCamera.js?v=0.1.90';
import { createEnvironmentVisibilityControl } from './EnvironmentVisibility.js?v=0.1.90';
import { environmentStyle } from './EnvironmentStyle.js?v=0.1.90';
import { bindEnvironmentAppearance } from './EnvironmentAppearance.js?v=0.1.90';
import { createEnvironmentAppearanceEditor } from './EnvironmentAppearanceEditor.js?v=0.1.90';
import { environmentScaleForSpan, nextEnvironmentScale, environmentSpanForZoom,
  environmentZoomForSpan, configureEnvironmentGestures
} from './EnvironmentScale.js?v=0.1.90';

// Both map modules reuse SharonMapRuntime for renderer, CSS, and worker.
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
  // Same constructor used by the location card.
  return createSharonMap(library, options);
}

export function openEnvironmentView(root, {
  store, location, events, setTitle = () => {}, headerActions = null,
  loadRenderer = () => import(MAPLIBRE_JS)
}) {
  setTitle('Omgeving');
  root.innerHTML = `
    <section class="module-view environment-view environment-maplibre">
      <div class="environment-canvas" data-map-canvas>
        <div class="environment-map" data-maplibre-map role="application" aria-label="Interactieve wereldkaart"></div>
      </div>
      <div class="environment-controls" data-map-controls>
        <div class="environment-map-top-actions">
          <button type="button" class="environment-refresh" data-map-position
                  aria-label="Ga naar mijn huidige locatie" title="Mijn locatie">
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
          </button>
          <button type="button" class="environment-scale-chip" data-map-scale
                  aria-label="Schaal wijzigen" disabled>Kaart laden…</button>
        </div>
        <button type="button" class="environment-desktop-style-toggle"
                data-desktop-style-toggle aria-label="Kaartstijl aanpassen"
                 aria-controls="environment-style-editor"
                aria-pressed="false" aria-expanded="false"
                title="Kaartstijl aanpassen"><span aria-hidden="true"></span></button>
        <div class="environment-readout" data-map-readout>
          <div class="environment-readout-track" data-readout-track>
            <div class="environment-readout-position" data-readout-position></div>
            <div class="environment-readout-style" data-readout-style aria-hidden="true">
              <button type="button" class="environment-style-return" data-style-return
                      aria-label="Terug naar positie" title="Terug naar positie">
                <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3a9 9 0 1 0 0 18h1.5a2.1 2.1 0 0 0 1.4-3.7 1.9 1.9 0 0 1 .8-3.3h2.3A4.3 4.3 0 0 0 22 9.7 9 9 0 0 0 12 3Z"/>
                  <circle cx="7.5" cy="12" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>
                </svg>
              </button>
              <div class="environment-style-bar-content">
                <div class="environment-scenario-switcher" data-style-scenarios role="group" aria-label="Stijlscenario kiezen">
                  <button type="button" data-style-scenario-prev aria-label="Vorig stijlscenario">‹</button>
                  <span data-style-scenario-label aria-live="polite">Eigen · 1/9</span>
                  <button type="button" data-style-scenario-next aria-label="Volgend stijlscenario">›</button>
                </div>
                <div class="environment-style-bar-actions">
                  <button type="button" data-style-export title="Gekozen kaartstijl exporteren als JSON">Exporteer</button>
                  <button type="button" data-style-import title="JSON-kaartstijl importeren in het huidige scenario">Importeer</button>
                  <input type="file" data-style-import-file accept=".json,application/json" aria-label="Sharon kaartstijl JSON kiezen" hidden>
                </div>
                <small data-style-status aria-live="polite">Direct zichtbaar op de kaart · lokaal opgeslagen</small>
              </div>
            </div>
          </div>
          <div class="environment-readout-filters" data-readout-filters aria-hidden="true">
            <button type="button" data-filter-return class="environment-filter-back" aria-label="Terug naar positie">‹</button>
            <div class="environment-filter-options" role="group" aria-label="Kaartinformatielagen">
              <button type="button" data-wikipedia-toggle aria-pressed="false" aria-label="Wikipedia-plekken tonen of verbergen" title="Wikipedia op kaart">W <span>Wikipedia</span></button>
            </div>
            <small class="environment-filter-hint">Filters</small>
          </div>
        </div>
        <div class="environment-map-error" data-map-error hidden role="status"></div>
      </div>
    </section>
  `;
  const mapElement = root.querySelector('[data-maplibre-map]');
  const readout = root.querySelector('[data-readout-position]');
  const scaleButton = root.querySelector('[data-map-scale]');
  const positionButton = root.querySelector('[data-map-position]');
  const errorBanner = root.querySelector('[data-map-error]');
  // One physical header row for every module. Keep the controls owned by this
  // view and remove them on exit, even if map loading fails or is canceled.
  const topActions = root.querySelector('.environment-map-top-actions');
  if (headerActions && topActions) headerActions.replaceChildren(topActions);
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
        'Kaartcontrole 0.1.90 · ' + input + ' · ' + action,
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
      const target = event.target.closest?.('[data-map-position],[data-map-scale]');
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
  let wikipediaLayer = null;
  let closeBoard = null;
  const showBoard = (feature, available = []) => {
    closeBoard?.();
    const index = available.findIndex(item => item.id === feature.id);
    const next = available.length > 1 ? available[(index + 1) % available.length] : null;
    const coords = feature.geometry?.coordinates;
    if (map && Array.isArray(coords) && coords.length === 2) {
      // Board navigation owns the camera until the reader closes.
      followingPosition = false;
      awaitingFirstPosition = false;
      cameraControls?.reset();
      // Shift the story location above the glass plate while preserving the
      // existing map renderer and camera. Move with each deck transition.
      const target = { center: coords, duration: 850,
        offset: [0, -Math.round(map.getContainer().clientHeight * 0.22)],
        essential: true };
      map.easeTo(target);
    }
    closeBoard = openBoardViewer(feature, { location, events,
      onClose: () => { closeBoard = null; },
      onNext: next ? () => showBoard(next, available) : null });
  };
  let wikipediaEnabled = false;
  const filterPanel = root.querySelector('[data-readout-filters]');
  const readoutBar = root.querySelector('[data-map-readout]');
  const filterBack = root.querySelector('[data-filter-return]');
  const setFilterMode = enabled => {
    readoutBar.classList.toggle('is-filter-active', enabled);
    filterPanel.setAttribute('aria-hidden', String(!enabled));
    for (const button of filterPanel.querySelectorAll('button')) button.tabIndex = enabled ? 0 : -1;
  };
  let filterSwipe = null;
  const onFilterStart = event => {
    if (event.touches.length !== 1 || readoutBar.classList.contains('is-style-active')) return;
    if (!readoutBar.classList.contains('is-filter-active') &&
        !event.target.closest('[data-readout-position]')) return;
    if (event.target.closest('button, a, input')) return;
    const touch = event.touches[0];
    filterSwipe = { x: touch.clientX, y: touch.clientY };
  };
  const onFilterEnd = event => {
    if (!filterSwipe) return;
    const touch = event.changedTouches?.[0];
    const dx = (touch?.clientX ?? filterSwipe.x) - filterSwipe.x;
    const dy = (touch?.clientY ?? filterSwipe.y) - filterSwipe.y;
    filterSwipe = null;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) setFilterMode(true);
    else if (readoutBar.classList.contains('is-filter-active')) setFilterMode(false);
  };
  readoutBar.addEventListener('touchstart', onFilterStart, { passive: true });
  readoutBar.addEventListener('touchend', onFilterEnd, { passive: true });
  readoutBar.addEventListener('touchcancel', () => { filterSwipe = null; }, { passive: true });
  filterBack.addEventListener('click', () => setFilterMode(false));
  setFilterMode(false);
  const wikipediaToggle = root.querySelector("[data-wikipedia-toggle]");
  wikipediaToggle?.addEventListener("click", () => {
    wikipediaEnabled = !wikipediaEnabled;
    wikipediaToggle.setAttribute("aria-pressed", String(wikipediaEnabled));
    wikipediaLayer?.setEnabled(wikipediaEnabled);
  });
  let awaitingFirstPosition = !userPoint;
  let readoutFrame = 0;
  let saveTimer = null;
  let cameraControls = null;
  let positionRequested = false;
  let appearanceBinding = null;
  const cleanupAppearance = createEnvironmentAppearanceEditor(root, store, {
    floating: true,
    onChange: (next, category) => appearanceBinding?.setAppearance(next, category)
  });

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
    configureRenderer(lib);
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
      // Keep source credits expanded and linked on small screens, without the info toggle.
       attributionControl: { compact: false },
      renderWorldCopies: true
    });
    registerCameraDiagnostics(map);
    // A small independent MapLibre control shares the attribution rail.
    // Only the shell's visible chrome changes, never the map or its sources.
    map.addControl(createEnvironmentVisibilityControl(root.closest?.('.app-stage')), 'bottom-right');

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
      wikipediaLayer = mountWikipediaLayer(map, lib, { language: navigator.language?.split("-")[0] || "nl", onOpen: showBoard });
      if (wikipediaEnabled) wikipediaLayer.setEnabled(true);
      appearanceBinding = bindEnvironmentAppearance(map, store);
      unsubscribers.push(appearanceBinding);
      // The editor may have loaded from IndexedDB before the map's style.
      cleanupAppearance.apply();
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
    scaleButton.disabled = false;
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
    root.closest?.('.app-stage')?.classList.remove('is-map-clean');
    if (headerActions && topActions?.parentNode === headerActions) topActions.remove();
    cleanupDiagnostics();
    cleanupAppearance();
    objectsRevision++;
    cancelAnimationFrame(readoutFrame);
    clearTimeout(saveTimer);
    if (lastCamera) store.put('meta', { key: CAMERA_KEY, value: lastCamera }).catch(() => {});
    for (const unsubscribe of unsubscribers) unsubscribe();
    resizeObserver?.disconnect();
    popup?.remove();
    wikipediaLayer?.destroy();
    closeBoard?.();
    gpsMarker?.remove();
    map?.remove();
  };
}
