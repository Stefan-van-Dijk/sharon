import { CHAIN_CACHE_KEY, CHAIN_SYNC_INTERVAL, chainById } from './ChainCatalog.js?v=0.4.39';
import { decodeBranch } from './ChainModel.js?v=0.4.39';
export const CHAIN_ENDPOINT='https://sharon.life/log/api/chains.php';
export class ChainSyncService {
  constructor(store,{events=null,fetcher=(...args)=>fetch(...args),clock=()=>Date.now()}={}) {
    this.store=store;this.events=events;this.fetcher=fetcher;this.clock=clock;this.pending=null;
  }
  async sync({forceChainId=''}={}) {
    if(this.pending)return this.pending;
    this.pending=this.perform(forceChainId).catch(error=>{
      if(error.name==='TypeError'||error.name==='AbortError')throw Error('Winkelgegevens konden niet worden bijgewerkt. Je bestaande gegevens blijven beschikbaar.');
      throw error;
    }).finally(()=>{this.pending=null;});return this.pending;
  }
  async perform(forceChainId) {
    const objects=await this.store.getAll('objects');
    const ids=[...new Set(objects.filter(item=>item.type==='card'&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived').map(item=>item.chainId).filter(id=>chainById(id)))].sort();
    const old=(await this.store.get('meta',CHAIN_CACHE_KEY))?.value || {schema:1,chains:{}};
    const kept=Object.fromEntries(Object.entries(old.chains).filter(([id])=>ids.includes(id)));
    if(Object.keys(kept).length!==Object.keys(old.chains).length) await (this.store.setMeta?this.store.setMeta(CHAIN_CACHE_KEY,{schema:1,chains:kept}):this.store.put('meta',{key:CHAIN_CACHE_KEY,value:{schema:1,chains:kept}}));
    if(!ids.length || (forceChainId && !ids.includes(forceChainId)))return {checked:false};
    if(!forceChainId && ids.every(id=>kept[id]?.lastCheckedAt && this.clock()-kept[id].lastCheckedAt<CHAIN_SYNC_INTERVAL))return {checked:false};
    const requested=forceChainId?[forceChainId]:ids;
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await this.fetcher(CHAIN_ENDPOINT,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:1,chains:requested.map(id=>({id,version:kept[id]?.version||''}))}),signal:controller.signal});
      if(!response.ok)throw Error(response.status===503?'De vestigingenlijst wordt nog voorbereid. Je kunt deze kaart al aan een eigen locatie koppelen.':'Winkelgegevens konden niet worden bijgewerkt.');
      const data=await response.json();
      if(data.schema!==1 || data.coverage!=='NL' || !Array.isArray(data.chains) || data.chains.length!==requested.length)throw Error('Ongeldig ketenregister.');
      const changes=new Map();
      for(const item of data.chains){
        if(!requested.includes(item.id)||changes.has(item.id)||!/^v1-[a-f0-9]{24}$/.test(item.version||'') || !['full','delta','unchanged'].includes(item.mode))throw Error('Ongeldige ketenversie.');
        const before=kept[item.id];
        if(item.mode==='unchanged'&&item.version!==before?.version)throw Error('Ongeldige ongewijzigde ketenversie.');
        if(item.mode!=='full' && (!before || item.from!==before.version))throw Error('Ketenversie sluit niet aan.');
        const rows=new Map((item.mode==='full'?[]:before.rows).map(row=>[row[0],row]));
        if(item.mode!=='unchanged'){
          if(!Array.isArray(item.rows)||item.rows.length>50000||!Array.isArray(item.removed)||item.removed.some(id=>typeof id!=='string'))throw Error('Ongeldige vestigingswijziging.');
          for(const id of item.removed)rows.delete(id);
          const seen=new Set();
          for(const row of item.rows){decodeBranch(row,item.id);if(seen.has(row[0]))throw Error('Dubbele vestiging.');seen.add(row[0]);rows.set(row[0],row);}
        }
        changes.set(item.id,{version:item.version,rows:[...rows.values()],lastCheckedAt:this.clock(),coverage:'NL'});
      }
      // Re-read under an atomic update: another tab's newer version must survive.
      const apply=current=>{
        current=current||{schema:1,chains:{}};const chains={...current.chains};
        for(const [id,value] of changes){
          if((chains[id]?.version||'')!==(kept[id]?.version||''))continue;
          chains[id]=value;
        }
        return {schema:1,chains};
      };
      if(this.store.updateMeta)await this.store.updateMeta(CHAIN_CACHE_KEY,apply);
      else await this.store.put('meta',{key:CHAIN_CACHE_KEY,value:apply((await this.store.get('meta',CHAIN_CACHE_KEY))?.value)});
      this.events?.emit('chains.updated');this.events?.emit('cards.context.check');
      return {checked:true};
    } finally {clearTimeout(timer);}
  }
  start(target=window){
    let stopped=false,lastAttempt=0;
    const check=()=>{
      if(stopped||target.document?.hidden||target.navigator?.onLine===false||this.clock()-lastAttempt<60000)return;
      lastAttempt=this.clock();this.sync().catch(()=>{});
    };
    const off=this.events?.on('cards.changed',()=>{lastAttempt=0;if(this.pending)this.pending.finally(()=>{lastAttempt=0;check();}).catch(()=>{});else check();});
    const timer=target.setInterval?.(check,3600000);
    target.addEventListener('online',check);target.document?.addEventListener('visibilitychange',check);check();
    return ()=>{stopped=true;if(timer)target.clearInterval(timer);off?.();target.removeEventListener('online',check);target.document?.removeEventListener('visibilitychange',check);};
  }
}
