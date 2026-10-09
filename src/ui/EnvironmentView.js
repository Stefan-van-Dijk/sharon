import {
  environmentBoundsForId,
  environmentPointId,
  environmentTileId
} from '../core/location/EnvironmentIdentifier.js?v=0.1.49';

const SCALES = Object.freeze([
  { id: 'near', label: 'Dichtbij', spanM: 70, cellM: 10 },
  { id: 'detail', label: 'Detail', spanM: 220, cellM: 25 },
  { id: 'street', label: 'Straat', spanM: 700, cellM: 100 },
  { id: 'district', label: 'Wijk', spanM: 3000, cellM: 500 },
  { id: 'place', label: 'Plaats', spanM: 15000, cellM: 2500 },
  { id: 'region', label: 'Regio', spanM: 70000, cellM: 10000 },
  { id: 'country', label: 'Land', spanM: 700000, cellM: 100000 }
]);

const VIEW = 1000;
const CENTER = VIEW / 2;
const EARTH_RADIUS_M = 6371000;
const LINE_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const ENVIRONMENT_TILE_ENDPOINT = 'https://sharon.life/environment/api/tiles.php';
const ENVIRONMENT_BUNDLE_ENDPOINT = 'https://sharon.life/environment/api/bundle.php';
let sharedTileEndpointState = 'unknown';
const decodedTileCache = new Map();
const inFlightTiles = new Map();
const MAX_MEMORY_TILES = 128;
const DETAIL_LIMIT_M = 3000;
function rememberTile(key, features) {
  decodedTileCache.delete(key);
  decodedTileCache.set(key, features);
  if (decodedTileCache.size > MAX_MEMORY_TILES) decodedTileCache.delete(decodedTileCache.keys().next().value);
  return features;
}
const OVERPASS_ENDPOINTS = Object.freeze([
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
]);

