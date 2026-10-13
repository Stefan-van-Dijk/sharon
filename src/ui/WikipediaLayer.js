import { environmentIdForPoint } from '../core/location/EnvironmentIdentifier.js';
const EMPTY = { type: 'FeatureCollection', features: [] };
export function wikiFeatures(pages = []) {
  const seen = new Set();
  return { type: 'FeatureCollection', features: pages.flatMap(page => {
    const id = page?.pageprops?.wikibase_item, point = page?.coordinates?.[0];
    if (!/^Q[1-9][0-9]*$/.test(id || '') || !Number.isFinite(point?.lat) || !Number.isFinite(point?.lon) || seen.has(id)) return [];
    seen.add(id);
    return [{ type: 'Feature', id, geometry: { type: 'Point', coordinates: [point.lon, point.lat] }, properties: {
      wikidata: id, area: environmentIdForPoint({ lat: point.lat, lng: point.lon }, 6),
      title: String(page.title || ''), image: /^https:\/\//.test(page.thumbnail?.source || '') ? page.thumbnail.source : '', description: String(page.extract || '').slice(0, 350),
      url: 'https://' + page.language + '.wikipedia.org/?curid=' + Number(page.pageid)
    }}];
  }) };
}
export async function fetchWikipediaPlaces(center, { language = 'nl', signal, fetcher = fetch } = {}) {
  if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) return EMPTY;
  const lang = /^[a-z]{2,3}$/.test(language) ? language : 'nl';
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'geosearch',
    ggscoord: center.lat + '|' + center.lng, ggsradius: '10000', ggslimit: '40',
    prop: 'coordinates|pageprops|extracts|pageimages', pithumbsize: '480', exintro: '1', explaintext: '1', exsentences: '2', colimit: 'max' });
  const response = await fetcher('https://' + lang + '.wikipedia.org/w/api.php?' + params, { signal });
  if (!response.ok) throw new Error('Wikipedia is tijdelijk niet bereikbaar');
  const data = await response.json();
  return wikiFeatures(Object.values(data?.query?.pages || {}).map(page => ({ ...page, language: lang })));
}
export function mountWikipediaLayer(map, library, { language = 'nl', onOpen = null } = {}) {
  const sourceId = 'sharon-wikipedia', layerId = 'sharon-wikipedia-points';
  let enabled = false, disposed = false, request = null, timeout = null, popup = null, lastCenter = null;
  let currentFeatures = [];
  const ensure = () => {
    if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: EMPTY });
    if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type: 'circle', source: sourceId,
      paint: { 'circle-radius': 9, 'circle-color': '#ffffff', 'circle-stroke-color': '#344d6b', 'circle-stroke-width': 2 } });
  };
  const clear = () => map.getSource(sourceId)?.setData(EMPTY);
  const refresh = async () => {
    if (!enabled || disposed || !map.isStyleLoaded()) return;
    if (map.getZoom() < 11) { clear(); return; }
    const center = map.getCenter();
    if (lastCenter && Math.abs(center.lat - lastCenter.lat) < 0.005 && Math.abs(center.lng - lastCenter.lng) < 0.005) return;
    request?.abort(); const controller = new AbortController(); request = controller;
    try {
      const data = await fetchWikipediaPlaces(center, { language, signal: controller.signal });
      if (enabled && !disposed && request === controller) { ensure(); map.getSource(sourceId)?.setData(data); currentFeatures = data.features; lastCenter = center; }
    } catch (error) { if (error.name !== 'AbortError') console.warn('Wikipedia-laag:', error.message); }
  };
  const schedule = () => { clearTimeout(timeout); if (enabled) timeout = setTimeout(refresh, 450); };
  const click = event => {
    if (!enabled || !map.getLayer(layerId)) return;
    const point = event.point;
    const feature = map.queryRenderedFeatures([[point.x - 14, point.y - 14], [point.x + 14, point.y + 14]], { layers: [layerId] })[0];
    if (!feature) return;
    if (typeof onOpen === 'function') {
      const chosen = currentFeatures.find(item => item.id === feature.id) || feature;
      onOpen(chosen, currentFeatures);
      return;
    }
    popup?.remove(); const node = document.createElement('article');
    node.style.cssText = 'width:min(76vw,310px);max-height:55vh;overflow:auto;font:inherit;line-height:1.45';
    if (feature.properties.image) {
      const photo = document.createElement('img');
      photo.src = feature.properties.image;
      photo.alt = '';
      photo.loading = 'lazy';
      photo.referrerPolicy = 'no-referrer';
      photo.style.cssText = 'display:block;width:100%;max-height:190px;object-fit:cover;border-radius:8px;margin-bottom:10px';
      node.append(photo);
    }
    const heading = document.createElement('strong'); heading.textContent = feature.properties.title; heading.style.cssText = 'display:block;font-size:17px;margin-bottom:6px'; node.append(heading);
    if (feature.properties.description) { const p = document.createElement('p'); p.textContent = feature.properties.description; p.style.cssText = 'margin:6px 0 12px'; node.append(p); }
    const link = document.createElement('a'); link.href = feature.properties.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Lees meer op Wikipedia ↗'; link.style.cssText = 'display:inline-block;padding:8px 0;font-weight:600'; node.append(link);
    popup = new library.Popup({ maxWidth: '340px', closeButton: true, closeOnClick: true, offset: 14 }).setLngLat(feature.geometry.coordinates).setDOMContent(node).addTo(map);
  };
  map.on('moveend', schedule); map.on('click', click);
  const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
  const leave = () => { map.getCanvas().style.cursor = ''; };
  map.on('mouseenter', layerId, enter); map.on('mouseleave', layerId, leave);
  return { setEnabled(value) { enabled = Boolean(value); request?.abort(); clearTimeout(timeout); lastCenter = null;
      if (enabled) { ensure(); schedule(); } else { clear(); popup?.remove(); } },
    destroy() { disposed = true; enabled = false; request?.abort(); clearTimeout(timeout); popup?.remove(); map.off('moveend', schedule); map.off('click', click); map.off('mouseenter', layerId, enter); map.off('mouseleave', layerId, leave); } };
}
