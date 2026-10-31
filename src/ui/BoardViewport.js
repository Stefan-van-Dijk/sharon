// Keep discovered source boards scoped to the currently visible map area.
export function inBoardViewport(map,point){
  const bounds=map?.getBounds?.();if(!bounds||!point)return true;
  const west=bounds.getWest?.(),east=bounds.getEast?.(),south=bounds.getSouth?.(),north=bounds.getNorth?.();
  if(![west,east,south,north,point.lat,point.lng].every(Number.isFinite))return true;
  if(point.lat<south||point.lat>north)return false;
  if(Math.abs(east-west)>=360)return true;
  const right=east<west?east+360:east;
  const lng=point.lng+360*Math.ceil((west-point.lng)/360);
  return lng>=west&&lng<=right;
}
