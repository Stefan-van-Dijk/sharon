import { chainById, CHAIN_CACHE_KEY } from '../core/chains/ChainCatalog.js?v=0.4.08';
import { localBranches, branchZone, saveBranchLocation } from '../core/chains/ChainModel.js?v=0.4.08';
import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.4.08';
import { ChainSyncService } from '../core/chains/ChainSyncService.js?v=0.4.08';
import { mountLocationArea } from './LocationAreaPreview.js?v=0.4.08';

const fresh=point=>point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Number.isFinite(point.at)&&Date.now()-point.at<120000&&point.at<=Date.now()&&Number.isFinite(point.accuracy)&&point.accuracy<=2000;
export function mountChainZonePanel(host,{card,store,location,events,onEnvironment=null}={}) {
  let disposed=false,viewer=null,selected='',branches=[],places=[],draftPoint=null,radius=100,rendering=0;
  const chain=chainById(card.chainId);if(!chain)return ()=>{};
  const sync=new ChainSyncService(store,{events});
  const changed=()=>{events?.emit('cards.context.check');events?.emit('location.updated',{});};
  const render=async()=>{
    const run=++rendering;
    const [all,objects,cached]=await Promise.all([localBranches(store,chain.id),store.getAll('objects'),store.get('meta',CHAIN_CACHE_KEY)]);
    if(disposed||run!==rendering)return;
    viewer?.dispose();viewer=null;
    branches=all;places=objects.filter(item=>item.type==='location'&&!item.deletedAt);
    const point=location?.latest;
    branches.sort((a,b)=>point?distanceMeters(point,a.coordinates||branchZone(a).center)-distanceMeters(point,b.coordinates||branchZone(b).center):a.name.localeCompare(b.name,'nl'));
    const choices=branches.slice(0,20);
    if(selected&&!choices.some(item=>item.id===selected)){
      const known=branches.find(item=>item.id===selected);if(known)choices.push(known);else selected='';
    }
    const nearby=fresh(point)?choices.filter(branch=>{
      const own=places.find(item=>item.data?.branchId===branch.id&&item.data.personalZone),zone=branchZone(branch);
      return distanceMeters(point,own?.data.coordinates||zone.center)<=(own?.data.radiusM||zone.radiusM)+point.accuracy;
    }):[];
    if(!selected&&nearby.length===1)selected=nearby[0].id;
    host.replaceChildren();host.className='sh-chain-panel';
    const title=document.createElement('strong');title.textContent=chain.name+' · vestigingen';
    const select=document.createElement('select');select.setAttribute('aria-label','Vestiging kiezen');select.dataset.chainBranch='';
    select.append(new Option(nearby.length>1?'Meerdere vestigingen hier: kies de juiste':'Kies een vestiging',''));
    for(const branch of choices)select.append(new Option([branch.name,branch.address||branch.sourceRef,branch.status==='possibly-closed'?'Mogelijk gesloten':''].filter(Boolean).join(' · '),branch.id));
    select.value=selected;select.addEventListener('change',()=>{selected=select.value;render().catch(()=>{});});
    const status=document.createElement('small');status.setAttribute('role','status');
    const version=cached?.value?.chains?.[chain.id];
    status.textContent=version?'Nederland · '+branches.length+' vestigingen · gecontroleerd '+new Date(version.lastCheckedAt).toLocaleDateString('nl-NL'):'Nog geen vestigingen op dit apparaat. Synchroniseer eenmalig voor offline herkenning.';
    const refresh=document.createElement('button');refresh.type='button';refresh.dataset.chainSync='';refresh.textContent='↻';refresh.setAttribute('aria-label','Vestigingen van '+chain.name+' synchroniseren');
    refresh.addEventListener('click',async()=>{refresh.disabled=true;status.textContent='Vestigingen bijwerken…';try{await sync.sync({forceChainId:chain.id});await render();}catch(error){if(!disposed){status.textContent=error.message;refresh.disabled=false;}}});
    const header=document.createElement('div');header.className='sh-chain-panel-header';header.append(title,refresh);host.append(header,status,select);
    const branch=branches.find(item=>item.id===selected);
    if(branch){
      const own=places.find(item=>item.data?.branchId===branch.id&&item.data.personalZone),coarse=branchZone(branch);
      draftPoint=own?.data.coordinates||coarse.center;radius=own?.data.radiusM||coarse.radiusM;
      const map=document.createElement('div');map.className='sh-chain-zone-map';
      const label=document.createElement('label');label.textContent=own?'Persoonlijke herkenningszone':'Globaal herkenningsgebied';
      const input=document.createElement('input');input.type='range';input.min='20';input.max='2000';input.step='10';input.value=String(radius);input.setAttribute('aria-label','Herkenningsstraal aanpassen');input.dataset.chainRadius='';input.disabled=!fresh(point);
      const value=document.createElement('span');value.textContent=radius+' m';
      viewer=mountLocationArea(map,{getPoint:()=>draftPoint,getRadius:()=>radius,getAccuracy:()=>location?.latest?.accuracy||0,getUserPoint:()=>location?.latest});
      input.addEventListener('input',()=>{
        if(!fresh(location?.latest))return;
        draftPoint={lat:location.latest.lat,lng:location.latest.lng};radius=Number(input.value);value.textContent=radius+' m';viewer?.update();
      });
      const save=async()=>{
        if(!fresh(location?.latest)){status.textContent='Een recente GPS-positie is nodig om je zone te bewaren.';return;}
        const snapshot={point:{...draftPoint},radiusM:radius,personal:true};
        try{await saveBranchLocation(store,branch,snapshot);if(!disposed){label.textContent='Persoonlijke herkenningszone';status.textContent='Zone opgeslagen voor deze vestiging.';}changed();}
        catch{if(!disposed)status.textContent='Zone bewaren is niet gelukt. Probeer opnieuw.';}
      };
      input.addEventListener('change',()=>{
        if(!fresh(location?.latest))return;
        draftPoint={lat:location.latest.lat,lng:location.latest.lng};radius=Number(input.value);void save();
      });
      label.append(input,value);host.append(map,label);
      const help=document.createElement('small');help.textContent=fresh(point)?'Loslaten bewaart de zone rond jouw huidige positie.':'Open Sharon met locatietoegang om je herkenningszone te verfijnen.';host.append(help);
      if(own){
        const reset=document.createElement('button');reset.type='button';reset.textContent='Persoonlijke verfijning verwijderen';
        reset.addEventListener('click',async()=>{
          try{const current=await store.get('objects',own.id);if(!current)return;await store.put('objects',{...current,updatedAt:new Date().toISOString(),data:{...current.data,personalZone:false}});changed();await render();}
          catch{status.textContent='Verfijning verwijderen is niet gelukt.';}
        });host.append(reset);
      }
    }
    const open=document.createElement('button');open.type='button';open.textContent='Bekijk '+chain.name+' in Omgeving';
    open.addEventListener('click',()=>{if(onEnvironment)onEnvironment(chain.id);else events?.emit('environment.chain.open',{chainId:chain.id});});host.append(open);
    const attribution=document.createElement('a');attribution.href='https://www.openstreetmap.org/copyright';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.textContent='© OpenStreetMap';attribution.className='sh-source-credit';attribution.title='© OpenStreetMap contributors · Open Database License (ODbL)';attribution.setAttribute('aria-label','OpenStreetMap: bron en ODbL-licentie bekijken');host.append(attribution);
  };
  const off=events?.on('chains.updated',()=>render().catch(()=>{}));
  const offLocation=events?.on('location.changed',()=>render().catch(()=>{}));
  render().catch(()=>{if(!disposed)host.textContent='Winkelgegevens zijn niet beschikbaar.';});
  return ()=>{disposed=true;rendering++;off?.();offLocation?.();viewer?.dispose();};
}
