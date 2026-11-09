const ENDPOINT='https://sharon.life/environment/api/tiles.php';
export class EnvironmentShopCache {
 constructor(fetcher){this.fetcher=fetcher;this.refreshing=new Set();}
 async call(action,bounds,{signal,force=false}={}){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,action==='shops-read'?5000:60000);
  try{
   const response=await this.fetcher(ENDPOINT,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,bounds,force}),signal:controller.signal,redirect:'error'});
   if(!response.ok)return null;const data=await response.json();
   return data.storage==='environment-shops-v1'&&data.schema===1&&Array.isArray(data.points)?data:null;
  }catch(error){if(signal?.aborted)throw error;return null;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 async area(bounds,{signal,force=false,onUpdate=()=>{}}={}){
  if(force)return this.call('shops-refresh',bounds,{signal,force:true});
  const saved=await this.call('shops-read',bounds,{signal});
  if(!saved)return this.call('shops-refresh',bounds,{signal});
  if(saved.stale){
   const key=JSON.stringify(bounds);
   if(!this.refreshing.has(key)){
    this.refreshing.add(key);
    // Keep old points visible while the source is checked. A failed refresh
    // never replaces a snapshot or advances its successful check date.
    this.call('shops-refresh',bounds,{signal}).then(data=>{if(data&&!data.stale&&!signal?.aborted)onUpdate();}).catch(()=>{}).finally(()=>this.refreshing.delete(key));
   }
  }
  return saved;
 }
}
