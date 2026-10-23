import { fetchTiqetsPlaces } from './TiqetsSource.js?v=0.3.84';

const EMPTY = {type:'FeatureCollection',features:[]};
export function mountTiqetsLayer(map, {onOpen, onState = () => {}, fetchPlaces = fetchTiqetsPlaces} = {}) {
  const source = 'sharon-tiqets', layer = 'sharon-tiqets-points';
  let enabled = false, disposed = false, timer, request, features = [];
  const ensure = () => {
    if (!map.getSource(source)) map.addSource(source, {type:'geojson',data:EMPTY});
    if (!map.getLayer(layer)) map.addLayer({
      id:layer,type:'circle',source,
      paint:{'circle-radius':7,'circle-color':'#fff','circle-stroke-color':'#008b88','circle-stroke-width':2.5}
    });
  };
  const clear = () => { features = []; map.getSource(source)?.setData(EMPTY); };
  const refresh = async () => {
    if (!enabled || disposed || !map.isStyleLoaded()) return;
    request?.abort();
    if (map.getZoom() < 11) { clear(); onState('zoom'); return; }
    const controller = new AbortController(); request = controller;
    onState('loading');
    try {
      const data = await fetchPlaces(map.getCenter(), {signal:controller.signal});
      if (disposed || !enabled || request !== controller || controller.signal.aborted) return;
      ensure(); features = data.features; map.getSource(source).setData(data);
      onState(features.length ? 'ready' : 'empty', features.length);
    } catch (error) {
      if (disposed || !enabled || request !== controller || controller.signal.aborted) return;
      clear(); onState(error.code === 503 ? 'unconfigured' : 'error');
    } finally {
      if (request === controller) request = null;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    // Remove old data immediately: a failed/moved live request must not leave
    // an earlier offer visible. Do not store a catalogue or persistent cache.
    request?.abort(); request = null; clear();
    if (enabled && !disposed) timer = setTimeout(refresh, 450);
  };
  const click = event => {
    if (!enabled || disposed || !map.getLayer(layer)) return;
    const {x,y} = event.point;
    const hit = map.queryRenderedFeatures([[x-12,y-12],[x+12,y+12]],{layers:[layer]})[0];
    const chosen = hit && features.find(feature => String(feature.id) === String(hit.id));
    if (chosen) onOpen?.(chosen, features);
  };
  map.on('moveend', schedule); map.on('click', click);
  return {
    setEnabled(value) {
      enabled = Boolean(value); clearTimeout(timer); request?.abort(); request = null; clear();
      if (enabled) { ensure(); refresh(); } else onState('idle');
    },
    destroy() {
      disposed = true; enabled = false; clearTimeout(timer); request?.abort(); request = null; clear();
      map.off('moveend', schedule); map.off('click', click);
      if (map.getLayer(layer)) map.removeLayer(layer);
      if (map.getSource(source)) map.removeSource(source);
    }
  };
}