export async function openEnvironmentView(root, {
  store,
  location,
  events,
  setTitle = () => {}
}) {
  setTitle('Omgeving');

  let scaleIndex = SCALES.findIndex(item => item.id === 'street');
  let scale = SCALES[scaleIndex];
  let displaySpanM = scale.spanM;
  let point = location.latest;
  let viewCenter = point ? {
    lat: Number(point.lat),
    lng: Number(point.lng)
  } : null;
  let followingPosition = Boolean(viewCenter);
  let objects = await store.getAll('objects');
  let locations = activeLocations(objects);
  let checking = false;
  let lineFeatures = [];
  let lineState = 'idle';
  let lineContextKey = '';
  let pendingLineKey = '';
  let geometryRevision = 0;
  let lastVectorPaintKey = '';
  let lineLoadToken = 0;
  let lineTimer = null;
  let pinch = null;
  let pan = null;
  let mousePan = false;
  let wheelTotal = 0;
  let wheelTimer = null;
  let zoomFrame = 0;
  let zoomPending = null;

  root.innerHTML = `
    <section class="module-view environment-view">
      <div class="environment-canvas" data-environment-canvas>
        <div class="environment-map" data-environment-map><canvas class="environment-vector-canvas" data-vector-canvas aria-hidden="true"></canvas></div>

        <button
          type="button"
          class="environment-scale-chip"
          data-environment-scale
          aria-label="Schaal wijzigen"
        ></button>

        <button
          type="button"
          class="environment-refresh"
          data-environment-refresh
          aria-label="Huidige positie opnieuw bepalen"
        >
          Positie
        </button>

        <div class="environment-readout" data-environment-readout></div>

        <div class="environment-source" data-environment-source></div>

        <div class="environment-pinch-hint" data-environment-pinch-hint>
          Sleep om te bewegen · knijp om te zoomen
        </div>
      </div>
    </section>
  `;

  const canvas = root.querySelector('[data-environment-canvas]');
  const map = root.querySelector('[data-environment-map]');
  const vectorCanvas = root.querySelector('[data-vector-canvas]');
  const readout = root.querySelector('[data-environment-readout]');
  const refreshButton = root.querySelector('[data-environment-refresh]');
  const scaleButton = root.querySelector('[data-environment-scale]');
  const source = root.querySelector('[data-environment-source]');
  const pinchHint = root.querySelector('[data-environment-pinch-hint]');

  const render = () => {
    scaleButton.textContent = `${scale.label} · ${formatDistance(displaySpanM)}`;

    if (!point) {
      map.innerHTML = `
        <div class="environment-empty">
          <span class="environment-position-mark" aria-hidden="true"></span>
          <strong>Positie nog niet bekend</strong>
          <small>Gebruik ‘Positie’ om je omgeving te bepalen.</small>
        </div>
      `;
      readout.innerHTML = '';
      source.innerHTML = '';
      return;
    }

    if (!viewCenter) {
      viewCenter = {
        lat: Number(point.lat),
        lng: Number(point.lng)
      };
    }

    const model = environmentModel(
      point,
      viewCenter,
      locations,
      lineFeatures,
      { ...scale, spanM: displaySpanM },
      []
    );
    if (!vectorCanvas.isConnected) map.prepend(vectorCanvas);
    map.querySelector('.environment-svg')?.remove();
    map.insertAdjacentHTML('beforeend', model.svg);
    const paintKey = `${viewCenter.lat.toFixed(6)}:${viewCenter.lng.toFixed(6)}:${displaySpanM}:${geometryRevision}`;
    if (paintKey !== lastVectorPaintKey) {
      drawVectorCanvas(vectorCanvas, model.linePaths);
      lastVectorPaintKey = paintKey;
    }
    readout.innerHTML = environmentReadout(model, point);

    if (lineState === 'loading') {
      source.textContent = 'Lijnen laden…';
    } else if (lineState === 'ready') {
      source.innerHTML =
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>';
    } else if (lineState === 'error') {
      source.textContent = 'Lijnen tijdelijk niet beschikbaar';
    } else {
      source.textContent = '';
    }
  };

  const scheduleLines = () => {
    lineLoadToken += 1;
    pendingLineKey = '';
    if (lineTimer) clearTimeout(lineTimer);
    lineTimer = setTimeout(() => {
      lineTimer = null;
      loadLines().catch(() => {});
    }, 180);
  };

  const loadLines = async () => {
    if (!viewCenter) return;

    const requestedCenter = { ...viewCenter };
    const requestedScale = { ...scale, spanM: displaySpanM };
    const plan = environmentTilePlan(requestedCenter, requestedScale, canvas);
    const requestedKey = plan.key;

    if (requestedKey === lineContextKey) {
      lineState = lineFeatures.length ? 'ready' : 'idle';
      render();
      return;
    }
    if (requestedKey === pendingLineKey) return;

    const token = ++lineLoadToken;
    pendingLineKey = requestedKey;
    lineState = 'loading';
    render();

    try {
      const features = await loadEnvironmentLines(
        store,
        requestedCenter,
        requestedScale,
        canvas,
        partial => {
          if (token !== lineLoadToken) return;
          if (partial.length) {
            lineFeatures = partial;
            geometryRevision += 1;
          }
          lineState = partial.length ? 'ready' : 'loading';
          render();
        },
        plan
      );

      if (token !== lineLoadToken) return;

      lineFeatures = features;
      geometryRevision += 1;
      lineContextKey = requestedKey;
      pendingLineKey = '';
      lineState = features.length ? 'ready' : 'idle';

      render();

      return;
    } catch {
      if (token !== lineLoadToken) return;
      pendingLineKey = '';
      lineState = 'error';
    }

    render();
  };

  const setScaleIndex = nextIndex => {
    const clamped = Math.max(0, Math.min(SCALES.length - 1, nextIndex));
    if (clamped === scaleIndex) return false;

    scaleIndex = clamped;
    scale = SCALES[scaleIndex];
    displaySpanM = scale.spanM;
    lineState = 'idle';
    render();
    scheduleLines();
    return true;
  };

  const setZoomSpan = span => {
    const next = Math.max(SCALES[0].spanM, Math.min(SCALES[SCALES.length - 1].spanM, span));
    displaySpanM = next;
    const nextIndex = SCALES.reduce((best, item, index) =>
      Math.abs(Math.log(item.spanM / next)) < Math.abs(Math.log(SCALES[best].spanM / next)) ? index : best, 0);
    if (nextIndex !== scaleIndex) {
      scaleIndex = nextIndex;
      scale = SCALES[nextIndex];
    }
    scheduleLines();
    render();
  };

  const refresh = async () => {
    if (checking) return;

    checking = true;
    refreshButton.disabled = true;
    refreshButton.textContent = 'Bepalen…';

    try {
      point = await location.checkNow({
        reason: 'environment',
        maxAgeMs: 0,
        highAccuracy: true,
        browserMaxAgeMs: 0,
        timeoutMs: 10_000
      });

      viewCenter = {
        lat: Number(point.lat),
        lng: Number(point.lng)
      };
      followingPosition = true;

      objects = await store.getAll('objects');
      locations = activeLocations(objects);
      lineState = 'idle';
      render();
      scheduleLines();

    } catch (error) {
      map.innerHTML = `
        <div class="environment-empty">
          <strong>Positie niet beschikbaar</strong>
          <small>${escapeHtml(error.message)}</small>
        </div>
      `;
    } finally {
      checking = false;
      refreshButton.disabled = false;
      refreshButton.textContent = 'Positie';
    }
  };

  const hideHint = () => {
    pinchHint.classList.add('is-hidden');
  };

  const startPan = (clientX, clientY) => {
    if (!viewCenter) return false;

    pan = {
      startX: clientX,
      startY: clientY,
      dx: 0,
      dy: 0,
      startCenter: { ...viewCenter }
    };

    canvas.classList.add('is-panning');
    hideHint();
    return true;
  };

  const previewPan = (clientX, clientY) => {
    if (!pan) return;

    pan.dx = clientX - pan.startX;
    pan.dy = clientY - pan.startY;
    map.style.transform =
      `translate3d(${pan.dx}px,${pan.dy}px,0)`;
  };

  const finishPan = () => {
    if (!pan) return;

    const moved = Math.hypot(pan.dx, pan.dy);

    if (moved >= 2) {
      viewCenter = panCenterFromPixels(
        pan.startCenter,
        pan.dx,
        pan.dy,
        canvas,
        scale
      );
      followingPosition = false;

      const nextKey = environmentTilePlan(viewCenter, { ...scale, spanM: displaySpanM }, canvas).key;
      const sameLineArea = nextKey === lineContextKey;

      if (!sameLineArea) lineState = 'loading';

      render();
      if (!sameLineArea) scheduleLines();
    }

    map.style.transform = '';
    canvas.classList.remove('is-panning');
    pan = null;
  };

  const cancelPan = () => {
    map.style.transform = '';
    canvas.classList.remove('is-panning');
    pan = null;
  };

  const onTouchStart = event => {
    if (event.touches.length === 2) {
      cancelPan();

      const distance = touchDistance(
        event.touches[0],
        event.touches[1]
      );
      if (!distance) return;

      pinch = {
        startDistance: distance,
        startSpan: displaySpanM,
        ratio: 1
      };

      canvas.classList.add('is-pinching');
      hideHint();

      if (event.cancelable) event.preventDefault();
      return;
    }

    if (event.touches.length !== 1 || pinch) return;
    if (event.target.closest('button,a')) return;

    const touch = event.touches[0];
    const bounds = canvas.getBoundingClientRect();
    const xInside = touch.clientX - bounds.left;

    // Reserve the left edge for Sharon's swipe-back gesture.
    if (xInside <= 104) return;

    startPan(touch.clientX, touch.clientY);
  };

  const onTouchMove = event => {
    if (pinch && event.touches.length === 2) {
      const distance = touchDistance(
        event.touches[0],
        event.touches[1]
      );
      if (!distance) return;

      pinch.ratio = distance / pinch.startDistance;

      zoomPending = pinch.startSpan / Math.max(0.1, pinch.ratio);
      if (!zoomFrame) zoomFrame = requestAnimationFrame(() => {
        zoomFrame = 0;
        if (zoomPending !== null) setZoomSpan(zoomPending);
        zoomPending = null;
      });

      if (event.cancelable) event.preventDefault();
      return;
    }

    if (pan && event.touches.length === 1) {
      const touch = event.touches[0];
      previewPan(touch.clientX, touch.clientY);

      if (event.cancelable) event.preventDefault();
    }
  };

  const finishPinch = () => {
    if (!pinch) return;

    const ratio = pinch.ratio;
    const nextSpan = pinch.startSpan / Math.max(0.1, ratio);
    if (zoomFrame) cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
    zoomPending = null;

    map.style.transform = '';
    canvas.classList.remove('is-pinching');

    if (Math.abs(ratio - 1) >= 0.1) {
      setZoomSpan(nextSpan);
    }

    pinch = null;
  };

  const onTouchEnd = event => {
    if (pinch && event.touches.length < 2) {
      finishPinch();
      return;
    }

    if (pan && event.touches.length === 0) {
      finishPan();
    }
  };

  const onTouchCancel = () => {
    if (pinch) {
      map.style.transform = '';
      canvas.classList.remove('is-pinching');
      pinch = null;
    }
    cancelPan();
  };

  const onMouseDown = event => {
    if (event.button !== 0) return;
    if (event.target.closest('button,a')) return;

    if (startPan(event.clientX, event.clientY)) {
      mousePan = true;
      event.preventDefault();
    }
  };

  const onMouseMove = event => {
    if (!mousePan || !pan) return;
    previewPan(event.clientX, event.clientY);
  };

  const onMouseUp = () => {
    if (!mousePan) return;
    mousePan = false;
    finishPan();
  };

  const onWheel = event => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    hideHint();
    wheelTotal += event.deltaY;

    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      if (Math.abs(wheelTotal) > 2) {
        setZoomSpan(displaySpanM * Math.exp(Math.max(-1, Math.min(1, wheelTotal / 350))));
      }
      wheelTotal = 0;
      wheelTimer = null;
    }, 70);
  };

  refreshButton.addEventListener('click', refresh);

  scaleButton.addEventListener('click', () => {
    hideHint();
    setScaleIndex((scaleIndex + 1) % SCALES.length);
  });

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  canvas.addEventListener('touchcancel', onTouchCancel, { passive: true });
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const offLocation = events.on('location.changed', event => {
    const nextPoint = event.detail;
    point = nextPoint;

    if (followingPosition || !viewCenter) {
      viewCenter = {
        lat: Number(nextPoint.lat),
        lng: Number(nextPoint.lng)
      };

      const nextKey = environmentTilePlan(viewCenter, { ...scale, spanM: displaySpanM }, canvas).key;
      const sameLineArea = nextKey === lineContextKey;

      if (!sameLineArea) lineState = 'loading';

      render();
      if (!sameLineArea) scheduleLines();
      return;
    }

    render();
  });

  const refreshLocations = async () => {
    objects = await store.getAll('objects');
    locations = activeLocations(objects);
    render();
  };

  const offCreated = events.on('location.created', refreshLocations);
  const offUpdated = events.on('location.updated', refreshLocations);
  const offDeleted = events.on('location.deleted', refreshLocations);

  render();

  if (!point) {
    refresh().catch(() => {});
  } else if (viewCenter) {
    scheduleLines();

  }

  const hintTimer = setTimeout(hideHint, 4200);

  return () => {
    if (lineTimer) clearTimeout(lineTimer);
    if (wheelTimer) clearTimeout(wheelTimer);
    if (zoomFrame) cancelAnimationFrame(zoomFrame);
    clearTimeout(hintTimer);

    lineLoadToken += 1;

    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchCancel);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);

    offLocation();
    offCreated();
    offUpdated();
    offDeleted();
  };
}

