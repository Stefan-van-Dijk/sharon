export const BOARD_DISCOVERY_KEY='sharon.boards.discover-while-browsing.v1';
export function boardDiscoveryEnabled(){try{return JSON.parse(localStorage.getItem(BOARD_DISCOVERY_KEY)||'false')===true;}catch{return false;}}
const locks=new WeakMap(),listeners=new WeakMap();
export const boardViewportLocked=map=>Boolean(locks.get(map));
export function onBoardViewportLock(map,listener){
  if(!listeners.has(map))listeners.set(map,new Set());listeners.get(map).add(listener);
  return ()=>listeners.get(map)?.delete(listener);
}
export function lockBoardViewport(map){
  if(boardDiscoveryEnabled())return ()=>{};
  const b=map.getBounds?.();
  const bounds=b?{getWest:()=>b.getWest(),getEast:()=>b.getEast(),getSouth:()=>b.getSouth(),getNorth:()=>b.getNorth()}:null;
  // Capture numbers: a renderer may mutate its bounds object on movement.
  const values=bounds?[bounds.getWest(),bounds.getEast(),bounds.getSouth(),bounds.getNorth()]:null;
  const token={bounds:values?{getWest:()=>values[0],getEast:()=>values[1],getSouth:()=>values[2],getNorth:()=>values[3]}:null};
  locks.set(map,token);for(const listener of listeners.get(map)||[])listener();
  return ()=>{if(locks.get(map)===token)locks.delete(map);};
}
// Keep discovered source boards scoped to the currently visible map area.
export function inBoardViewport(map,point){
  const bounds=locks.get(map)?.bounds||map?.getBounds?.();if(!bounds||!point)return true;
  const west=bounds.getWest?.(),east=bounds.getEast?.(),south=bounds.getSouth?.(),north=bounds.getNorth?.();
  if(![west,east,south,north,point.lat,point.lng].every(Number.isFinite))return true;
  if(point.lat<south||point.lat>north)return false;
  if(Math.abs(east-west)>=360)return true;
  const right=east<west?east+360:east;
  const lng=point.lng+360*Math.ceil((west-point.lng)/360);
  return lng>=west&&lng<=right;
}
