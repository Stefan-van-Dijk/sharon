import {resolveLocation} from '../location/LocationHierarchy.js?v=0.5.23';
import {distanceBetween} from '../location/LocationTriggerService.js?v=0.5.23';
// Only confirmed local places and a fresh cached fix choose a mode; never request GPS here.
export function shopContextMode(objects,point,last='collect',now=Date.now()){
 const fallback=last==='check'?'check':'collect';
 if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>90||Math.abs(point.lng)>180||!Number.isFinite(point.at)||now-point.at<0||now-point.at>=120000||!Number.isFinite(point.accuracy)||point.accuracy<0)return fallback;
 const places=objects.filter(x=>x.type==='location'&&!x.deletedAt&&!x.archivedAt&&x.status!=='archived'),lookup=new Map(places.map(x=>[String(x.id),x]));
 const modes=new Set();
 for(const place of places){
  const kind=place.data?.kind;if(!['home','shop','supermarket'].includes(kind))continue;
  const coordinates=resolveLocation(place,lookup).coordinates;if(!coordinates)continue;
  const radius=Math.min(2000,Math.max(20,Number(place.data?.radiusM)||100));
  if(distanceBetween(point,coordinates)+point.accuracy<=radius)modes.add(kind==='home'?'collect':'check');
 }
 return modes.size===1?[...modes][0]:fallback;
}
export function shopPreview(payload,mode){
 const products=new Map((payload.products||[]).map(p=>[p.id,p]));
 const items=(payload.list.items||[]).filter(i=>Number(i.quantity)>0);
 const remaining=items.filter(i=>!i.done);
 return {total:items.length,done:items.length-remaining.length,remaining:remaining.length,rows:remaining.slice(0,4).map(i=>({name:products.get(i.productId)?.name||'Product',quantity:i.quantity})),mode};
}