function environmentModel(
  point,
  viewCenter,
  locations,
  lineFeatures,
  scale,
  overlayLines = []
) {
  const projection = localProjection(viewCenter.lat);
  const centerX = projection.x(viewCenter.lng);
  const centerY = projection.y(viewCenter.lat);
  const metersPerUnit = scale.spanM / VIEW;
  const halfSpan = scale.spanM / 2;

  const grid = buildGrid({
    centerX,
    centerY,
    cellM: scale.cellM,
    metersPerUnit
  });

  const visibleLocations = locations
    .map(item => {
      const coordinates = item.data?.coordinates ?? {};
      const lat = Number(coordinates.lat);
      const lng = Number(coordinates.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const dx = projection.x(lng) - centerX;
      const dy = projection.y(lat) - centerY;
      const distanceM = distanceBetween(point, { lat, lng });

      if (Math.abs(dx) > halfSpan || Math.abs(dy) > halfSpan) return null;

      return {
        id: item.id,
        title: item.data?.title || 'Locatie',
        x: CENTER + dx / metersPerUnit,
        y: CENTER - dy / metersPerUnit,
        distanceM
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM);

  const nearest = locations
    .map(item => {
      const coordinates = item.data?.coordinates ?? {};
      const lat = Number(coordinates.lat);
      const lng = Number(coordinates.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        title: item.data?.title || 'Locatie',
        distanceM: distanceBetween(point, { lat, lng })
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM)[0] || null;

  const currentCell = cellFor(viewCenter, scale.cellM);
  const userPosition = projectPoint({
    point,
    projection,
    centerX,
    centerY,
    metersPerUnit
  });

  const overlayPaths = projectLineFeatures({ features: overlayLines, projection, centerX, centerY, metersPerUnit });
  const linePaths = projectLineFeatures({
    features: lineFeatures,
    projection,
    centerX,
    centerY,
    metersPerUnit
  });

  return {
    linePaths,
    svg: environmentSvg({
      grid,
      linePaths,
      overlayPaths,
      locations: visibleLocations,
      userPosition,
      scale,
      currentCell
    }),
    currentCell,
    areaId: environmentTileId(viewCenter, scale.id),
    pointId: environmentPointId(point),
    nearest,
    visibleCount: visibleLocations.length,
    scale
  };
}

const CANVAS_LINE_STYLES = {
  building: ['#dedee1', .8], path: ['#d0d0d4', .9, [3, 4]],
  road: ['#bdbdc2', 1.05], major: ['#737378', 1.65],
  rail: ['#a1a1a6', 1.15, [6, 3]], water: ['#c7c7cc', 1.25],
  boundary: ['#d6d6da', .9, [7, 5]]
};

function drawVectorCanvas(canvas, paths) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width, height = rect.height;
  if (!width || !height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const scale = Math.max(width, height) / VIEW;
  ctx.translate((width - VIEW * scale) / 2, (height - VIEW * scale) / 2);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const item of paths) {
    const [color, lineWidth, dash = []] = CANVAS_LINE_STYLES[item.type] || CANVAS_LINE_STYLES.road;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth / scale;
    ctx.setLineDash(dash.map(value => value / scale));
    ctx.stroke(new Path2D(item.d));
  }
  ctx.setLineDash([]);
}

function environmentSvg({
  grid,
  linePaths,
  overlayPaths = [],
  locations,
  userPosition,
  scale,
  currentCell
}) {
  const lineMarkup = ''; // Base vector geometry is rendered on Canvas 2D.

  const locationMarkup = locations.map((item, index) => {
    const anchor = index < 4;
    const labelX = Math.min(VIEW - 12, item.x + 14);
    const labelY = Math.max(16, item.y - 10);

    return `
      <g class="environment-location" data-location-id="${escapeAttribute(item.id)}">
        <circle cx="${round(item.x)}" cy="${round(item.y)}" r="${anchor ? 7 : 5}"></circle>
        ${anchor ? `
          <text x="${round(labelX)}" y="${round(labelY)}">${escapeHtml(item.title)}</text>
        ` : ''}
      </g>
    `;
  }).join('');

  return `
    <svg
      class="environment-svg"
      viewBox="0 0 ${VIEW} ${VIEW}"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Schematische weergave van je omgeving"
      data-cell-id="${escapeAttribute(currentCell.id)}"
    >
      <rect class="environment-current-cell" x="${grid.currentCell.x}" y="${grid.currentCell.y}" width="${grid.currentCell.size}" height="${grid.currentCell.size}"></rect>

      <g class="environment-grid">
        ${grid.vertical.map(x => `<line x1="${x}" y1="0" x2="${x}" y2="${VIEW}"></line>`).join('')}
        ${grid.horizontal.map(y => `<line x1="0" y1="${y}" x2="${VIEW}" y2="${y}"></line>`).join('')}
      </g>

      <g class="environment-lines">
        ${lineMarkup}
        ${overlayPaths.map(item => `<path class="environment-line environment-line--${item.type}" d="${item.d}" opacity="0.4" stroke-dasharray="5 2"></path>`).join('')}
      </g>

      ${locationMarkup}

      ${userPosition.visible ? `
        <g class="environment-you">
          <circle class="environment-you-ring" cx="${round(userPosition.x)}" cy="${round(userPosition.y)}" r="18"></circle>
          <circle class="environment-you-dot" cx="${round(userPosition.x)}" cy="${round(userPosition.y)}" r="6"></circle>
        </g>
      ` : ''}

      <g class="environment-scale-mark">
        <line x1="34" y1="946" x2="194" y2="946"></line>
        <line x1="34" y1="938" x2="34" y2="954"></line>
        <line x1="194" y1="938" x2="194" y2="954"></line>
        <text x="34" y="928">${formatDistance(scale.spanM * 0.16)}</text>
      </g>
    </svg>
  `;
}

function environmentReadout(model, point) {
  const nearest = model.nearest
    ? `${escapeHtml(model.nearest.title)} · ${formatDistance(model.nearest.distanceM)}`
    : 'Geen opgeslagen locatie in de buurt';

  return `
    <div>
      <span>Nu</span>
      <strong>${nearest}</strong>
      <small>GPS ±${Math.round(Number(point.accuracy) || 0)} m · punt ${escapeHtml(model.pointId)}</small>
    </div>
    <div>
      <span>Gebied</span>
      <strong class="mono">${escapeHtml(model.areaId)}</strong>
      <small>${formatDistance(model.scale.spanM)}</small>
    </div>
  `;
}

// Cache by visible tile set instead of tiny camera position changes.
function environmentTilePlan(center, scale, canvas) {
  if (scale.id === 'country') return { ids: [], level: 0, scaleId: 'country', key: 'country' };
  let level = scale.spanM <= DETAIL_LIMIT_M ? 3 : scale.spanM <= 70000 ? 2 : 1;
  let ids = viewportTileIds(center, scale.spanM, canvas, level);
  while (level > 1 && (!ids || ids.length > 9)) {
    level -= 1;
    ids = viewportTileIds(center, scale.spanM, canvas, level);
  }
  ids = ids || [];
  const scaleId = level === 3 ? 'detail' : level === 2 ? 'place' : 'country';
  const filter = scale.spanM > DETAIL_LIMIT_M ? 'overview' : 'all';
  return { ids, level, scaleId, key: `${filter}:${level}:${ids.join(',')}` };
}

function viewportTileIds(center, spanM, canvas, level) {
  const rect = canvas?.getBoundingClientRect();
  const aspect = rect?.width && rect?.height ? rect.width / rect.height : 1;
  const halfLatM = spanM * Math.min(1, 1 / aspect) / 2;
  const halfLonM = spanM * Math.min(1, aspect) / 2;
  const south = Math.max(-89.999, center.lat - halfLatM / 111320);
  const north = Math.min(89.999, center.lat + halfLatM / 111320);
  const lonMeters = Math.max(1, 111320 * Math.cos(center.lat * Math.PI / 180));
  const west = center.lng - halfLonM / lonMeters;
  const east = center.lng + halfLonM / lonMeters;
  const columns = Math.pow(64, level);
  const rows = columns;
  const x0 = Math.floor((west + 180) / 360 * columns);
  const x1 = Math.floor((east + 180) / 360 * columns);
  const y0 = Math.max(0, Math.floor((south + 90) / 180 * rows));
  const y1 = Math.min(rows - 1, Math.floor((north + 90) / 180 * rows));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const idFor = (x, y) => {
    let id = '';
    for (let power = level - 1; power >= 0; power--) {
      const divisor = Math.pow(64, power);
      id += alphabet[Math.floor(x / divisor) % 64] + alphabet[Math.floor(y / divisor) % 64];
    }
    return id;
  };
  const ids = [];
  // Guard against pathological zoom / polar requests.
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 1024) return null;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    ids.push(idFor(((x % columns) + columns) % columns, y));
  }
  return [...new Set(ids)].sort((a,b) => {
    const mid = environmentTileId(center, level === 3 ? 'detail' : level === 2 ? 'place' : 'country');
    const score = id => [...id].reduce((n,c,i) => n + (c === mid[i] ? 0 : 1),0);
    return score(a) - score(b);
  });
}

const tileLoadFailures = new Map();
async function loadEnvironmentLines(store, center, scale, canvas, onProgress = () => {}, plan = environmentTilePlan(center, scale, canvas)) {
  // Precise identifiers remain independent from bounded map-tile levels.
  const { ids, scaleId } = plan;
  if (!ids.length) return [];
  const results = new Array(ids.length);
  let lastEmit = 0;
  const emit = (force = false) => {
    if (!force && Date.now() - lastEmit < 250) return null;
    lastEmit = Date.now();
    const seen = new Set();
    const features = results.flatMap(item => item || []).filter(feature => {
      if (scale.spanM > DETAIL_LIMIT_M && !['major', 'boundary', 'rail', 'water'].includes(feature.type)) return false;
      const key = feature.id || `${feature.type}:${feature.points?.map(p => p.lat + ',' + p.lng).join(';')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    onProgress(features);
    return features;
  };
  // First pass: display all already cached tiles without waiting for the network.
  await Promise.all(ids.map(async (id, index) => {
    const key = `environment-tile:v5:${id}`;
    const memory = decodedTileCache.get(key);
    if (memory) { results[index] = memory; return; }
    const local = await store.get('meta', key).catch(() => null);
    if (Array.isArray(local?.value?.features) && Date.now() - Number(local.value.at || 0) < LINE_CACHE_MAX_AGE) {
      results[index] = rememberTile(key, local.value.features);
    }
  }));
  emit(true);
  const missing = ids.map((id, index) => ({ id, index })).filter(({ index }) => !results[index]);
  // Batch read existing tiles in one request. If bundle.php is not installed
  // yet, or reports missing areas, the original per-tile endpoint remains usable.
  if (missing.length > 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      let response;
      try {
        response = await fetch(`${ENVIRONMENT_BUNDLE_ENDPOINT}?ids=${encodeURIComponent(missing.map(item => item.id).join(','))}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (response.ok) {
        const bundle = await response.json();
        if (bundle.schema === 'https://sharon.life/environment/bundle/v1' && Array.isArray(bundle.tiles)) {
          const wanted = new Map(missing.map(item => [item.id, item.index]));
          for (const tile of bundle.tiles) {
            if (!wanted.has(tile.id) || tile.schema !== 'https://sharon.life/environment/tile/v2') continue;
            const index = wanted.get(tile.id);
            const decoded = decodeEnvironmentV2(tile, scaleId);
            results[index] = rememberTile(`environment-tile:v5:${tile.id}`, decoded.features);
            store.put('meta', {
              key: `environment-tile:v5:${tile.id}`,
              value: { at: Date.now(), features: decoded.features }
            }).catch(() => {});
          }
          emit(true);
        }
      }
    } catch {
      // Gracefully use the existing endpoint when the optional bundle is unavailable.
    }
  }
  const remaining = missing.filter(({ index }) => !results[index]);
  let cursor = 0;
  const worker = async () => {
    while (cursor < remaining.length) {
      const { id, index } = remaining[cursor++];
      const key = `environment-tile:v5:${id}`;
      if (Date.now() < (tileLoadFailures.get(id) || 0)) continue;
      try {
        const response = await loadSharedEnvironmentTile(id, scaleId);
        if (!response || !Array.isArray(response.features)) throw new Error('Tegel niet beschikbaar');
        results[index] = rememberTile(key, response.features);
        store.put('meta', { key, value: { at: Date.now(), features: response.features } }).catch(() => {});
        tileLoadFailures.delete(id);
        emit();
      } catch {
        // Do not persist failed requests as empty tiles.
        tileLoadFailures.set(id, Date.now() + 60000);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, remaining.length) }, worker));
  return emit(true);
}

async function storeEnvironmentTile(store, cacheKey, features, source) {
  await store.put('meta', {
    key: cacheKey,
    value: {
      at: Date.now(),
      source,
      compact: encodeCompactTile(features)
    }
  }).catch(() => {});
}

// Versioned, local integer/delta encoding. Existing cached JSON remains readable.
function encodeCompactTile(features) {
  const types = [...new Set(features.map(feature => feature.type))];
  return { v: 3, q: 1e6, types, f: features.map(feature => {
    let previousLat = 0;
    let previousLng = 0;
    const points = [];
    for (const point of feature.points) {
      const lat = Math.round(point.lat * 1e6);
      const lng = Math.round(point.lng * 1e6);
      points.push(lat - previousLat, lng - previousLng);
      previousLat = lat;
      previousLng = lng;
    }
    return [types.indexOf(feature.type), points];
  }) };
}

function decodeCompactTile(tile) {
  if (tile?.v !== 3 || !Array.isArray(tile.f)) return [];
  return tile.f.map(([typeIndex, values]) => {
    let lat = 0;
    let lng = 0;
    const points = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      lat += values[i];
      lng += values[i + 1];
      points.push({ lat: lat / tile.q, lng: lng / tile.q });
    }
    return { type: tile.types[typeIndex] || 'road', points };
  });
}

function overpassFeatures(data) {
  return (data.elements || [])
    .filter(item => item.type === 'way' && Array.isArray(item.geometry))
    .slice(0, 4500)
    .map(item => ({
      type: lineType(item.tags || {}),
      points: item.geometry
        .map(point => ({
          lat: Number(point.lat),
          lng: Number(point.lon)
        }))
        .filter(point =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng)
        )
    }))
    .filter(item => item.points.length > 1);
}

