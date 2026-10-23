import { localBranches, saveBranchLocation, branchZone } from '../core/chains/ChainModel.js?v=0.3.85';
import { CHAIN_CATALOG } from '../core/chains/ChainCatalog.js?v=0.3.85';
import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.3.85';
export function mountChainLayer(map,library,{store,events,location,root,initialChainId=''}={}){
  const toggle=root.querySelector('[data-chain-toggle]'),select=root.querySelector('[data-chain-filter]'),status=root.querySelector('[data-chain-status]');
  let enabled=Boolean(initialChainId),selected=initialChainId,branches=[],disposed=false,popup=null,revision=0,focusPending=Boolean(initialChainId);
  const source='sharon-chain-branches',points='sharon-chain-points',clusters='sharon-chain-clusters';
  map.addSource(source,{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterRadius:45,clusterMaxZoom:13,attribution:'© OpenStreetMap contributors'});
  map.addLayer({id:clusters,type:'circle',source,filter:['has','point_count'],paint:{'circle-radius':16,'circle-color':'#486c65','circle-stroke-color':'#fff','circle-stroke-width':2}});
  map.addLayer({id:source+'-counts',type:'symbol',source,filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count_abbreviated']],'text-size':11},paint:{'text-color':'#fff'}});
  map.addLayer({id:points,type:'circle',source,filter:['!', ['has','point_count']],paint:{'circle-radius':7,'circle-color':['case',['==',['get','status'],'possibly-closed'],'#a2aaa8','#486c65'],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  const draw=()=>{
    const visible=enabled?branches.filter(branch=>!selected||branch.chainId===selected):[];
    map.getSource(source)?.setData({type:'FeatureCollection',features:visible.flatMap(branch=>branch.coordinates?[{type:'Feature',id:branch.id,
      geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{id:branch.id,chainId:branch.chainId,title:branch.name,status:branch.status}}]:[])});
    toggle.setAttribute('aria-pressed',String(enabled));select.hidden=!enabled;status.hidden=!enabled;
    status.textContent=visible.length?visible.length+' lokale vestigingen': 'Koppel bij Kaarten een keten en synchroniseer de vestigingen.';
    if(focusPending&&visible.length){
      const point=location?.latest;
      const nearest=point?[...visible].sort((a,b)=>distanceMeters(point,a.coordinates||branchZone(a).center)-distanceMeters(point,b.coordinates||branchZone(b).center))[0]:null;
      map.easeTo(nearest?.coordinates?{center:[nearest.coordinates.lng,nearest.coordinates.lat],zoom:15,duration:400}:{center:[5.3,52.2],zoom:7,duration:400});focusPending=false;
    }
  };
  const refresh=async()=>{
    const run=++revision;
    const [all,objects]=await Promise.all([localBranches(store),store.getAll('objects')]);
    if(disposed||run!==revision)return;
    const ids=new Set(objects.filter(item=>item.type==='card'&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived').map(item=>item.chainId));
    branches=all.filter(branch=>ids.has(branch.chainId));
    select.replaceChildren(new Option('Alle gekoppelde ketens',''));
    for(const chain of CHAIN_CATALOG.filter(chain=>ids.has(chain.id)))select.append(new Option(chain.name,chain.id));
    if(!ids.has(selected))selected='';select.value=selected;draw();
  };
  const onToggle=()=>{enabled=!enabled;popup?.remove();draw();};
  const onSelect=()=>{selected=select.value;popup?.remove();draw();};
  toggle.addEventListener('click',onToggle);select.addEventListener('change',onSelect);
  const click=event=>{
    if(!enabled||disposed)return;
    const box=[[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]];
    const feature=map.queryRenderedFeatures(box,{layers:[points,clusters]})[0];if(!feature)return;
    if(feature.properties.point_count){map.easeTo({center:feature.geometry.coordinates,zoom:map.getZoom()+2});return;}
    const branch=branches.find(item=>item.id===feature.properties.id);if(!branch)return;
    popup?.remove();const article=document.createElement('article');article.className='sh-chain-popup';
    const title=document.createElement('strong');title.textContent=branch.name;
    const address=document.createElement('p');address.textContent=branch.address;
    article.append(title,address);
    if(branch.status==='possibly-closed'){const note=document.createElement('small');note.textContent='Mogelijk gesloten: deze vestiging ontbreekt in de laatste bronselectie.';article.append(note);}
    if(branch.openingHours){const hours=document.createElement('p');hours.textContent=branch.openingHours;article.append(hours);}
    const save=document.createElement('button');save.type='button';save.textContent='Bewaar bij Locaties';
    const message=document.createElement('small');message.setAttribute('role','status');
    save.addEventListener('click',async()=>{
      save.disabled=true;
      try{const record=await saveBranchLocation(store,branch);message.textContent='Bewaard bij Locaties.';events?.emit('location.created',{id:record.id});events?.emit('cards.context.check');}
      catch{message.textContent='Bewaren is niet gelukt.';save.disabled=false;}
    });
    const link=document.createElement('a');link.href='https://www.openstreetmap.org/'+branch.sourceRef;link.target='_blank';link.rel='noopener noreferrer';link.textContent='OpenStreetMap ↗';
    article.append(save,message,link);
    popup=new library.Popup({maxWidth:'280px'}).setLngLat(feature.geometry.coordinates).setDOMContent(article).addTo(map);
  };
  map.on('click',click);
  const off=events?.on('chains.updated',()=>refresh().catch(()=>{}));
  const offCards=events?.on('cards.changed',()=>refresh().catch(()=>{}));
  refresh().catch(()=>{status.hidden=false;status.textContent='Lokale winkelgegevens zijn niet beschikbaar.';});
  return {handles(event){return enabled&&!disposed&&map.queryRenderedFeatures([[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]],{layers:[points,clusters]}).length>0;},destroy(){disposed=true;revision++;popup?.remove();off?.();offCards?.();toggle.removeEventListener('click',onToggle);select.removeEventListener('change',onSelect);map.off('click',click);}};
}
