import {
  environmentBoundsForId,
  environmentPointId,
  environmentTileId
} from '../core/location/EnvironmentIdentifier.js?v=0.1.42';

const SCALES = Object.freeze([
  { id: 'near', label: 'Dichtbij', spanM: 70, cellM: 10 },
  { id: 'detail', label: 'Detail', spanM: 220, cellM: 25 },
  { id: 'street', label: 'Straat', spanM: 700, cellM: 100 },
  { id: 'district', label: 'Wijk', spanM: 3000, cellM: 500 },
  { id: 'place', label: 'Plaats', spanM: 15000, cellM: 2500 },
  { id: 'region', label: 'Regio', spanM: 70000, cellM: 10000 }
]);

const VIEW = 1000;
const CENTER = VIEW / 2;
const EARTH_RADIUS_M = 6371000;
const LINE_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const ENVIRONMENT_TILE_ENDPOINT = 'https://sharon.life/environment/api/tiles.php';
let sharedTileEndpointState = 'unknown';
const publishedTileRequests = new Set();
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
  let lineContextKey = viewCenter ? environmentLineKey(viewCenter, scale) : '';
  let lineLoadToken = 0;
  let lineTimer = null;
  let pinch = null;
  let pan = null;
  let mousePan = false;
  let wheelTotal = 0;
  let wheelTimer = null;

  root.innerHTML = `
    <section class="module-view environment-view">
      <div class="environment-canvas" data-environment-canvas>
        <div class="environment-map" data-environment-map></div>

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
  const readout = root.querySelector('[data-environment-readout]');
  const refreshButton = root.querySelector('[data-environment-refresh]');
  const scaleButton = root.querySelector('[data-environment-scale]');
  const source = root.querySelector('[data-environment-source]');
  const pinchHint = root.querySelector('[data-environment-pinch-hint]');

  const render = () => {
    scaleButton.textContent = `${scale.label} · ${formatDistance(scale.spanM)}`;

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
      scale
    );
    map.innerHTML = model.svg;
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
    if (lineTimer) clearTimeout(lineTimer);
    lineTimer = setTimeout(() => {
      lineTimer = null;
      loadLines().catch(() => {});
    }, 180);
  };

  const loadLines = async () => {
    if (!viewCenter) return;

    const requestedCenter = { ...viewCenter };
    const requestedScaleId = scale.id;
    const requestedAreaId = environmentTileId(
      requestedCenter,
      requestedScaleId
    );
    const requestedKey = environmentLineKey(
      requestedCenter,
      scale
    );

    if (requestedKey === lineContextKey && lineFeatures.length) {
      publishRenderedEnvironmentTile(
        requestedAreaId,
        requestedScaleId
      ).catch(() => {});
      return;
    }

    const token = ++lineLoadToken;
    lineState = 'loading';
    render();

    try {
      const features = await loadEnvironmentLines(
        store,
        requestedCenter,
        scale
      );

      if (token !== lineLoadToken) return;

      lineFeatures = features;
      lineContextKey = requestedKey;
      lineState = features.length ? 'ready' : 'idle';

      render();

      if (features.length) {
        publishRenderedEnvironmentTile(
          requestedAreaId,
          requestedScaleId
        ).catch(() => {});
      }

      return;
    } catch {
      if (token !== lineLoadToken) return;
      lineFeatures = [];
      lineState = 'error';
    }

    render();
  };

  const setScaleIndex = nextIndex => {
    const clamped = Math.max(0, Math.min(SCALES.length - 1, nextIndex));
    if (clamped === scaleIndex) return false;

    scaleIndex = clamped;
    scale = SCALES[scaleIndex];
    lineFeatures = [];
    lineContextKey = '';
    lineState = 'idle';
    render();
    scheduleLines();
    return true;
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
      lineFeatures = [];
      lineContextKey = '';
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

      const nextKey = environmentLineKey(viewCenter, scale);
      const sameLineArea = nextKey === lineContextKey;

      if (!sameLineArea) {
        lineFeatures = [];
        lineContextKey = '';
        lineState = 'idle';
      }

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
        startScaleIndex: scaleIndex,
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

      const preview = Math.max(
        0.84,
        Math.min(1.18, 1 + (pinch.ratio - 1) * 0.18)
      );
      map.style.transform = `scale(${preview})`;

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
    const rawSteps = Math.round(
      Math.log(Math.max(0.25, Math.min(4, ratio))) /
      Math.log(1.4)
    );
    const nextIndex = pinch.startScaleIndex - rawSteps;

    map.style.transform = '';
    canvas.classList.remove('is-pinching');

    if (Math.abs(ratio - 1) >= 0.1) {
      setScaleIndex(nextIndex);
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
      const direction = wheelTotal > 0 ? 1 : -1;
      if (Math.abs(wheelTotal) > 12) {
        setScaleIndex(scaleIndex + direction);
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

      const nextKey = environmentLineKey(viewCenter, scale);
      const sameLineArea = nextKey === lineContextKey;

      if (!sameLineArea) {
        lineFeatures = [];
        lineContextKey = '';
        lineState = 'idle';
      }

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
  scale
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

  const linePaths = projectLineFeatures({
    features: lineFeatures,
    projection,
    centerX,
    centerY,
    metersPerUnit
  });

  return {
    svg: environmentSvg({
      grid,
      linePaths,
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

function environmentSvg({
  grid,
  linePaths,
  locations,
  userPosition,
  scale,
  currentCell
}) {
  const lineMarkup = linePaths.map(item =>
    `<path class="environment-line environment-line--${item.type}" d="${item.d}"></path>`
  ).join('');

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

function environmentLineKey(point, scale) {
  return `environment-lines:v2:${scale.id}:${environmentTileId(point, scale.id)}`;
}

async function loadEnvironmentLines(store, point, scale) {
  const areaId = environmentTileId(point, scale.id);
  const cacheKey = environmentLineKey(point, scale);
  const cached = await store.get('meta', cacheKey).catch(() => null);

  if (
    cached?.value?.features &&
    Date.now() - Number(cached.value.at || 0) < LINE_CACHE_MAX_AGE
  ) {
    return cached.value.features;
  }

  const shared = await loadSharedEnvironmentTile(areaId, scale.id)
    .catch(() => null);

  if (shared?.features?.length) {
    await storeEnvironmentTile(store, cacheKey, shared.features, 'shared');
    return shared.features;
  }

  const canonicalCenter = environmentBoundsForId(areaId).center;
  const bbox = boundsFor(canonicalCenter, scale.spanM * 0.82);
  const query = overpassQuery(scale, bbox);

  const data = await fetchOverpass(query);
  const features = overpassFeatures(data);

  await storeEnvironmentTile(store, cacheKey, features, 'overpass');
  return features;
}

async function storeEnvironmentTile(store, cacheKey, features, source) {
  await store.put('meta', {
    key: cacheKey,
    value: {
      at: Date.now(),
      source,
      features
    }
  }).catch(() => {});
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

async function loadSharedEnvironmentTile(areaId, scaleId) {
  if (sharedTileEndpointState === 'unavailable') return null;

  const url =
    `${ENVIRONMENT_TILE_ENDPOINT}?id=${encodeURIComponent(areaId)}&scale=${encodeURIComponent(scaleId)}`;

  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      headers: { Accept: 'application/json' }
    });
  } catch {
    sharedTileEndpointState = 'unavailable';
    return null;
  }

  if (response.ok) {
    sharedTileEndpointState = 'available';
    publishedTileRequests.add(`${scaleId}:${areaId}`);
    return normalizeSharedTile(await response.json());
  }

  if (response.status !== 404) {
    if (response.status >= 500) sharedTileEndpointState = 'unavailable';
    return null;
  }

  let generated;

  try {
    generated = await fetch(ENVIRONMENT_TILE_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        id: areaId,
        scale: scaleId
      })
    });
  } catch {
    sharedTileEndpointState = 'unavailable';
    return null;
  }

  if (!generated.ok) {
    if (generated.status === 404) {
      sharedTileEndpointState = 'unavailable';
    }
    return null;
  }

  sharedTileEndpointState = 'available';
  publishedTileRequests.add(`${scaleId}:${areaId}`);
  return normalizeSharedTile(await generated.json());
}

async function publishRenderedEnvironmentTile(areaId, scaleId) {
  const requestKey = `${scaleId}:${areaId}`;

  if (publishedTileRequests.has(requestKey)) return false;
  publishedTileRequests.add(requestKey);

  try {
    const response = await fetch(ENVIRONMENT_TILE_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        id: areaId,
        scale: scaleId,
        reason: 'rendered'
      })
    });

    if (!response.ok) {
      throw new Error(`Publicatie mislukt (${response.status}).`);
    }

    sharedTileEndpointState = 'available';
    return true;
  } catch {
    publishedTileRequests.delete(requestKey);
    return false;
  }
}

function normalizeSharedTile(tile) {
  if (!tile || !Array.isArray(tile.features)) return null;

  const features = tile.features
    .map(feature => {
      const type = String(feature.t || feature.type || 'road');
      const rawPoints = Array.isArray(feature.p)
        ? feature.p
        : feature.points;

      if (!Array.isArray(rawPoints)) return null;

      const points = rawPoints
        .map(point => Array.isArray(point)
          ? { lat: Number(point[0]), lng: Number(point[1]) }
          : { lat: Number(point?.lat), lng: Number(point?.lng) })
        .filter(point =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng)
        );

      return points.length > 1 ? { type, points } : null;
    })
    .filter(Boolean);

  return {
    id: String(tile.id || ''),
    scale: String(tile.scale || ''),
    features
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
  return features.map(feature => {
    const commands = [];

    feature.points.forEach((point, index) => {
      const x = CENTER + (projection.x(point.lng) - centerX) / metersPerUnit;
      const y = CENTER - (projection.y(point.lat) - centerY) / metersPerUnit;

      commands.push(`${index ? 'L' : 'M'}${round(x)} ${round(y)}`);
    });

    return {
      type: feature.type,
      d: commands.join(' ')
    };
  });
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
