import { informationFeedback } from '../core/information/InformationFeedbackService.js?v=0.4.15';
import { wikipediaReference, informationRank, distanceMeters } from '../core/information/InformationItem.js?v=0.4.15';
import { environmentIdForPoint } from '../core/location/EnvironmentIdentifier.js?v=0.4.15';
const EMPTY = { type: 'FeatureCollection', features: [] };
export function wikiFeatures(pages = []) {
  const seen = new Set();
  return { type: 'FeatureCollection', features: pages.flatMap(page => {
    const id = page?.pageprops?.wikibase_item, point = page?.coordinates?.[0];
    if (!/^Q[1-9][0-9]*$/.test(id || '') || !Number.isFinite(point?.lat) || !Number.isFinite(point?.lon) || seen.has(id)) return [];
    seen.add(id);
    return [{ type: 'Feature', id, geometry: { type: 'Point', coordinates: [point.lon, point.lat] }, properties: {
      source:'wikipedia', uri:'https://www.wikidata.org/entity/' + id, pageid:Number(page.pageid), language:page.language,
      wikidata: id, area: environmentIdForPoint({ lat: point.lat, lng: point.lon }, 6),
      title: String(page.title || ''), image: /^https:\/\//.test(page.thumbnail?.source || '') ? page.thumbnail.source : '', description: String(page.extract || '').slice(0, 350), categories: (page.categories || []).map(c => String(c.title || '').replace(/^Category:|^Categorie:/i,'')).slice(0,40),
      url: 'https://' + page.language + '.wikipedia.org/?curid=' + Number(page.pageid)
    }}];
  }) };
}
export async function fetchWikipediaPlaces(center, { language = 'nl', signal, fetcher = fetch } = {}) {
  if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) return EMPTY;
  const lang = /^[a-z]{2,3}$/.test(language) ? language : 'nl';
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'geosearch',
    ggscoord: center.lat + '|' + center.lng, ggsradius: '10000', ggslimit: '40',
    prop: 'coordinates|pageprops|extracts|pageimages|categories', cllimit: 'max', pithumbsize: '480', exintro: '1', explaintext: '1', exsentences: '2', colimit: 'max' });
  const response = await fetcher('https://' + lang + '.wikipedia.org/w/api.php?' + params, { signal });
  if (!response.ok) throw new Error('Wikipedia is tijdelijk niet bereikbaar');
  const data = await response.json();
  return wikiFeatures(Object.values(data?.query?.pages || {}).map(page => ({ ...page, language: lang })));
}
export function mountWikipediaLayer(map, library, { language = 'nl', onOpen = null, onLoadState = null } = {}) {
  const sourceId = 'sharon-wikipedia', layerId = 'sharon-wikipedia-points';
  let enabled = false, disposed = false, request = null, timeout = null, popup = null, lastCenter = null;
  let currentFeatures = [];
  const knownFeatures = new Map();
  let activeId = null;
  let pulseFrame = null;
  const activeLayer = 'sharon-wikipedia-active-pulse';
  let sortMode = 'discover';
  let filters = [];
  let categoryFilters = [];
  const categoriesFor = feature => {
    const text = (feature.properties?.categories || []).join(' ').toLowerCase();
    const groups = [];
    if (/monument|histor|erfgoed|kasteel|kerk|archeolog|oorlog|geschiedenis/.test(text)) groups.push('erfgoed');
    if (/gebouw|architect|brug|toren|bouwwerk|constructie/.test(text)) groups.push('bouw');
    if (/natuur|bos|park|rivier|meer|landschap|flora|fauna/.test(text)) groups.push('natuur');
    if (/kunst|museum|cultuur|theater|beeld|muziek/.test(text)) groups.push('cultuur');
    if (/spoor|station|weg|vervoer|haven|infrastructuur|kanaal/.test(text)) groups.push('vervoer');
    return groups.length ? groups : ['overig'];
  };
  const feedback = id => {
    try { return JSON.parse(localStorage.getItem('sharon.wiki.feedback.v1:' + id) || '{}'); }
    catch { return {}; }
  };
  const reportCounts = () => {
    const features = [...knownFeatures.values()];
    const groups = Object.fromEntries(['erfgoed','bouw','natuur','cultuur','vervoer','overig'].map(key => [key,{total:0,read:0,liked:0,disliked:0,hidden:0}]));
    for (const feature of features) {
      const state = feedback(String(feature.properties?.wikidata || feature.id));
      for (const key of categoriesFor(feature)) {
        const item = groups[key]; if (!item) continue;
        item.total++; if (state.read) item.read++; if (state.liked) item.liked++;
        if (state.disliked) item.disliked++; if (state.hidden) item.hidden++;
      }
    }
    window.dispatchEvent(new CustomEvent('sharon-wiki-counts-changed',{detail:{groups,total:features.length}}));
  };
  const redraw = () => {
    let features = [...knownFeatures.values()].filter(feature => {
      const state = feedback(String(feature.properties?.wikidata || feature.id));
      if (!filters.length && !categoryFilters.length) return !state.hidden;
      const statusMatch = filters.some(filter => filter === 'hidden' ? !!state.hidden : filter === 'unread' ? !state.read && !state.hidden : filter === 'read' ? !!state.read && !state.hidden : filter === 'liked' ? !!state.liked && !state.hidden : filter === 'disliked' ? !!state.disliked && !state.hidden : false);
      const categoryMatch = !state.hidden && categoryFilters.some(group => categoriesFor(feature).includes(group));
      return statusMatch || categoryMatch;
    }).map(feature => {
      const state = feedback(String(feature.properties?.wikidata || feature.id));
      return {...feature, properties:{...feature.properties, read:state.read ? 1 : 0, liked:state.liked ? 1 : 0}};
    });
    const center = map.getCenter();
    const information = informationFeedback();
    const score = feature => {
      const [lng,lat] = feature.geometry.coordinates;
      return informationRank(information?.summary(wikipediaReference(feature)), distanceMeters(center,{lat,lng}),sortMode);
    };
    if (sortMode === 'relevant' || sortMode === 'popular') features = features.filter(feature => score(feature) !== -Infinity);
    features.sort((a,b) => sortMode === 'discover' ? a.properties.read - b.properties.read : score(b) - score(a));
    currentFeatures = features;
    map.getSource(sourceId)?.setData({type:'FeatureCollection', features});
    reportCounts();
  };
  const pulse = () => {
    if (disposed || !enabled) return;
    const t = (performance.now() % 2200) / 2200;
    if (map.getLayer(activeLayer)) {
      map.setPaintProperty(activeLayer, 'circle-radius', 9 + t * 13);
      map.setPaintProperty(activeLayer, 'circle-opacity', .22 * (1-t));
    }
    pulseFrame = requestAnimationFrame(pulse);
  };
  const ensure = () => {
    if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: EMPTY });
    if (!map.getLayer(activeLayer)) map.addLayer({ id:activeLayer, type:'circle', source:sourceId,
      filter:['==',['get','wikidata'],'__none__'],
      paint:{'circle-radius':9,'circle-color':'#547da0','circle-opacity':0.18,'circle-stroke-width':0} });
    if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type: 'circle', source: sourceId,
      paint: { 'circle-radius': 7, 'circle-color': ['case',['==',['get','read'],1],'#c6cdd1','#ffffff'], 'circle-opacity':['case',['==',['get','read'],1],0.42,1], 'circle-stroke-color':['case',['==',['get','liked'],1],'#b75b68',['==',['get','read'],1],'#9aa6af','#344d6b'], 'circle-stroke-opacity':['case',['==',['get','read'],1],0.5,1], 'circle-stroke-width':['case',['==',['get','liked'],1],2.5,['==',['get','read'],1],1.25,2] } });
  };
  const clear = () => { knownFeatures.clear(); currentFeatures = []; activeId = null; map.getSource(sourceId)?.setData(EMPTY); };
  const reportLoad = state => { if (typeof onLoadState === 'function') onLoadState(state); };
  const refresh = async () => {
    if (!enabled || disposed || !map.isStyleLoaded()) return;
    // At low zoom retain previously discovered markers; avoid massive global requests.
    if (map.getZoom() < 11) { request?.abort(); request = null; reportLoad('idle'); ensure(); redraw(); return; }
    const center = map.getCenter();
    if (lastCenter && Math.abs(center.lat - lastCenter.lat) < 0.005 && Math.abs(center.lng - lastCenter.lng) < 0.005) return;
    request?.abort(); const controller = new AbortController(); request = controller;
    reportLoad('loading');
    try {
      const data = await fetchWikipediaPlaces(center, { language, signal: controller.signal });
      if (enabled && !disposed && request === controller) { ensure(); data.features.forEach(f => knownFeatures.set(String(f.id), f)); redraw(); lastCenter = center;
        informationFeedback()?.load(data.features.map(wikipediaReference)).catch(() => {}); }
    } catch (error) { if (error.name !== 'AbortError') { console.warn('Wikipedia-laag:', error.message); if (request === controller) reportLoad('error'); } }
    finally { if (request === controller) { request = null; if (enabled && !disposed && !controller.signal.aborted) reportLoad('idle'); } }
  };
  const schedule = () => { clearTimeout(timeout); if (enabled) timeout = setTimeout(refresh, 450); };
  const click = event => {
    if (!enabled || !map.getLayer(layerId)) return;
    const point = event.point;
    const feature = map.queryRenderedFeatures([[point.x - 14, point.y - 14], [point.x + 14, point.y + 14]], { layers: [layerId] })[0];
    if (!feature) return;
    if (typeof onOpen === 'function') {
      const chosen = currentFeatures.find(item => item.id === feature.id) || feature;
      activeId = String(chosen.id);
      map.setFilter(activeLayer, ['==', ['get','wikidata'], String(chosen.properties.wikidata)]);
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
  const onFeedbackChanged = () => {
    redraw();
    // Updating GeoJSON is asynchronous in MapLibre; refresh the paint expression
    // as well so the visible marker changes immediately on supported devices.
    if (map.getLayer(layerId)) map.triggerRepaint();
  };
  window.addEventListener('sharon-wiki-feedback-changed',onFeedbackChanged);
  window.addEventListener('sharon-information-changed',onFeedbackChanged);
  map.on('moveend', schedule); map.on('click', click);
  const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
  const leave = () => { map.getCanvas().style.cursor = ''; };
  map.on('mouseenter', layerId, enter); map.on('mouseleave', layerId, leave);
  return { setSort(value) { sortMode = ['discover','nearby','relevant','popular'].includes(value) ? value : 'discover'; if (enabled) redraw(); }, setFilters(values, categories = []) { filters = values || []; categoryFilters = categories; redraw(); }, setActive(feature) {
    activeId = feature ? String(feature.properties?.wikidata || feature.id || '') : null;
    if (map.getLayer(activeLayer)) map.setFilter(activeLayer, ['==', ['get','wikidata'], activeId || '__none__']);
  }, setEnabled(value) { enabled = Boolean(value); request?.abort(); request = null; reportLoad('idle'); clearTimeout(timeout); lastCenter = null;
      if (enabled) { ensure(); redraw(); schedule(); if (!pulseFrame) pulseFrame = requestAnimationFrame(pulse); } else { clear(); popup?.remove(); cancelAnimationFrame(pulseFrame); pulseFrame = null; } },
    destroy() { window.removeEventListener('sharon-information-changed',onFeedbackChanged); window.removeEventListener('sharon-wiki-feedback-changed',onFeedbackChanged); cancelAnimationFrame(pulseFrame); pulseFrame = null; disposed = true; enabled = false; request?.abort(); request = null; reportLoad('idle'); clearTimeout(timeout); popup?.remove(); map.off('moveend', schedule); map.off('click', click); map.off('mouseenter', layerId, enter); map.off('mouseleave', layerId, leave); } };
}