// Tile v2: resolve geometry from the tile and its ancestors, with one integer
// point table per owner tile. The server derives each tile origin from its ID.
async function loadSharedEnvironmentTile(areaId, scaleId) {
  const key = `${areaId}:${scaleId}`;
  if (inFlightTiles.has(key)) return inFlightTiles.get(key);
  const pending = fetchSharedEnvironmentTile(areaId, scaleId);
  inFlightTiles.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inFlightTiles.get(key) === pending) inFlightTiles.delete(key);
  }
}

async function fetchSharedEnvironmentTile(areaId, scaleId) {
  const url = `${ENVIRONMENT_TILE_ENDPOINT}?id=${encodeURIComponent(areaId)}&resolve=1`;
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.status === 404) {
      // The PHP service publishes tiles once, then subsequent viewers read them.
      const created = await fetch(ENVIRONMENT_TILE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: areaId, scale: scaleId })
      });
      if (!created.ok) throw new Error('Tegel aanmaken mislukt');
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    }
    if (!response.ok) throw new Error('Tegel ophalen mislukt');
    const tile = await response.json();
    if (tile.schema === 'https://sharon.life/environment/tile/v2') {
      sharedTileEndpointState = 'available';
      return decodeEnvironmentV2(tile, scaleId);
    }
    // Old PHP format: keep it readable until the server is upgraded.
    return normalizeLegacySharedTile(tile);
  } catch {
    return null;
  }
}

