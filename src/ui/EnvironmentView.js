const SCALES = Object.freeze([
  { id: 'street', label: 'Straat', spanM: 600, cellM: 100 },
  { id: 'district', label: 'Wijk', spanM: 2500, cellM: 500 },
  { id: 'place', label: 'Plaats', spanM: 12000, cellM: 2500 },
  { id: 'region', label: 'Regio', spanM: 60000, cellM: 10000 }
]);

const VIEW = 1000;
const CENTER = VIEW / 2;
const EARTH_RADIUS_M = 6371000;

export async function openEnvironmentView(root, {
  store,
  location,
  events,
  setTitle = () => {}
}) {
  setTitle('Omgeving');

  let scale = SCALES[0];
  let point = location.latest;
  let objects = await store.getAll('objects');
  let locations = activeLocations(objects);
  let checking = false;

  root.innerHTML = `
    <section class="module-view environment-view">
      <div class="environment-toolbar">
        <div class="environment-scales" role="group" aria-label="Schaal">
          ${SCALES.map(item => `
            <button
              type="button"
              data-environment-scale="${item.id}"
              aria-pressed="${item.id === scale.id ? 'true' : 'false'}"
            >${item.label}</button>
          `).join('')}
        </div>

        <button type="button" class="environment-refresh" data-environment-refresh>
          Positie
        </button>
      </div>

      <div class="environment-canvas" data-environment-canvas></div>
      <div class="environment-readout" data-environment-readout></div>
    </section>
  `;

  const canvas = root.querySelector('[data-environment-canvas]');
  const readout = root.querySelector('[data-environment-readout]');
  const refreshButton = root.querySelector('[data-environment-refresh]');

  const render = () => {
    root.querySelectorAll('[data-environment-scale]').forEach(button => {
      button.setAttribute(
        'aria-pressed',
        button.dataset.environmentScale === scale.id ? 'true' : 'false'
      );
    });

    if (!point) {
      canvas.innerHTML = `
        <div class="environment-empty">
          <span class="environment-position-mark" aria-hidden="true"></span>
          <strong>Positie nog niet bekend</strong>
          <small>Gebruik ‘Positie’ om je omgeving te bepalen.</small>
        </div>
      `;

      readout.innerHTML = '';
      return;
    }

    const model = environmentModel(point, locations, scale);
    canvas.innerHTML = model.svg;
    readout.innerHTML = environmentReadout(model, point);
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
      render();
    } catch (error) {
      canvas.innerHTML = `
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

  root.querySelectorAll('[data-environment-scale]').forEach(button => {
    button.addEventListener('click', () => {
      const next = SCALES.find(item => item.id === button.dataset.environmentScale);
      if (!next) return;
      scale = next;
      render();
    });
  });

  refreshButton.addEventListener('click', refresh);

  const offLocation = events.on('location.changed', event => {
    point = event.detail;
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
  }

  return () => {
    offLocation();
    offCreated();
    offUpdated();
    offDeleted();
  };
}

function environmentModel(point, locations, scale) {
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

  return {
    svg: environmentSvg({
      grid,
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

function environmentSvg({ grid, locations, scale, currentCell }) {
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
      role="img"
      aria-label="Schematische weergave van je omgeving"
      data-cell-id="${escapeAttribute(currentCell.id)}"
    >
      <rect class="environment-current-cell" x="${grid.currentCell.x}" y="${grid.currentCell.y}" width="${grid.currentCell.size}" height="${grid.currentCell.size}"></rect>

      <g class="environment-grid">
        ${grid.vertical.map(x => `<line x1="${x}" y1="0" x2="${x}" y2="${VIEW}"></line>`).join('')}
        ${grid.horizontal.map(y => `<line x1="0" y1="${y}" x2="${VIEW}" y2="${y}"></line>`).join('')}
      </g>

      <g class="environment-crosshair" aria-hidden="true">
        <line x1="${CENTER}" y1="${CENTER - 24}" x2="${CENTER}" y2="${CENTER + 24}"></line>
        <line x1="${CENTER - 24}" y1="${CENTER}" x2="${CENTER + 24}" y2="${CENTER}"></line>
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
