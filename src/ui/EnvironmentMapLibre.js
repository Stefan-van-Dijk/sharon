import { createEnvironmentBoardSources } from './EnvironmentBoardSources.js?v=0.4.34';
import { boardOrderMode, BOARD_ORDER_EVENT, markBoardOpened } from './BoardOrder.js?v=0.4.34';
import { mountBoardOrderControls, closeBoardOrder } from './BoardOrderControls.js?v=0.4.34';
import { createBoardMapAlignment } from './BoardMapAlignment.js?v=0.4.34';
import { placeHidden, mountPlacePulse } from './PlaceFeedback.js?v=0.4.34';
import { mountChainLayer } from './ChainLayer.js?v=0.4.34';
import { mountTiqetsLayer } from './TiqetsLayer.js?v=0.4.34';
import { tiqetsStatus, tiqetsBoard } from './TiqetsSource.js?v=0.4.34';
import { openLocationDeck } from './LocationDeck.js?v=0.4.34';
import { openBoardViewer, preloadWikipediaBoard } from './BoardViewer.js?v=0.4.34';
import { mountWikipediaLayer } from './WikipediaLayer.js?v=0.4.34';
import { MAPLIBRE_JS, ensureRendererStyle, configureRenderer, createSharonMap } from './SharonMapRuntime.js?v=0.4.34';
import {
  environmentIdForPoint,
  environmentPointId
} from '../core/location/EnvironmentIdentifier.js?v=0.4.34';
import { environmentGeoJSON } from './EnvironmentData.js?v=0.4.34';
import { bindEnvironmentPositionButton } from './EnvironmentPosition.js?v=0.4.34';
import { bindEnvironmentTouchGestures, bindEnvironmentButton } from './EnvironmentGestures.js?v=0.4.34';
import { createEnvironmentCameraControls } from './EnvironmentCamera.js?v=0.4.34';
import { createEnvironmentVisibilityControl } from './EnvironmentVisibility.js?v=0.4.34';
import { environmentStyle } from './EnvironmentStyle.js?v=0.4.34';
import { bindEnvironmentAppearance } from './EnvironmentAppearance.js?v=0.4.34';
import { createEnvironmentAppearanceEditor } from './EnvironmentAppearanceEditor.js?v=0.4.34';
import { environmentScaleForSpan, nextEnvironmentScale, environmentSpanForZoom,
  environmentZoomForSpan, configureEnvironmentGestures
} from './EnvironmentScale.js?v=0.4.34';

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
      'circle-radius': 6,
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
  store, location, events, setTitle = () => {}, headerActions = null, initialChainId = '',
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
            <div class="environment-filter-options environment-source-options" role="group" aria-label="Informatiebronnen">
              <button type="button" class="environment-source-circle" data-wikipedia-toggle aria-pressed="false" aria-label="Wikipedia tonen of verbergen; sleep omhoog voor filters" title="Wikipedia · omhoog slepen voor filters">W</button>
              <button type="button" class="environment-source-circle" data-tiqets-toggle disabled aria-pressed="false" aria-label="Tiqets tonen of verbergen" title="Tiqets wordt voorbereid">T</button>
              <button type="button" class="environment-source-circle" data-chain-toggle aria-pressed="false" aria-label="Locaties tonen of verbergen; sleep omhoog voor locaties en ketens" title="Locaties en ketens · omhoog slepen">⌂</button>
              <button type="button" class="environment-board-order-settings" data-board-order-settings aria-label="Volgorde van boards instellen" aria-expanded="false" aria-controls="environment-board-order">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m10 3-.6 2.1-2 .9-2-.6-2 3.4 1.5 1.5v2.4L3.4 14l2 3.4 2-.5 2 .9.6 2.2h4l.6-2.2 2-.9 2 .5 2-3.4-1.5-1.3v-2.4l1.5-1.5-2-3.4-2 .6-2-.9L14 3Z"/><circle cx="12" cy="11.5" r="3"/></svg>
              </button>
              <small data-tiqets-status role="status" aria-live="polite"></small>
              <button type="button" class="environment-source-settings" data-wiki-settings aria-label="Wikipedia categorieën en statussen instellen" aria-expanded="false" title="Bron omhoog openen"><span aria-hidden="true"></span></button>
            </div>

          </div>
        </div>
        <section id="environment-board-order" class="environment-source-sheet environment-board-order-sheet" data-board-order-sheet aria-label="Volgorde van boards" aria-hidden="true" hidden>
          <header><strong>Volgorde van boards</strong><button type="button" data-board-order-close aria-label="Volgorde sluiten">⌄</button></header>
          <div class="environment-board-order-options" role="group" aria-label="Volgorde voor alle bronnen">
            <button type="button" data-board-order="discover" aria-pressed="false">Nog te ontdekken</button>
            <button type="button" data-board-order="nearby" aria-pressed="false">Dichtbij</button>
            <button type="button" data-board-order="relevant" aria-pressed="false">Relevant</button>
            <button type="button" data-board-order="popular" aria-pressed="false">Populair</button>
          </div>
        </section>
        <section class="environment-source-sheet" data-places-sheet aria-label="Locaties en ketens" aria-hidden="true">
          <div class="environment-source-sheet-handle" data-places-handle aria-hidden="true"></div>
          <header><strong>Locaties en ketens</strong><button type="button" data-places-close aria-label="Locaties sluiten">⌄</button></header>
          <label>Toon <select data-chain-filter aria-label="Locaties en ketens filteren"><option value="">Alle bekende locaties</option></select></label>
          <label>Zoeken <input type="search" data-places-search placeholder="Naam of keten" aria-label="Locatie of keten zoeken"></label>
          <strong>Status</strong>
          <div class="environment-source-filter-grid environment-source-status-row" data-chain-statuses></div>
          <strong>Categorieën</strong>
          <div class="environment-source-filter-grid" data-chain-categories></div>
          <small data-chain-status role="status"></small>
          <div class="environment-places-list" data-places-list></div>
        </section>
        <section class="environment-source-sheet" data-source-sheet aria-label="Wikipedia filters" aria-hidden="true">
          <div class="environment-source-sheet-handle" data-source-sheet-handle aria-hidden="true"></div>
          <header><strong>Wikipedia</strong><small data-wiki-available>0 beschikbaar</small></header>
          <strong>Status</strong>
          <div class="environment-source-filter-grid environment-source-status-row">
            <button type="button" data-wiki-filter="read" aria-pressed="false">☑ <small data-wiki-global="read"></small></button>
            <button type="button" data-wiki-filter="liked" aria-pressed="false">♡ <small data-wiki-global="liked"></small></button>
            <button type="button" data-wiki-filter="hidden" aria-pressed="false">◌ <small data-wiki-global="hidden"></small></button>
            <button type="button" data-wiki-filter="disliked" aria-pressed="false">♧ <small data-wiki-global="disliked"></small></button>
          </div>
          <strong>Categorieën</strong>
          <div class="environment-source-filter-grid">
            <button type="button" data-wiki-category="erfgoed" aria-pressed="false"><span class="environment-category-name">Erfgoed <b data-wiki-category-total="erfgoed"></b></span><small data-wiki-category-count="erfgoed"></small></button>
            <button type="button" data-wiki-category="bouw" aria-pressed="false"><span class="environment-category-name">Bouwwerken <b data-wiki-category-total="bouw"></b></span><small data-wiki-category-count="bouw"></small></button>
            <button type="button" data-wiki-category="natuur" aria-pressed="false"><span class="environment-category-name">Natuur <b data-wiki-category-total="natuur"></b></span><small data-wiki-category-count="natuur"></small></button>
            <button type="button" data-wiki-category="cultuur" aria-pressed="false"><span class="environment-category-name">Cultuur <b data-wiki-category-total="cultuur"></b></span><small data-wiki-category-count="cultuur"></small></button>
            <button type="button" data-wiki-category="vervoer" aria-pressed="false"><span class="environment-category-name">Vervoer <b data-wiki-category-total="vervoer"></b></span><small data-wiki-category-count="vervoer"></small></button>
            <button type="button" data-wiki-category="overig" aria-pressed="false"><span class="environment-category-name">Overig <b data-wiki-category-total="overig"></b></span><small data-wiki-category-count="overig"></small></button>
          </div>
        </section>
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
  const onViewportResize = () => { if (!disposed && map) map.resize(); };
  root.querySelector('[data-maplibre-map]')?.addEventListener('sharon:viewport-resize',onViewportResize);
  const unsubscribers = [];
  let popup = null;
  let closeLocationDeck = null;
  let wikipediaLayer = null;
  let chainLayer = null;
  let tiqetsLayer = null;
  let tiqetsEnabled = false;
  let closeBoard = null;
  const boardSources = createEnvironmentBoardSources({onOpen:(feature,navigation)=>renderBoard(feature,navigation)});
  const showBoard = feature => boardSources.show(feature,map?.getCenter());
  const renderBoard = (feature, {next, previous, onNext, onPrevious}) => {
    chainLayer?.closeBoard();
    closeLocationDeck?.();
    closeBoard?.();
    const isTiqets = feature.properties?.source === 'tiqets';
    wikipediaLayer?.setActive(feature.properties?.wikidata ? feature : null);
    if (isTiqets) markBoardOpened(feature);
    const coords = feature.geometry?.coordinates;
    if (map && Array.isArray(coords) && coords.length === 2) {
      followingPosition = false;
      awaitingFirstPosition = false;
      cameraControls?.reset();
    }
    const alignment = createBoardMapAlignment(map, coords);
    // Keep both neighboring stories warm; errors never block navigation.
    const neighbors = new Map();
    for (const neighbor of [previous, next]) {
      if (neighbor?.properties?.wikidata && neighbor.properties?.url) neighbors.set(neighbor.properties.url, neighbor);
    }
    if (!isTiqets) for (const neighbor of neighbors.values()) preloadWikipediaBoard(neighbor).catch(() => {});
    if (boardSources.openBoard(feature, {onNext,onPrevious})) {
      alignment.destroy();
      wikipediaLayer?.setActive(null);
      return;
    }
    closeBoard = openBoardViewer(feature, { location, events,
      sourceBoard: isTiqets ? tiqetsBoard(feature, {store, events}) : null,
      onClose: () => { alignment.destroy(); closeBoard = null; wikipediaLayer?.setActive(null); },
      onLayout: alignment.onLayout,
      onNext, onPrevious });
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
  const earlyListeners = [];
  const listenEarly = (element, name, handler, options) => {
    if (!element?.addEventListener) return;
    element.addEventListener(name, handler, options);
    earlyListeners.push(() => element.removeEventListener(name, handler, options));
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
  listenEarly(readoutBar, 'touchstart', onFilterStart, { passive: true });
  listenEarly(readoutBar, 'touchend', onFilterEnd, { passive: true });
  listenEarly(readoutBar, 'touchcancel', () => { filterSwipe = null; }, { passive: true });
  listenEarly(filterBack, 'click', () => setFilterMode(false));
  setFilterMode(false);
  const tiqetsToggle = root.querySelector('[data-tiqets-toggle]');
  const tiqetsMessage = root.querySelector('[data-tiqets-status]');
  const tiqetsSetup = new AbortController();
  const setTiqetsState = (state, count = 0) => {
    if (disposed) return;
    tiqetsToggle.classList.toggle('is-fetching', state === 'loading');
    tiqetsToggle.setAttribute('aria-busy', String(state === 'loading'));
    const messages = {loading:'Tiqets laden…', empty:'Geen Tiqets-locaties in dit gebied.',
      zoom:'Zoom verder in voor Tiqets.', error:'Tiqets is tijdelijk niet bereikbaar.',
      unconfigured:'Tiqets wordt voorbereid.'};
    tiqetsMessage.textContent = state === 'ready' ? count + ' Tiqets-locaties' : (messages[state] || '');
  };
  // Status contains no credentials. Only an explicit source selection requests
  // the map centre; no personal store or invitation-network data is used.
  tiqetsStatus({signal:tiqetsSetup.signal}).then(configured => {
    if (disposed) return;
    tiqetsToggle.disabled = !configured;
    tiqetsToggle.title = configured ? 'Tiqets · musea en attracties' : 'Tiqets wordt voorbereid';
  }).catch(() => { if (!disposed) tiqetsToggle.title = 'Tiqets is momenteel niet beschikbaar'; });
  listenEarly(tiqetsToggle, 'click', () => {
    closeBoardOrder(root);
    tiqetsEnabled = !tiqetsEnabled;
    tiqetsToggle.setAttribute('aria-pressed', String(tiqetsEnabled));
    tiqetsLayer?.setEnabled(tiqetsEnabled);
    if (!tiqetsEnabled && document.querySelector('.sh-board-source[rel~="sponsored"]')) closeBoard?.();
  });
  const wikipediaToggle = root.querySelector("[data-wikipedia-toggle]");
  const updateWikipediaZoomCue = () => {
    if (!map) return;
    const zoom = map.getZoom();
    const strength = Math.max(0,Math.min(1,(zoom-7)/4));
    wikipediaToggle.style.setProperty("--wiki-zoom-strength",String(strength));
    wikipediaToggle.classList.toggle("is-zoom-distant",zoom<11);
    wikipediaToggle.setAttribute("aria-description",zoom<11 ? "Zoom verder in om nieuwe Wikipedia-gegevens op te halen" : "Wikipedia kan op dit zoomniveau gegevens ophalen");
  };
  const setWikipediaLoadState = state => {
    wikipediaToggle.classList.toggle("is-fetching",state==="loading");
    wikipediaToggle.setAttribute("aria-busy",String(state==="loading"));
    wikipediaToggle.title = state==="loading" ? "Wikipedia-gegevens ophalen" : "Wikipedia · omhoog slepen voor filters";
  };
  listenEarly(wikipediaToggle, "click", () => {
    closeBoardOrder(root);
    if (root.querySelector("[data-source-sheet]")?.classList.contains("is-open")) {
      root.querySelector("[data-source-sheet]").classList.remove("is-open");
      root.querySelector("[data-source-sheet]").setAttribute("aria-hidden","true");
      root.querySelector("[data-wiki-settings]")?.setAttribute("aria-expanded","false");
      return;
    }
    wikipediaEnabled = !wikipediaEnabled;
    wikipediaToggle.setAttribute("aria-pressed", String(wikipediaEnabled));
    wikipediaLayer?.setEnabled(wikipediaEnabled);
  });
  const refreshGlobalWikiCounts = () => {
    const totals = {read:0,liked:0,disliked:0,hidden:0};
    try {
      for (let i=0;i<localStorage.length;i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('sharon.wiki.feedback.v1:')) continue;
        let state; try { state=JSON.parse(localStorage.getItem(key)||'{}'); } catch {continue;}
        if (state.read) totals.read++;
        if (state.liked) totals.liked++;
        if (state.disliked) totals.disliked++;
        if (state.hidden) totals.hidden++;
      }
    } catch {}
    for (const [key,value] of Object.entries(totals)) {
      const target=root.querySelector('[data-wiki-global="'+key+'"]');
      if(target) { target.textContent=value ? String(value) : ""; target.hidden=!value; target.parentElement.hidden=!value; }
    }
    const disliked=root.querySelector('[data-wiki-disliked]');
    if(disliked) disliked.textContent=totals.disliked+' niet leuk';
  };
  const refreshWikiCategoryCounts = event => {
    const detail=event.detail||{};
    const available=root.querySelector('[data-wiki-available]');
    if(available) available.textContent=(detail.total||0)+' beschikbaar';
    for (const [key,count] of Object.entries(detail.groups||{})) {
      const node=root.querySelector('[data-wiki-category-count="'+key+'"]');
      const total=root.querySelector('[data-wiki-category-total="'+key+'"]');
      if(total) total.textContent=count.total ? String(count.total) : '';
      if(node) {
        const parts=[['☑',count.read,'Gelezen'],['♡',count.liked,'Leuk'],['♧',count.disliked,'Niet leuk'],['◌',count.hidden,'Verborgen']].filter(([,value])=>value>0);
        node.textContent=parts.map(([icon,value])=>icon+' '+value).join('   ');
        node.title=parts.map(([,value,label])=>label+': '+value).join(', ');
        node.hidden=parts.length===0;
      }
    }
  };
  listenEarly(window,'sharon-wiki-counts-changed',refreshWikiCategoryCounts);
  listenEarly(window,'sharon-wiki-feedback-changed',refreshGlobalWikiCounts);
  refreshGlobalWikiCounts();
  const sourceSheet = root.querySelector('[data-source-sheet]');
  const sourceSettings = root.querySelector('[data-wiki-settings]');
  const savedSourceFilters = (() => {
    try { return JSON.parse(localStorage.getItem('sharon.source.wikipedia.filters.v1') || '{}'); }
    catch { return {}; }
  })();
  const syncBoardOrder = () => wikipediaLayer?.setSort(boardOrderMode());
  unsubscribers.push(mountBoardOrderControls(root));
  listenEarly(window,BOARD_ORDER_EVENT,syncBoardOrder);
  const activeWikiFilters = new Set((Array.isArray(savedSourceFilters.statuses) ? savedSourceFilters.statuses : []).filter(value=>value!=='unread'));
  const activeWikiCategories = new Set(Array.isArray(savedSourceFilters.categories) ? savedSourceFilters.categories : []);
  const syncWikiFilters = () => {
    for (const button of root.querySelectorAll('[data-wiki-filter]')) button.setAttribute('aria-pressed',String(activeWikiFilters.has(button.dataset.wikiFilter)));
    for (const button of root.querySelectorAll('[data-wiki-category]')) button.setAttribute('aria-pressed',String(activeWikiCategories.has(button.dataset.wikiCategory)));
    sourceSettings.classList.toggle('has-active-filters',activeWikiFilters.size + activeWikiCategories.size > 0);
    syncBoardOrder();
    wikipediaLayer?.setFilters([...activeWikiFilters],[...activeWikiCategories]);
    try { localStorage.setItem('sharon.source.wikipedia.filters.v1',JSON.stringify({statuses:[...activeWikiFilters],categories:[...activeWikiCategories]})); } catch {}
  };
  const toggleSourceSheet = value => {
    if(value) {closeBoardOrder(root);const places=root.querySelector('[data-places-sheet]');places?.classList.remove('is-open');places?.setAttribute('aria-hidden','true');root.querySelector('[data-chain-toggle]')?.setAttribute('aria-expanded','false');}
    sourceSheet.classList.toggle('is-open',value);
    sourceSheet.setAttribute('aria-hidden',String(!value));
    sourceSettings.setAttribute('aria-expanded',String(value));
  };
  listenEarly(sourceSettings,'click',()=>toggleSourceSheet(!sourceSheet.classList.contains('is-open')));
  for (const [attribute,selection] of [['data-wiki-filter',activeWikiFilters],['data-wiki-category',activeWikiCategories]]) {
    for (const button of root.querySelectorAll('['+attribute+']')) listenEarly(button,'click',()=>{
      const value = button.getAttribute(attribute);
      if (selection.has(value)) selection.delete(value); else selection.add(value);
      syncWikiFilters();
    });
  }
  let sourceGesture = null;
  listenEarly(wikipediaToggle,'touchstart',event=>{
    const touch=event.touches[0]; if(touch) sourceGesture={y:touch.clientY,handled:false};
  },{passive:true});
  listenEarly(wikipediaToggle,'touchend',event=>{
    if (!sourceGesture) return;
    const touch=event.changedTouches[0];
    if(touch && sourceGesture.y-touch.clientY>35) {
      sourceGesture.handled=true;
      toggleSourceSheet(true);
    }
  },{passive:true});
  listenEarly(wikipediaToggle,'click',event=>{
    if(sourceGesture?.handled) {event.stopImmediatePropagation();sourceGesture=null;}
  },true);
  let sheetGesture = null;
  listenEarly(sourceSheet,'touchstart',event=>{const touch=event.touches[0];if(touch)sheetGesture=touch.clientY;},{passive:true});
  listenEarly(sourceSheet,'touchend',event=>{
    if(sheetGesture!==null && event.changedTouches[0]?.clientY-sheetGesture>70) toggleSourceSheet(false);
    sheetGesture=null;
  },{passive:true});
  syncWikiFilters();
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
      // Short linked credits remain visible, including credits from extra sources.
       attributionControl: { compact: false },
      renderWorldCopies: true
    });
    registerCameraDiagnostics(map);
    // A small independent MapLibre control shares the attribution rail.
    // Only the shell's visible chrome changes, never the map or its sources.
    map.addControl(createEnvironmentVisibilityControl(root.closest?.('.app-stage')), 'bottom-right');

    const render = () => {
      if (!disposed && map) { updateReadout(map, userPoint, scaleButton, readout); updateWikipediaZoomCue(); }
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
      map.getSource('sharon-objects')?.setData(environmentGeoJSON(objects.filter(item=>item.type==='location'?(chainLayer?.allowsLocation(item)??!placeHidden(item)):!placeHidden(item))));
    };

    map.on('load', () => {
      if (disposed) return;
      mapReady = true;
      unsubscribers.push(mountPlacePulse(map));
      const refreshPlaces=event=>{updateObjects().catch(()=>{});if(event.detail?.hidden)window.dispatchEvent(new CustomEvent('sharon-place-board-active',{detail:{point:null}}));};
      window.addEventListener('sharon-place-feedback-changed',refreshPlaces);
      window.addEventListener('sharon-chain-filters-changed',refreshPlaces);
      unsubscribers.push(()=>window.removeEventListener('sharon-chain-filters-changed',refreshPlaces));
      unsubscribers.push(()=>window.removeEventListener('sharon-place-feedback-changed',refreshPlaces));
      updateWikipediaZoomCue();
      reportDiagnosticStatus('kaartstijl geladen');
      errorBanner.hidden = true;
      installSharonLayers(map);
      chainLayer=mountChainLayer(map,lib,{store,events,location,root,initialChainId,onFocus:()=>{followingPosition=false;awaitingFirstPosition=false;cameraControls?.reset();},onOpen:showBoard,beforeOpen:()=>{closeBoard?.();closeLocationDeck?.();popup?.remove();}});
      wikipediaLayer = mountWikipediaLayer(map, lib, { language: navigator.language?.split("-")[0] || "nl", onOpen: showBoard, onLoadState: setWikipediaLoadState });
      tiqetsLayer = mountTiqetsLayer(map, {onOpen:showBoard, onState:setTiqetsState});
      for (const source of [chainLayer, wikipediaLayer, tiqetsLayer]) unsubscribers.push(boardSources.register(source));
      if (tiqetsEnabled) tiqetsLayer.setEnabled(true);
      syncWikiFilters();
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

    map.on('click', async event => {
      if (!mapReady || chainLayer?.handles(event) || wikipediaLayer?.handles(event) || tiqetsLayer?.handles(event)) return;
      chainLayer?.closeBoard();
      closeBoard?.();
      try {
      // A finger tap often lands just outside the tiny point circle on iPad/iPhone.
      const radius = 18;
      const box = [[event.point.x-radius,event.point.y-radius],[event.point.x+radius,event.point.y+radius]];
      const features = map.queryRenderedFeatures(box, { layers: LOCAL_LAYERS });
      // Prefer a location point over overlapping polygons/lines so tapping its marker opens its Board.
      let selected = features.find(feature => feature.properties?.kind === 'location') || features[0];
      if (selected?.properties?.kind !== 'location') {
        const items = await store.getAll('objects');
        const nearest = items.filter(item => item.type === 'location' && !item.deletedAt && (chainLayer?.allowsLocation(item)??!placeHidden(item)) && isCoordinate(item.data?.coordinates))
          .map(item => ({item, point: map.project(coordinateArray(item.data.coordinates))}))
          .find(({point}) => Math.hypot(point.x - event.point.x, point.y - event.point.y) < 24);
        if (nearest) selected = {geometry:{type:'Point',coordinates:coordinateArray(nearest.item.data.coordinates)},properties:{kind:'location',id:String(nearest.item.id)}};
      }
      if (!selected) return;
      popup?.remove();
      closeLocationDeck?.();
      closeLocationDeck = null;
      if (selected.properties?.kind === 'location') {
        const shared=boardSources.getBoards().find(item=>item.type==='location'&&String(item.id)===String(selected.properties.id));
        if(shared){showBoard(shared);return;}
        const objects = await store.getAll('objects');
        if (disposed) return;
        closeLocationDeck = openLocationDeck({ store, objects, selected, map, location, events,
          onClose: () => { closeLocationDeck = null; },
          onLocation: item => {
            followingPosition = false; awaitingFirstPosition = false; cameraControls?.reset();
            const point = item.data?.coordinates;
            if (point && Number.isFinite(Number(point.lng)) && Number.isFinite(Number(point.lat))) {
              map.easeTo({center:[Number(point.lng),Number(point.lat)],offset:[0,-map.getContainer().clientHeight*0.27],duration:650,essential:true});
            }
          }
        });
      } else {
        const element = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = String(selected.properties?.title || 'Object');
        element.append(heading);
        popup = new lib.Popup({closeButton:true,maxWidth:'240px'})
          .setLngLat(event.lngLat).setDOMContent(element).addTo(map);
      }
      } catch (error) {
        console.error('Locatiekaart openen mislukt', error);
        errorBanner.hidden = false;
        errorBanner.textContent = 'Locatiekaart openen mislukt: ' + (error?.message || 'onbekende fout');
      }
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
    mapElement.removeEventListener('sharon:viewport-resize',onViewportResize);
    for (const detach of earlyListeners) detach();
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
    closeLocationDeck?.();
    tiqetsSetup.abort();
    tiqetsLayer?.destroy();
    wikipediaLayer?.destroy();
    chainLayer?.destroy();
    closeBoard?.();
    gpsMarker?.remove();
    map?.remove();
  };
}