function decodeEnvironmentV2(payload, scaleId) {
  const tiles = Array.isArray(payload.tiles) ? payload.tiles : [payload];
  const features = [];
  const seen = new Set();
  const level = scaleId === 'region' || scaleId === 'country' ? 1
    : scaleId === 'place' || scaleId === 'district' ? 2 : 3;
  for (const tile of tiles) {
    if (!Array.isArray(tile.points) || !tile.objects) continue;
    const bounds = tile.id ? environmentBoundsForId(tile.id) : {
      west: -180, east: 180, south: -90, north: 90
    };
    const denominator = tile.id ? Number(tile.q || 65535) : 4294967295;
    const points = tile.points.map(p => ({
      lng: bounds.west + Number(p[0]) / denominator * (bounds.east - bounds.west),
      lat: bounds.south + Number(p[1]) / denominator * (bounds.north - bounds.south)
    }));
    for (const [id, object] of Object.entries(tile.objects)) {
      if (seen.has(id) || Number(object.minLevel || 1) > level) continue;
      seen.add(id);
      const path = (object.p || []).map(index => points[index])
        .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (path.length > 1) features.push({ id, type: object.t || 'road', points: path });
    }
  }
  return { id: payload.id, features };
}

function normalizeLegacySharedTile(tile) {
  if (!tile || !Array.isArray(tile.features)) return null;
  return {
    id: String(tile.id || ''),
    features: tile.features.map(feature => {
      const raw = Array.isArray(feature.p) ? feature.p : feature.points;
      if (!Array.isArray(raw)) return null;
      const points = raw.map(p => Array.isArray(p)
        ? { lat: Number(p[0]), lng: Number(p[1]) }
        : { lat: Number(p?.lat), lng: Number(p?.lng) })
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      return points.length > 1 ? { type: String(feature.t || feature.type || 'road'), points } : null;
    }).filter(Boolean)
  };
}

