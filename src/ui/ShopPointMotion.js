export const shopVisibility=['coalesce',['feature-state','shopVisibility'],1];
export const shopOpacity=opacity=>['*',shopVisibility,opacity];
export const shopRadius=size=>['*',size,['+',0.65,['*',0.35,shopVisibility]]];
// Animate feature state, not GeoJSON geometry: clustering is not rebuilt per frame.
export function createShopPointMotion(map,source,{reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true,clock=()=>performance.now(),frame=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}={}){
 const rows=new Map();let ticket=null,disposed=false;
 const write=()=>map.getSource(source)?.setData({type:'FeatureCollection',features:[...rows.values()].map(r=>r.feature)});
 const state=r=>map.setFeatureState({source,id:r.feature.id},{shopVisibility:r.value});
 function update(data){
  if(disposed)return;
  if(reduced||!map.setFeatureState){map.getSource(source)?.setData(data);return;}
  if(ticket!==null)cancel(ticket);ticket=null;const now=clock(),wanted=new Set(data.features.map(f=>f.id));
  for(const r of rows.values()){r.from=r.value;r.target=wanted.has(r.feature.id)?1:0;r.start=now;}
  for(const feature of data.features){const r=rows.get(feature.id);if(r)r.feature=feature;else rows.set(feature.id,{feature,from:0,value:0,target:1,start:now});}
  write();for(const r of rows.values())state(r);
  function tick(){
   if(disposed||!map.getSource(source)){ticket=null;return;}let active=false,removed=false;const now=clock();
   for(const [id,r] of rows){const t=Math.min(1,(now-r.start)/220),ease=1-(1-t)**3;r.value=r.from+(r.target-r.from)*ease;state(r);if(t<1&&r.from!==r.target)active=true;else if(r.target===0){rows.delete(id);removed=true;}}
   if(removed)write();ticket=active?frame(tick):null;
  }
  ticket=frame(tick);
 }
 return {update,destroy(){disposed=true;if(ticket!==null)cancel(ticket);rows.clear();}};
}
