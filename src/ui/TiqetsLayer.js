import { inBoardViewport, boardViewportLocked, onBoardViewportLock } from './BoardViewport.js?v=0.4.55';
import { inAnalysisRange, ANALYSIS_RANGE_EVENT } from './AnalysisRange.js?v=0.4.55';
import { sortBoards } from './BoardOrder.js?v=0.4.55';
import { fetchTiqetsPlaces } from './TiqetsSource.js?v=0.4.55';

const EMPTY = {type:'FeatureCollection',features:[]};
export function mountTiqetsLayer(map, {onOpen, onState = () => {}, fetchPlaces = fetchTiqetsPlaces} = {}) {
  const source = 'sharon-tiqets', layer = 'sharon-tiqets-points';
  const rangeEvents = globalThis.window;
  let enabled = false, disposed = false, timer, request, features = [];
  const discovered = new Map(); // session only, never persisted: offers may change
  const ensure = () => {
    if (!map.getSource(source)) map.addSource(source, {type:'geojson',data:EMPTY});
    if (!map.getLayer(layer)) map.addLayer({
      id:layer,type:'circle',source,
      paint:{'circle-radius':7,'circle-color':'#fff','circle-stroke-color':'#008b88','circle-stroke-width':2.5}
    });
  };
  const visible=()=>features.filter(feature=>{const [lng,lat]=feature.geometry.coordinates;return inAnalysisRange({lng,lat},map.getCenter())&&inBoardViewport(map,{lng,lat});});
  const rangeChanged=()=>{if(enabled)map.getSource(source)?.setData({type:'FeatureCollection',features:visible()});};
  rangeEvents?.addEventListener(ANALYSIS_RANGE_EVENT,rangeChanged);
  const clear = () => { features = []; map.getSource(source)?.setData(EMPTY); };
  const recount = () => onState(discovered.size ? 'ready' : 'empty', enabled ? discovered.size : 0);
  const render = () => { features = [...discovered.values()]; map.getSource(source)?.setData({type:'FeatureCollection',features:enabled ? visible() : []}); };
  const refresh = async () => {
    if (!enabled || disposed || boardViewportLocked(map) || !map.isStyleLoaded()) return;
    request?.abort();
    if (map.getZoom() < 11) { render(); onState('zoom'); return; }
    const controller = new AbortController(); request = controller;
    onState('loading');
    try {
      const data = await fetchPlaces(map.getCenter(), {signal:controller.signal});
      if (disposed || !enabled || request !== controller || controller.signal.aborted) return;
      ensure(); for (const item of data.features) discovered.set(String(item.id),item);
      render(); recount();
    } catch (error) {
      if (disposed || !enabled || request !== controller || controller.signal.aborted) return;
      render(); onState(error.code === 503 ? 'unconfigured' : 'error');
    } finally {
      if (request === controller) request = null;
    }
  };
  const schedule = () => {
    clearTimeout(timer);if(boardViewportLocked(map))return;
    // Remove old data immediately: a failed/moved live request must not leave
    // an earlier offer visible. Do not store a catalogue or persistent cache.
    request?.abort(); request = null;
    if (enabled && !disposed) timer = setTimeout(refresh, 450);
  };
  const click = event => {
    if (!enabled || disposed || !map.getLayer(layer)) return;
    const {x,y} = event.point;
    const hit = map.queryRenderedFeatures([[x-12,y-12],[x+12,y+12]],{layers:[layer]})[0];
    const chosen = hit && features.find(feature => String(feature.id) === String(hit.id));
    if (chosen) onOpen?.(chosen, sortBoards(features,map.getCenter()));
  };
  const stopAreaLock=onBoardViewportLock(map,()=>{request?.abort();request=null;clearTimeout(timer);onState(features.length?'ready':'idle',features.length);});
  map.on('moveend', schedule); map.on('click', click);
  return {
    acceptsBoard(board){return enabled&&features.some(item=>String(item.id)===String(board.id));},
    getBoards(){return enabled?[...discovered.values()]:[];},
    handles(event){return enabled&&!disposed&&!!map.getLayer(layer)&&map.queryRenderedFeatures([[event.point.x-12,event.point.y-12],[event.point.x+12,event.point.y+12]],{layers:[layer]}).length>0;},
    setEnabled(value) {
      enabled = Boolean(value); clearTimeout(timer); request?.abort(); request = null;
      if (enabled) { ensure(); render(); recount(); refresh(); } else { clear(); onState('idle',0); }
    },
    resetSession() { request?.abort(); request=null; clearTimeout(timer); discovered.clear(); clear(); if (enabled) { recount(); schedule(); } else onState('idle',0); },
    destroy() {
      rangeEvents?.removeEventListener(ANALYSIS_RANGE_EVENT,rangeChanged);
      stopAreaLock();disposed = true; enabled = false; clearTimeout(timer); request?.abort(); request = null; clear();
      map.off('moveend', schedule); map.off('click', click);
      if (map.getLayer(layer)) map.removeLayer(layer);
      if (map.getSource(source)) map.removeSource(source);
    }
  };
}