async function fetchOverpass(query) {
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
      // Keep this a CORS-simple POST. This mirrors the Overpass browser
      // examples and avoids an unnecessary preflight on mobile Safari.
      const response = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const type = response.headers.get('content-type') || '';
      if (!type.includes('json')) {
        const body = await response.text();
        throw new Error(body.slice(0, 120) || 'Geen JSON ontvangen');
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error('Kaartbron reageert te langzaam.');
  }

  throw new Error(lastError?.message || 'Kaartbron niet bereikbaar.');
}

function overpassQuery(scale, bbox) {
  const bounds = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map(value => value.toFixed(6))
    .join(',');

  const selectors = ['near', 'detail', 'street'].includes(scale.id)
    ? [
        'way["highway"]',
        'way["railway"]',
        'way["waterway"]',
        'way["building"]'
      ]
    : scale.id === 'district'
      ? [
          'way["highway"]',
          'way["railway"]',
          'way["waterway"]'
        ]
      : scale.id === 'place'
        ? [
            'way["highway"~"motorway|trunk|primary|secondary|tertiary"]',
            'way["railway"~"rail|light_rail"]',
            'way["waterway"~"river|canal"]',
            'way["boundary"="administrative"]'
          ]
        : [
            'way["highway"~"motorway|trunk|primary"]',
            'way["railway"="rail"]',
            'way["waterway"="river"]',
            'way["boundary"="administrative"]'
          ];

  return `
    [out:json][timeout:14];
    (
      ${selectors.map(selector => `${selector}(${bounds});`).join('\n      ')}
    );
    out geom qt;
  `;
}

