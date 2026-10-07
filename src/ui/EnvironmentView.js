const SCALES = Object.freeze([
  { id: 'street', label: 'Straat', spanM: 650, cellM: 100 },
  { id: 'district', label: 'Wijk', spanM: 2800, cellM: 500 },
  { id: 'place', label: 'Plaats', spanM: 14000, cellM: 2500 },
  { id: 'region', label: 'Regio', spanM: 65000, cellM: 10000 }
]);

const VIEW = 1000;
const CENTER = VIEW / 2;
const EARTH_RADIUS_M = 6371000;
const LINE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

export async function openEnvironmentView(root, {
  store,
  location,
  events,
  setTitle = () => {}
}) {
  setTitle('Omgeving');

  let scaleIndex = 0;
  let scale = SCALES[scaleIndex];
  let point = location.latest;
  let objects = await store.getAll('objects');
  let locations = activeLocations(objects);
  let checking = false;
  let lineFeatures = [];
  let lineState = 'idle';
  let lineContextKey = point ? environmentLineKey(point, scale) : '';
  let lineLoadToken = 0;
  let lineTimer = null;
  let pinch = null;
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
          Knijp om te zoomen
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

    const model = environmentModel(point, locations, lineFeatures, scale);
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
    if (!point) return;

    const requestedKey = environmentLineKey(point, scale);
    if (requestedKey === lineContextKey && lineFeatures.length) return;

    const token = ++lineLoadToken;
    lineState = 'loading';
    render();

    try {
      const features = await loadEnvironmentLines(store, point, scale);
      if (token !== lineLoadToken) return;
      lineFeatures = features;
      lineContextKey = requestedKey;
      lineState = features.length ? 'ready' : 'idle';
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

      objects = await store.getAll('objects');
      locations = activeLocations(objects);
      lineFeatures = [];
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

  const onTouchStart = event => {
    if (event.touches.length !== 2) return;

    const distance = touchDistance(event.touches[0], event.touches[1]);
    if (!distance) return;

    pinch = {
      startDistance: distance,
      startScaleIndex: scaleIndex,
      ratio: 1
    };

    canvas.classList.add('is-pinching');
    hideHint();

    if (event.cancelable) event.preventDefault();
  };

  const onTouchMove = event => {
    if (!pinch || event.touches.length !== 2) return;

    const distance = touchDistance(event.touches[0], event.touches[1]);
    if (!distance) return;

    pinch.ratio = distance / pinch.startDistance;

    const preview = Math.max(0.9, Math.min(1.1, 1 + (pinch.ratio - 1) * 0.14));
    map.style.transform = `scale(${preview})`;

    if (event.cancelable) event.preventDefault();
  };

  const finishPinch = () => {
    if (!pinch) return;

    const ratio = pinch.ratio;
    const rawSteps = Math.round(Math.log(Math.max(0.35, Math.min(2.8, ratio))) / Math.log(1.45));
    const nextIndex = pinch.startScaleIndex - rawSteps;

    map.style.transform = '';
    canvas.classList.remove('is-pinching');

    if (Math.abs(ratio - 1) >= 0.12) {
      setScaleIndex(nextIndex);
    }

    pinch = null;
  };

  const onWheel = event => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    hideHint();
    wheelTotal += event.deltaY;

    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const direction = wheelTotal > 0 ? 1 : -1;
      if (Math.abs(wheelTotal) > 12) setScaleIndex(scaleIndex + direction);
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
  canvas.addEventListener('touchend', finishPinch, { passive: true });
  canvas.addEventListener('touchcancel', finishPinch, { passive: true });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const offLocation = events.on('location.changed', event => {
    const nextPoint = event.detail;
    const nextKey = environmentLineKey(nextPoint, scale);
    const sameLineArea = nextKey === lineContextKey;

    point = nextPoint;

    if (!sameLineArea) {
      lineFeatures = [];
      lineContextKey = '';
      lineState = 'idle';
    }

    render();
    if (!sameLineArea) scheduleLines();
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
  } else {
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
    canvas.removeEventListener('touchend', finishPinch);
    canvas.removeEventListener('touchcancel', finishPinch);
    canvas.removeEventListener('wheel', onWheel);

    offLocation();
    offCreated();
    offUpdated();
    offDeleted();
  };
}

function environmentModel(point, locations, lineFeatures, scale) {
  const projection = localProjection(point.lat);
  const centerX = projection.x(point.lng);
  const centerY = projection.y(point.lat);
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

  const currentCell = cellFor(point, scale.cellM);
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
      scale,
      currentCell
    }),
    currentCell,
    nearest,
    visibleCount: visibleLocations.length,
    scale
  };
}

function environmentSvg({ grid, linePaths, locations, scale, currentCell }) {
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

      <g class="environment-you">
        <circle class="environment-you-ring" cx="${CENTER}" cy="${CENTER}" r="18"></circle>
        <circle class="environment-you-dot" cx="${CENTER}" cy="${CENTER}" r="6"></circle>
      </g>

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
      <small>GPS ±${Math.round(Number(point.accuracy) || 0)} m</small>
    </div>
    <div>
      <span>Vak</span>
      <strong>${formatDistance(model.scale.cellM)}</strong>
      <small>${escapeHtml(model.currentCell.shortId)}</small>
    </div>
  `;
}

function environmentLineKey(point, scale) {
  const cacheCellM = Math.max(scale.cellM, Math.round(scale.spanM / 2));
  const cacheCell = cellFor(point, cacheCellM);
  return `environment-lines:${scale.id}:${cacheCell.id}`;
}

async function loadEnvironmentLines(store, point, scale) {
  const cacheKey = environmentLineKey(point, scale);
  const cached = await store.get('meta', cacheKey).catch(() => null);

  if (
    cached?.value?.features &&
    Date.now() - Number(cached.value.at || 0) < LINE_CACHE_MAX_AGE
  ) {
    return cached.value.features;
  }

  const bbox = boundsFor(point, scale.spanM * 0.82);
  const query = overpassQuery(scale, bbox);

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: new URLSearchParams({ data: query })
  });

  if (!response.ok) {
    throw new Error(`Kaartlijnen konden niet worden geladen (${response.status}).`);
  }

  const data = await response.json();
  const features = (data.elements || [])
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

  await store.put('meta', {
    key: cacheKey,
    value: {
      at: Date.now(),
      features
    }
  }).catch(() => {});

  return features;
}

function overpassQuery(scale, bbox) {
  const bounds = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map(value => value.toFixed(6))
    .join(',');

  const selectors = scale.id === 'street'
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
