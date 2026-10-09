// Experimental fast renderer: external vector basemap + Sharon's own identifiers.
import { environmentIdForPoint, environmentPointId } from '../core/location/EnvironmentIdentifier.js?v=0.1.49';

const LIBRE = 'https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs';
const STYLE = 'https://tiles.openfreemap.org/styles/positron';

function geojson(objects) {
  return { type: 'FeatureCollection', features: objects.filter(o => o.type === 'location' && !o.deletedAt).flatMap(o => {
    const lng = Number(o.data?.coordinates?.lng), lat = Number(o.data?.coordinates?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { title: String(o.data?.title || 'Locatie') } }];
  }) };
}

export async function openEnvironmentMapLibre(root, { store, location, events, setTitle = () => {} }) {
  const lib = await import(LIBRE);
  if (!lib.supported()) throw new Error('WebGL niet beschikbaar');
  if (!document.querySelector('[data-sharon-maplibre-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.css';
    css.dataset.sharonMaplibreCss = 'true';
    document.head.append(css);
  }
  setTitle('Omgeving');
  const valid = p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
  let userPoint = valid(location.latest) ? location.latest : null;
  let follow = Boolean(userPoint);
  let disposed = false;
  root.innerHTML = `
    <section class="module-view environment-view environment-maplibre-preview">
      <div class="environment-canvas">
        <div class="environment-map" data-libre-map></div>
        <button class="environment-scale-chip" type="button" data-libre-scale>Vector</button>
        <button class="environment-refresh" type="button" data-libre-position>Positie</button>
        <div class="environment-readout" data-libre-readout></div>
      </div>
    </section>
    <style>
      .environment-maplibre-preview .environment-map{inset:0;transform:none;transition:none;will-change:auto}
      .environment-maplibre-preview .maplibregl-ctrl-bottom-right{bottom:94px}
      .environment-maplibre-preview .sharon-gps-dot{width:12px;height:12px;border:3px solid white;border-radius:50%;box-shadow:0 0 0 2px #111;background:#111}
    </style>`;
  const scaleButton = root.querySelector('[data-libre-scale]');
  const positionButton = root.querySelector('[data-libre-position]');
  const readout = root.querySelector('[data-libre-readout]');
  const map = new lib.Map({
    container: root.querySelector('[data-libre-map]'),
    style: STYLE,
    center: userPoint ? [Number(userPoint.lng), Number(userPoint.lat)] : [0, 0],
    zoom: userPoint ? 15.5 : 2,
    maxZoom: 20,
    minZoom: 1,
    dragRotate: false,
    touchPitch: false,
    maxPitch: 0,
    attributionControl: true
  });
  let gpsMarker = null;
  const placeGPS = point => {
    if (!valid(point)) return;
    userPoint = point;
    if (!gpsMarker) {
      const dot = document.createElement('div');
      dot.className = 'sharon-gps-dot';
      gpsMarker = new lib.Marker({ element: dot, anchor: 'center' }).addTo(map);
    }
    gpsMarker.setLngLat([Number(point.lng), Number(point.lat)]);
    if (follow) map.easeTo({ center: [Number(point.lng), Number(point.lat)], duration: 300 });
  };
  const renderInfo = () => {
    const center = map.getCenter();
    const meters = 40075016.686 * Math.cos(center.lat * Math.PI / 180)
      * map.getContainer().clientWidth / (512 * 2 ** map.getZoom());
    const length = meters < 3000 ? 6 : meters < 100000 ? 4 : 2;
    const area = environmentIdForPoint(center, length);
    scaleButton.textContent = `Vector · ${meters < 1000 ? Math.round(meters) + ' m' : (meters / 1000).toFixed(1) + ' km'}`;
    // Text-only values: no user-supplied HTML is inserted.
    readout.replaceChildren();
    for (const [label, value, hint] of [
      ['Positie', userPoint ? environmentPointId(userPoint) : 'Niet bepaald', userPoint ? 'GPS' : 'Tik op Positie'],
      ['Gebied', area, 'Sharon identifier']
    ]) {
      const block = document.createElement('div');
      const heading = document.createElement('span');
      heading.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      const small = document.createElement('small');
      small.textContent = hint;
      block.append(heading, strong, small);
      readout.append(block);
    }
  };
  const updateLocations = async () => {
    const objects = await store.getAll('objects');
    if (!disposed) map.getSource('sharon-locations')?.setData(geojson(objects));
  };
  map.on('load', async () => {
    if (disposed) return;
    for (const layer of map.getStyle().layers || []) {
      // Keep Sharon's quiet black/white silhouette; no map-provider POI labels.
      if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
    map.addSource('sharon-locations', { type: 'geojson', data: geojson([]) });
    map.addLayer({ id: 'sharon-places', type: 'circle', source: 'sharon-locations',
      paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': '#111', 'circle-stroke-width': 2 } });
    await updateLocations();
  });
  map.on('moveend', renderInfo);
  map.on('dragstart', () => { follow = false; });
  map.on('click', 'sharon-places', event => {
    const feature = event.features?.[0];
    if (feature) new lib.Popup().setLngLat(feature.geometry.coordinates)
      .setText(String(feature.properties?.title || 'Locatie')).addTo(map);
  });
  const locate = async () => {
    positionButton.disabled = true;
    try {
      const result = await location.checkNow({ reason: 'environment', maxAgeMs: 0,
        highAccuracy: true, browserMaxAgeMs: 0, timeoutMs: 10000 });
      if (!disposed) { follow = true; placeGPS(result); renderInfo(); }
    } finally {
      if (!disposed) positionButton.disabled = false;
    }
  };
  positionButton.addEventListener('click', () => { locate().catch(() => {}); });
  scaleButton.addEventListener('click', () => map.easeTo({ zoom: Math.min(20, map.getZoom() + 1), duration: 250 }));
  const offGPS = events.on('location.changed', event => { if (!disposed) { placeGPS(event.detail); renderInfo(); } });
  const offCreate = events.on('location.created', updateLocations);
  const offUpdate = events.on('location.updated', updateLocations);
  const offDelete = events.on('location.deleted', updateLocations);
  if (userPoint) placeGPS(userPoint);
  renderInfo();
  return () => { disposed = true; offGPS(); offCreate(); offUpdate(); offDelete(); map.remove(); };
}