function lineType(tags) {
  if (tags.building) return 'building';
  if (tags.waterway) return 'water';
  if (tags.railway) return 'rail';
  if (tags.boundary) return 'boundary';

  const highway = String(tags.highway || '');

  if (/motorway|trunk|primary|secondary/.test(highway)) return 'major';
  if (/footway|path|cycleway|steps|pedestrian/.test(highway)) return 'path';
  return 'road';
}

function projectPoint({
  point,
  projection,
  centerX,
  centerY,
  metersPerUnit
}) {
  const x =
    CENTER + (projection.x(point.lng) - centerX) / metersPerUnit;
  const y =
    CENTER - (projection.y(point.lat) - centerY) / metersPerUnit;

  return {
    x,
    y,
    visible:
      x >= -30 &&
      x <= VIEW + 30 &&
      y >= -30 &&
      y <= VIEW + 30
  };
}

function panCenterFromPixels(center, dxPx, dyPx, canvas, scale) {
  const bounds = canvas.getBoundingClientRect();
  const renderedSquare = Math.max(bounds.width, bounds.height, 1);
  const metersPerPixel = scale.spanM / renderedSquare;

  return offsetPoint(
    center,
    -dxPx * metersPerPixel,
    dyPx * metersPerPixel
  );
}

function offsetPoint(center, eastM, northM) {
  const latitude = Number(center.lat);
  const longitude = Number(center.lng);
  const nextLat = Math.max(
    -89.9999,
    Math.min(89.9999, latitude + northM / 111320)
  );
  const lngScale = Math.max(
    0.0001,
    111320 * Math.cos(latitude * Math.PI / 180)
  );

  return {
    lat: nextLat,
    lng: wrapLongitude(longitude + eastM / lngScale)
  };
}
function projectLineFeatures({
  features,
  projection,
  centerX,
  centerY,
  metersPerUnit
}) {
  // Skip paths entirely outside the viewport; limit SVG size on mobile.
  const visible = [];
  for (const feature of features) {
    if (visible.length >= 900) break;
    if (!feature.points?.length) continue;
    const projected = feature.points.map(point => ({
      x: CENTER + (projection.x(point.lng) - centerX) / metersPerUnit,
      y: CENTER - (projection.y(point.lat) - centerY) / metersPerUnit
    }));
    if (!projected.some(point => point.x >= -80 && point.x <= VIEW + 80 && point.y >= -80 && point.y <= VIEW + 80)) continue;
    const commands = [];

    const stride = Math.max(1, Math.floor(projected.length / 450));
    projected.forEach((point, index) => {
      if (index % stride !== 0 && index !== projected.length - 1) return;
      commands.push(`${commands.length ? 'L' : 'M'}${round(point.x)} ${round(point.y)}`);
    });
    visible.push({ type: feature.type, d: commands.join(' ') });
  }
  return visible;
}

