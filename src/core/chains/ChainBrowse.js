import {ShopAreaCache} from './ShopAreaCache.js?v=0.4.73';
import {EnvironmentShopCache} from './EnvironmentShopCache.js?v=0.4.73';
import {fetchShopSource} from './ShopSource.js?v=0.4.73';
import { CHAIN_CATALOG } from './ChainCatalog.js?v=0.4.73';
import {CHAIN_ENDPOINT} from './ChainSyncService.js?v=0.4.73';
export class ChainBrowse {
 constructor({fetcher=(...args)=>fetch(...args),clock=()=>Date.now(),requestIntervalMs=1100,forceRefresh=false,useAreaStorage=false}={}){this.fetcher=fetcher;this.clock=clock;this.cache=new Map();this.pending=new Map();this.worldRetryAt=0;this.areas=[];this.requestIntervalMs=requestIntervalMs;this.lastMapRequestAt=0;this.shopStorage=new EnvironmentShopCache(fetcher);this.forceRefresh=forceRefresh;this.useAreaStorage=useAreaStorage;this.diskCache=new ShopAreaCache();this.localRefreshes=new Map();this.updatedBounds=new Set();}
 async request(input,signal){
  if(this.useAreaStorage&&input.world&&input.action==='map'){
   const saved=await this.shopStorage.area(input.bounds,{signal,force:this.forcedBounds?.delete(JSON.stringify(input.bounds))===true,onUpdate:()=>{setTimeout(async()=>{const key='map:'+JSON.stringify([input.bounds,input.chainId||'']);this.cache.delete(key);await this.diskCache.delete(key);this.areaUpdated(input.bounds);},0);}});
   if(saved)return saved;
  }
  const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,60000);
  try{
  const response=await this.fetcher(CHAIN_ENDPOINT,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:1,...input}),signal:controller.signal});
  if(!response.ok)throw Error(response.status===503?'De winkelbron is tijdelijk niet beschikbaar.':'Winkelgegevens ophalen is niet gelukt.');
  const data=await response.json();
  if(data.schema!==1||!/^v1-[a-f0-9]{24}$/.test(data.version||'')||(input.action==='map'&&!Array.isArray(data.points)))throw Error('Ongeldige winkelgegevens.');
  return data;
  }catch(error){
    // HTTP, network and invalid world payloads all trigger bounded OSM fallback.
    if(input.world&&!signal?.aborted){
      // A server timeout must not consume the direct source attempt's budget.
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      return fetchShopSource(input,{fetcher:this.fetcher,signal});
    }
    throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async cached(key,input,signal){
  const persistent=this.useAreaStorage&&input.action==='map'&&input.world;
  const forced=input.bounds&&this.forcedBounds?.has(JSON.stringify(input.bounds));
  const old=forced?null:this.cache.get(key)||(persistent?await this.diskCache.get(key):null);
  if(old&&this.clock()-old.at<300000){this.cache.set(key,old);return old.data;}
  const refresh=async()=>{
   const data=await this.request(input,signal);
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   const entry={at:this.clock(),data};this.cache.set(key,entry);
   while(this.cache.size>128)this.cache.delete(this.cache.keys().next().value);
   if(persistent)await this.diskCache.put(key,entry);
   return data;
  };
  if(old&&persistent){
   this.cache.set(key,old);
   if(!this.localRefreshes.has(key)){
    const work=refresh().then(()=>{setTimeout(()=>{this.areaUpdated(input.bounds);},0);}).catch(()=>{}).finally(()=>this.localRefreshes.delete(key));
    this.localRefreshes.set(key,work);
   }
   return {...old.data,stale:true};
  }
  try{return await refresh();}catch(error){if(old&&!signal?.aborted)return old.data;throw error;}
 }
 async catalog(signal){let data;try{data=await this.cached('catalog',{action:'catalog'},signal);}catch(error){if(signal?.aborted)throw error;this.cache.set('catalog',{at:this.clock(),data:{chains:CHAIN_CATALOG}});return CHAIN_CATALOG;}
  if(!Array.isArray(data.chains)||data.chains.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'))throw Error('Ongeldige ketencatalogus.');return data.chains;
 }
 areaUpdated(bounds){
  this.areas=this.areas.filter(a=>!a.bounds.every((v,i)=>v===bounds[i]));
  this.updatedBounds.add(JSON.stringify(bounds));this.onStoredUpdate?.();
 }
 setViewport(bounds){this.exploreBounds=[...bounds];}
 async progressiveArea(bounds,chainId='',signal,onProgress=()=>{}){
  this.setViewport(bounds);
  const points=new Map(),visited=new Set(),diskChecked=new Set();let truncated=false,message='',incomplete=false,loaded=0,networkLoads=0;
  const force=this.forceRefresh;this.forceRefresh=false;this.forcedBounds=new Set();
  // One source request at a time. Replan after every result using the latest view.
  // A finite budget prevents a zoomed-out map from crawling an entire city.
  while(networkLoads<32&&loaded<64){
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   for(const key of this.updatedBounds)visited.delete(key);this.updatedBounds.clear();
   const plan=shopAreaPlan(this.exploreBounds,64);
   const cacheKey=b=>'map:'+JSON.stringify([b,chainId]);
   if(this.useAreaStorage&&!force)await Promise.all(plan.boxes.map(async b=>{
    const key=cacheKey(b);if(diskChecked.has(key)||this.cache.has(key))return;diskChecked.add(key);
    const entry=await this.diskCache.get(key);if(entry)this.cache.set(key,entry);
   }));
   // Cached cells first: a slow unknown cell must not hide previously discovered shops.
   const candidates=plan.boxes.filter(b=>!visited.has(JSON.stringify(b)));
   const box=candidates.find(b=>this.cache.has(cacheKey(b)))||candidates[0];
   incomplete=plan.incomplete;
   if(!box)break;
   const key=JSON.stringify(box);visited.add(key);
   if(force){this.forcedBounds.add(key);this.areas=this.areas.filter(a=>!a.bounds.every((v,i)=>v===box[i]));}
   const known=!force&&(this.cache.has(cacheKey(box))||this.areas.some(a=>!a.fallback&&!a.data.truncated&&(a.chainId===chainId||a.chainId==='')&&box[0]>=a.bounds[0]&&box[1]>=a.bounds[1]&&box[2]<=a.bounds[2]&&box[3]<=a.bounds[3]));
   if(!known&&this.lastMapRequestAt){const ms=this.requestIntervalMs-(this.clock()-this.lastMapRequestAt);if(ms>0)await waitForShopRequest(ms,signal);}
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   if(!known)this.lastMapRequestAt=this.clock();
   const result=await this.area(box,chainId,signal);loaded++;if(!known)networkLoads++;
   if(signal?.aborted)throw new DOMException('Aborted','AbortError');
   for(const p of result.points){if(points.size<2000||points.has(p.sourceRef))points.set(p.sourceRef,p);else truncated=true;}
   truncated||=result.truncated;message=result.message||message;
   const next=shopAreaPlan(this.exploreBounds,64);
   const remaining=next.boxes.some(b=>!visited.has(JSON.stringify(b)));
   incomplete=next.incomplete||remaining;
   const loading=remaining&&networkLoads<32&&loaded<64&&points.size<2000;
   onProgress({points:[...points.values()],truncated,message,incomplete,loading,loaded,total:Math.min(64,loaded+next.boxes.filter(b=>!visited.has(JSON.stringify(b))).length)});
   if(!loading)break;
  }
  return {points:[...points.values()],truncated,message,incomplete,loading:false};
 }
 async area(bounds,chainId='',signal,visibleBounds=bounds){
  const needed=[Math.max(bounds[0],visibleBounds[0]),Math.max(bounds[1],visibleBounds[1]),Math.min(bounds[2],visibleBounds[2]),Math.min(bounds[3],visibleBounds[3])];
  if(this.areas.some(a=>!a.fallback&&!a.data.truncated&&(a.chainId===chainId||a.chainId==='')&&needed[0]>=a.bounds[0]&&needed[1]>=a.bounds[1]&&needed[2]<=a.bounds[2]&&needed[3]<=a.bounds[3]))return this.loadArea(bounds,chainId,signal,visibleBounds);
  const complete=this.areas.filter(a=>!a.data.truncated&&!a.fallback&&(a.chainId===chainId||a.chainId===''));
  let missing=[bounds],used=[];
  for(const area of complete){
   const next=[];for(const box of missing){const parts=subtractShopBounds(box,area.bounds);if(parts.length!==1||parts[0]!==box)used.push(area);next.push(...parts);}missing=next;
   if(!missing.length)break;
  }
  // Avoid a request fan-out when many old narrow viewports overlap.
  if(!used.length||missing.length>4)return this.loadArea(bounds,chainId,signal,visibleBounds);
  const points=new Map();let truncated=false,message='';
  for(const area of new Set(used)){const result=await this.loadArea(area.bounds,chainId,signal);for(const p of result.points)points.set(p.sourceRef,p);}
  for(const box of missing){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const result=await this.loadArea(box,chainId,signal);for(const p of result.points)points.set(p.sourceRef,p);truncated||=result.truncated;message=result.message||message;}
  const visible=[...points.values()].filter(p=>p.coordinates.lng>=bounds[0]&&p.coordinates.lng<=bounds[2]&&p.coordinates.lat>=bounds[1]&&p.coordinates.lat<=bounds[3]);
  return {points:visible.slice(0,2000),truncated:truncated||visible.length>2000,message};
 }
 async loadArea(bounds,chainId='',signal,visibleBounds=bounds){
  // Keep successful discovery for this session. Rendering and board selection
  // remain independent of whether a point currently lies inside the viewport.
  const needed=[Math.max(bounds[0],visibleBounds[0]),Math.max(bounds[1],visibleBounds[1]),Math.min(bounds[2],visibleBounds[2]),Math.min(bounds[3],visibleBounds[3])];
  const known=this.areas.find(area=>(!area.fallback||this.clock()-area.at<120000)&&(area.chainId===chainId||(area.chainId===''&&!area.data.truncated))&&
    (area.bounds.every((v,i)=>v===bounds[i])||(!area.data.truncated&&needed[0]>=area.bounds[0]&&needed[1]>=area.bounds[1]&&needed[2]<=area.bounds[2]&&needed[3]<=area.bounds[3])));
  let data=known?.data,fallback=known?.fallback||false;
  const inNetherlands=bounds[0]>=3&&bounds[2]<=8&&bounds[1]>=50&&bounds[3]<=54.5;
  if(!known)try{
    if(this.clock()<this.worldRetryAt)throw Error('De wereldwijde winkelbron is tijdelijk niet beschikbaar.');
    data=await this.cached('map:'+JSON.stringify([bounds,chainId]),{action:'map',bounds,chainId,world:true},signal);
  }catch(error){
    if(signal?.aborted)throw error;
    this.worldRetryAt=this.clock()+120000;
    if(!inNetherlands)throw error;
    data=await this.cached('map:nl:'+JSON.stringify([bounds,chainId]),{action:'map',bounds,chainId},signal);fallback=true;
  }
  if(!Array.isArray(data.points)||data.points.length>2000)throw Error('Ongeldige kaartpunten.');
  const points=data.points.map(row=>{
   if(!Array.isArray(row)||row.length!==6||!/^[-_A-Za-z0-9]{12}$/.test(row[0])||typeof row[1]!=='string'||!Number.isInteger(row[2])||!Number.isInteger(row[3])||Math.abs(row[2])>180000000||Math.abs(row[3])>90000000||typeof row[4]!=='string'||! /^(node|way|relation)\/[1-9][0-9]*$/.test(row[5]))throw Error('Ongeldig kaartpunt.');
   return {id:row[0],chainId:row[1],coordinates:{lng:row[2]/1e6,lat:row[3]/1e6},name:row[4],sourceRef:row[5],status:'active',remote:true,world:data.coverage==='WORLD',kind:typeof data.kinds?.[row[0]]==='string'?data.kinds[row[0]]:undefined};
  }).filter(point=>!chainId||point.chainId===chainId);
  if(!known){this.areas.push({bounds:[...bounds],chainId,data,fallback,at:this.clock()});while(this.areas.length>128)this.areas.shift();}
  return {points,truncated:data.truncated===true,message:fallback?'Nederlandse winkelgegevens · wereldwijde bron tijdelijk niet bereikbaar.':data.stale?'Opgeslagen winkels · actualiteit wordt gecontroleerd.':''};
 }
 async detail(branch,signal){
  if(!signal){if(this.pending.has(branch.id))return this.pending.get(branch.id);const request=this.detail(branch,new AbortController().signal).finally(()=>this.pending.delete(branch.id));this.pending.set(branch.id,request);return request;}
  const data=await this.cached('detail:'+branch.id,{action:'detail',id:branch.id,...(branch.world?{world:true,sourceRef:branch.sourceRef}:{})},signal),d=data.detail;
  if(!d||d.id!==branch.id||d.chainId!==branch.chainId||d.sourceRef!==branch.sourceRef||typeof d.address!=='string'||typeof d.openingHours!=='string')throw Error('Ongeldige vestigingsdetails.');
  let website='';try{const url=new URL(d.website);if(url.protocol==='https:'&&!url.username&&!url.password)website=url.href;}catch{}
  return {...branch,organizationId:d.organizationId,countryCode:d.countryCode,sources:d.sources,kind:d.kind||branch.kind,address:d.address,openingHours:d.openingHours,website,remote:false};
 }
}

// Match Wikipedia's discovery range; requests stay bounded even on world views.
export const CHAIN_RADIUS_METERS = 10000;
export function chainAreaBounds(center,radius=CHAIN_RADIUS_METERS) {
 const lat=Number(center?.lat),lng=Number(center?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 const angle=Math.min(CHAIN_RADIUS_METERS,Math.max(100,Number(radius)||CHAIN_RADIUS_METERS))/6371008.8,latDelta=angle*180/Math.PI;
 const lngDelta=Math.asin(Math.min(1,Math.sin(angle)/Math.max(1e-9,Math.cos(lat*Math.PI/180))))*180/Math.PI;
 const bounds=[lng-lngDelta,lat-latDelta,lng+lngDelta,lat+latDelta];
 // The current API accepts a single, non-wrapping box up to one degree wide.
 return bounds[0]>=-180&&bounds[2]<=180&&bounds[1]>=-90&&bounds[3]<=90&&2*lngDelta<=1?bounds:null;
}

// Limit discovery to the visible map; the 10 km box remains an upper bound.
export function shopViewportBounds(center,viewport,radius=CHAIN_RADIUS_METERS){
 const limit=chainAreaBounds(center,radius);if(!limit||!viewport)return limit;
 const [w,s,e,n]=viewport;if(![w,s,e,n].every(Number.isFinite)||w>=e||s>=n)return limit;
 const bounds=[Math.max(w,limit[0]),Math.max(s,limit[1]),Math.min(e,limit[2]),Math.min(n,limit[3])];
 return bounds[0]<bounds[2]&&bounds[1]<bounds[3]?bounds:limit;
}

// Rectangle difference: disjoint strips, with no duplicate interior coverage.
export function subtractShopBounds(box,covered){
 const [w,s,e,n]=box,[a,b,c,d]=covered,x=Math.max(w,a),y=Math.max(s,b),u=Math.min(e,c),v=Math.min(n,d);
 if(x>=u||y>=v)return [box];
 return [[w,s,x,n],[u,s,e,n],[x,s,u,y],[x,v,u,n]].filter(r=>r[0]<r[2]&&r[1]<r[3]);
}

// Stable small cells let nearby viewports reuse coverage. Only intersecting
// rectangles are requested; wide views explicitly remain partially searched.
export function shopAreaPlan(bounds,limit=4){
 const [w,s,e,n]=bounds,step=0.002;
 if(![w,s,e,n].every(Number.isFinite)||w>=e||s>=n||e-w>1||n-s>1)throw Error('Ongeldig winkelgebied');
 const boxes=[],cx=(w+e)/2,cy=(s+n)/2;
 const xs=Array.from({length:Math.ceil(e/step)-Math.floor(w/step)},(_,i)=>Math.floor(w/step)+i);
 const ys=Array.from({length:Math.ceil(n/step)-Math.floor(s/step)},(_,i)=>Math.floor(s/step)+i);
 const total=xs.length*ys.length;
 xs.sort((a,b)=>Math.abs((a+.5)*step-cx)-Math.abs((b+.5)*step-cx));
 ys.sort((a,b)=>Math.abs((a+.5)*step-cy)-Math.abs((b+.5)*step-cy));
 for(const x of xs.slice(0,limit))for(const y of ys.slice(0,limit)){
  const box=[Math.max(w,x*step),Math.max(s,y*step),Math.min(e,(x+1)*step),Math.min(n,(y+1)*step)];
  if(box[0]<box[2]&&box[1]<box[3])boxes.push(box);
 }
 boxes.sort((a,b)=>Math.hypot((a[0]+a[2])/2-cx,(a[1]+a[3])/2-cy)-Math.hypot((b[0]+b[2])/2-cx,(b[1]+b[3])/2-cy));
 return {boxes:boxes.slice(0,limit),incomplete:total>limit};
}
function waitForShopRequest(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
