const ENDPOINT='https://sharon.life/environment/api/tiles.php';
export class EnvironmentShopCache {
 constructor(fetcher){this.fetcher=fetcher;this.refreshing=new Set();this.background=Promise.resolve();}
 async call(action,bounds,{signal,force=false,timeoutMs}={}){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs??(action==='shops-read'?5000:15000));
  try{
   const response=await this.fetcher(ENDPOINT,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,bounds,force}),signal:controller.signal,redirect:'error'});
   if(!response.ok){
    const error=await response.json?.().catch(()=>null);
    this.unsupported=error?.error!=='shop_area_unavailable';
    if(response.status===503&&error?.error==='shop_area_unavailable')throw Object.assign(new Error('De winkelbron is bezet of tijdelijk niet beschikbaar.'),{shopSourceBusy:true});
    return null;
   }const data=await response.json();
   const valid=data.storage==='environment-shops-v1'&&data.schema===1&&Array.isArray(data.points);this.unsupported=!valid;return valid?data:null;
  }catch(error){if(signal?.aborted||error.shopSourceBusy)throw error;if(controller.signal.aborted&&action==='shops-refresh')throw Object.assign(new Error('De winkelbron reageert traag. Probeer het later opnieuw.'),{shopSourceBusy:true});return null;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async area(bounds,{signal,force=false,onUpdate=()=>{},discover}={}){
  if(force)return discover?discover():this.call('shops-refresh',bounds,{signal,force:true});
  let saved;
  try{saved=await this.call('shops-read',bounds,{signal,timeoutMs:discover?1000:undefined});}
  catch(error){if(signal?.aborted||!discover)throw error;}
  if(!saved&&discover&&this.unsupported)return null;
  if(!saved)return discover?discover():this.call('shops-refresh',bounds,{signal});
  // An existing four-character file may have no coverage or points in this cell.
  if(saved.stale&&saved.points.length===0&&discover)return discover();
  if(saved.stale){
   const key=JSON.stringify(bounds);
   if(!this.refreshing.has(key)){
    this.refreshing.add(key);
    // Keep old points visible while the source is checked. A failed refresh
    // never replaces a snapshot or advances its successful check date.
    (this.background=this.background.catch(()=>{}).then(()=>{if(signal?.aborted)return null;return discover?discover():this.call('shops-refresh',bounds,{signal});})).then(data=>{if(data&&!data.stale&&!signal?.aborted)onUpdate(data);}).catch(()=>{}).finally(()=>this.refreshing.delete(key));
   }
  }
  return saved;
 }
}