function boundsFor(point, halfSpanM) {
  const latitude = Number(point.lat);
  const longitude = Number(point.lng);
  const latDelta = halfSpanM / 111320;
  const longitudeScale = Math.max(
    0.0001,
    111320 * Math.cos(latitude * Math.PI / 180)
  );
  const lngDelta = halfSpanM / longitudeScale;

  return {
    south: Math.max(-89.9999, latitude - latDelta),
    north: Math.min(89.9999, latitude + latDelta),
    west: wrapLongitude(longitude - lngDelta),
    east: wrapLongitude(longitude + lngDelta)
  };
}

function wrapLongitude(value) {
  let longitude = Number(value);
  while (longitude < -180) longitude += 360;
  while (longitude > 180) longitude -= 360;
  return longitude;
}

function touchDistance(a, b) {
  return Math.hypot(
    Number(a.clientX) - Number(b.clientX),
    Number(a.clientY) - Number(b.clientY)
  );
}

function buildGrid({ centerX, centerY, cellM, metersPerUnit }) {
  const currentCellX = Math.floor(centerX / cellM);
  const currentCellY = Math.floor(centerY / cellM);

  const currentLeftM = currentCellX * cellM;
  const currentBottomM = currentCellY * cellM;

  const currentCell = {
    x: round(CENTER + (currentLeftM - centerX) / metersPerUnit),
    y: round(CENTER - ((currentBottomM + cellM) - centerY) / metersPerUnit),
    size: round(cellM / metersPerUnit)
  };

  const vertical = [];
  const horizontal = [];
  const count = Math.ceil((VIEW * metersPerUnit) / cellM) + 3;

  for (let offset = -count; offset <= count; offset += 1) {
    const xBoundary = (currentCellX + offset) * cellM;
    const yBoundary = (currentCellY + offset) * cellM;

    const x = CENTER + (xBoundary - centerX) / metersPerUnit;
    const y = CENTER - (yBoundary - centerY) / metersPerUnit;

    if (x >= 0 && x <= VIEW) vertical.push(round(x));
    if (y >= 0 && y <= VIEW) horizontal.push(round(y));
  }

  return { vertical, horizontal, currentCell };
}

function cellFor(point, cellM) {
  const projection = localProjection(point.lat);
  const xIndex = Math.floor(projection.x(point.lng) / cellM);
  const yIndex = Math.floor(projection.y(point.lat) / cellM);

  return {
    id: `${cellM}:${xIndex}:${yIndex}`,
    shortId: `${xIndex.toString(36)} · ${yIndex.toString(36)}`
  };
}

function localProjection(latitude) {
  const latRad = Number(latitude) * Math.PI / 180;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = Math.max(0.0001, 111320 * Math.cos(latRad));

  return {
    x: lng => Number(lng) * metersPerDegreeLng,
    y: lat => Number(lat) * metersPerDegreeLat
  };
}

function activeLocations(objects) {
  return objects.filter(item =>
    item.type === 'location' &&
    !item.deletedAt &&
    Number.isFinite(Number(item.data?.coordinates?.lat)) &&
    Number.isFinite(Number(item.data?.coordinates?.lng))
  );
}

function distanceBetween(a, b) {
  const lat1 = Number(a.lat) * Math.PI / 180;
  const lat2 = Number(b.lat) * Math.PI / 180;
  const deltaLat = lat2 - lat1;
  const deltaLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;

  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(value)));
}

function formatDistance(value) {
  const meters = Math.max(0, Number(value) || 0);

  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
