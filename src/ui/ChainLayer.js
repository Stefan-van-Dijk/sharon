import { ChainBrowse } from '../core/chains/ChainBrowse.js?v=0.4.26';
import { placeHidden, activePlace } from './PlaceFeedback.js?v=0.4.26';
import { OSM_MAP_CREDIT } from './EnvironmentAttribution.js?v=0.4.26';
import { openLocationDeck } from './LocationDeck.js?v=0.4.26';
import { openBoardViewer } from './BoardViewer.js?v=0.4.26';
import { localBranches, saveBranchLocation, branchZone } from '../core/chains/ChainModel.js?v=0.4.26';
import { CHAIN_CATALOG } from '../core/chains/ChainCatalog.js?v=0.4.26';
import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.4.26';
export function mountChainLayer(map,library,{store,events,location,root,initialChainId='',beforeOpen=()=>{}}={}){
  const toggle=root.querySelector('[data-chain-toggle]'),select=root.querySelector('[data-chain-filter]'),status=root.querySelector('[data-chain-status]');
  let enabled=Boolean(initialChainId),selected=initialChainId,branches=[],disposed=false,popup=null,revision=0,focusPending=Boolean(initialChainId),places=[],closeDeck=null;
  const sheet=root.querySelector('[data-places-sheet]'),list=root.querySelector('[data-places-list]'),search=root.querySelector('[data-places-search]');
  const listeners=[];
  const browse=new ChainBrowse(),canBrowse=typeof map.getBounds==='function'&&typeof map.getZoom==='function';
  let catalog=CHAIN_CATALOG,remote=[],local=[],request=null,timer=null,queryRevision=0,boardRevision=0,loadMessage='';
  const paintOptions=()=>{select.replaceChildren(new Option('Alle bekende locaties',''));select.append(new Option('Opgeslagen locaties','@local'));for(const chain of catalog)select.append(new Option(chain.name,chain.id));select.value=selected;};
  const loadArea=async()=>{
    const run=++queryRevision;request?.abort();request=null;
    if(disposed||!canBrowse||!enabled||selected==='@local')return;
    request=new AbortController();const signal=request.signal;
    try{const value=await browse.catalog(signal);if(disposed||run!==queryRevision)return;catalog=value;paintOptions();}catch(error){if(disposed||signal.aborted)return;loadMessage=error.message+' Lokale gegevens blijven beschikbaar.';draw();return;}
    if(map.getZoom()<12){remote=[];branches=local;loadMessage='Zoom verder in om winkelvestigingen op te halen.';draw();return;}
    const b=map.getBounds();const bounds=[Math.floor(b.getWest()*50)/50,Math.floor(b.getSouth()*50)/50,Math.ceil(b.getEast()*50)/50,Math.ceil(b.getNorth()*50)/50];
    if(bounds[2]-bounds[0]>1||bounds[3]-bounds[1]>.5){loadMessage='Zoom verder in om winkelvestigingen op te halen.';draw();return;}
    loadMessage='Winkelvestigingen ophalen…';draw();
    try{const area=await browse.area(bounds,selected,signal);if(disposed||run!==queryRevision)return;remote=area.points;const merged=new Map(local.map(p=>[p.sourceRef,p]));for(const p of remote)merged.set(p.sourceRef,p);branches=[...merged.values()];loadMessage=area.truncated?'Veel vestigingen: zoom verder in of kies een keten.':'';draw();}
    catch(error){if(disposed||run!==queryRevision||signal.aborted)return;remote=[];branches=local;loadMessage=error.message+' Lokale gegevens blijven beschikbaar.';draw();}
  };
  const schedule=()=>{clearTimeout(timer);if(!disposed)timer=setTimeout(loadArea,400);};
  const listen=(node,name,fn,options)=>{node?.addEventListener(name,fn,options);listeners.push(()=>node?.removeEventListener(name,fn,options));};
  const showSheet=value=>{
    sheet?.classList.toggle('is-open',value);sheet?.setAttribute('aria-hidden',String(!value));toggle.setAttribute('aria-expanded',String(value));
    if(value){const wiki=root.querySelector('[data-source-sheet]');wiki?.classList.remove('is-open');wiki?.setAttribute('aria-hidden','true');root.querySelector('[data-wiki-settings]')?.setAttribute('aria-expanded','false');}
  };
  const ownTitle=item=>String(item.data?.title||item.data?.name||'Locatie');
  const ownAddress=item=>typeof item.data?.address==='string'?item.data.address:[item.data?.address?.street,item.data?.address?.houseNumber,item.data?.address?.city].filter(Boolean).join(' ');
  const openPlace=item=>{
    beforeOpen();popup?.remove();closeDeck?.();showSheet(false);
    if(item.type==='location'){
      closeDeck=openLocationDeck({store,objects:places,selected:{properties:{id:item.id}},map,location,events,onLocation:place=>focus(place.data.coordinates)});
      focus(item.data.coordinates);
    }else showBranch(item);
  };
  const focus=point=>{if(point)map.easeTo({center:[Number(point.lng),Number(point.lat)],zoom:15,duration:400});};
  const showBranch=branch=>{
    closeDeck?.();closeDeck=null;const ticket=++boardRevision;focus(branch.coordinates);activePlace(branch.coordinates);let replacing=false;
    const available=branches.filter(item=>!selected||item.chainId===selected),index=available.findIndex(item=>item.id===branch.id);
    const render=current=>{
      if(closeDeck){replacing=true;closeDeck();replacing=false;}
      closeDeck=openBoardViewer({geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{title:branch.name}},{location,events,
        onClose:()=>{if(!replacing){boardRevision++;activePlace();}},localBoard:{feedbackId:branch.sourceRef,feedbackReference:{source:'openstreetmap',id:branch.sourceRef,uri:'https://www.openstreetmap.org/'+branch.sourceRef},title:branch.name,credit:'© OpenStreetMap',creditUrl:'https://www.openstreetmap.org/copyright',creditDescription:'© OpenStreetMap contributors · Open Database License (ODbL)',type:chainName(branch.chainId),address:current.address||'',description:[current.openingHours,current.loading,current.status==='possibly-closed'?'Mogelijk gesloten':''].filter(Boolean).join(' · '),website:current.website||'https://www.openstreetmap.org/'+branch.sourceRef,
          save:async()=>{const complete=current.remote?await browse.detail(branch):current;const record=await saveBranchLocation(store,complete);events?.emit('location.created',{id:record.id});events?.emit('cards.context.check');}},
        onNext:available.length>1?()=>showBranch(available[(index+1)%available.length]):null,
        onPrevious:available.length>1?()=>showBranch(available[(index+available.length-1)%available.length]):null});
    };
    render(branch.remote?{...branch,loading:'Vestigingsdetails ophalen…'}:branch);
    if(branch.remote)browse.detail(branch).then(full=>{if(!disposed&&ticket===boardRevision)render(full);}).catch(()=>{if(!disposed&&ticket===boardRevision)render({...branch,loading:'Details tijdelijk niet beschikbaar. Open de bron voor meer informatie.'});});
  };
  const chainName=id=>catalog.find(chain=>chain.id===id)?.name||'Winkel';
  const drawList=()=>{
    if(!list)return;
    const term=(search?.value||'').trim().toLocaleLowerCase('nl');
    const ownRefs=new Set(places.map(item=>item.data?.branchId).filter(Boolean));
    const candidates=[...places.filter(item=>!selected||selected==='@local'||item.data?.chainId===selected),...(selected==='@local'?[]:branches.filter(item=>(!selected||item.chainId===selected)&&!ownRefs.has(item.id)))];
    const matches=candidates.filter(item=>{const own=item.type==='location';return [own?ownTitle(item):item.name,own?ownAddress(item):item.address,own?'':chainName(item.chainId)].join(' ').toLocaleLowerCase('nl').includes(term);});
    const center=map.getCenter?.()||location?.latest;
    if(center)matches.sort((a,b)=>distanceMeters(center,a.data?.coordinates||a.coordinates)-distanceMeters(center,b.data?.coordinates||b.coordinates));
    list.replaceChildren();
    for(const item of matches.slice(0,30)){
      const button=document.createElement('button');button.type='button';
      const title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=item.type==='location'?ownTitle(item):item.name;
      detail.textContent=item.type==='location'?ownAddress(item)||'Opgeslagen locatie':[chainName(item.chainId),item.address,item.status==='possibly-closed'?'Mogelijk gesloten':''].filter(Boolean).join(' · ');
      if(placeHidden(item))detail.textContent+=' · Verborgen op de kaart';
      button.append(title,detail);button.addEventListener('click',()=>openPlace(item));list.append(button);
    }
    if(!matches.length){const empty=document.createElement('p');empty.textContent=term?'Geen locaties gevonden.':'Nog geen locaties in deze selectie. Bewaar een locatie of koppel een keten aan een kaart.';list.append(empty);}
    if(matches.length>30){const more=document.createElement('small');more.textContent='30 van '+matches.length+' · zoek op naam of adres voor andere locaties.';list.append(more);}
  };
  const source='sharon-chain-branches',points='sharon-chain-points',clusters='sharon-chain-clusters';
  map.addSource(source,{type:'geojson',data:{type:'FeatureCollection',features:[]},attribution:OSM_MAP_CREDIT});
  map.addLayer({id:points,type:'circle',source,paint:{'circle-radius':6,'circle-color':'#fff','circle-stroke-color':['case',['==',['get','status'],'possibly-closed'],'#a2aaa8','#486c65'],'circle-stroke-width':2}});
  const draw=()=>{
    const visible=enabled?branches.filter(branch=>(!selected||branch.chainId===selected)&&!placeHidden(branch)&&(!canBrowse||(()=>{const b=map.getBounds();return branch.coordinates.lng>=b.getWest()&&branch.coordinates.lng<=b.getEast()&&branch.coordinates.lat>=b.getSouth()&&branch.coordinates.lat<=b.getNorth();})())):[];
    map.getSource(source)?.setData({type:'FeatureCollection',features:visible.flatMap(branch=>branch.coordinates?[{type:'Feature',id:branch.id,
      geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{id:branch.id,chainId:branch.chainId,title:branch.name,status:branch.status}}]:[])});
    toggle.setAttribute('aria-pressed',String(enabled));select.hidden=sheet?false:!enabled;status.hidden=sheet?false:!enabled;
    status.textContent=loadMessage||places.length+' opgeslagen locaties · '+visible.length+' lokale vestigingen'+(branches.length?'':'. Vestigingen worden beschikbaar na de eerste geslaagde import.');
    drawList();
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
    local=all.filter(branch=>ids.has(branch.chainId)&&branch.coordinates);const merged=new Map(local.map(p=>[p.sourceRef,p]));for(const p of remote)merged.set(p.sourceRef,p);branches=[...merged.values()];
    places=objects.filter(item=>item.type==='location'&&!item.deletedAt&&!item.archivedAt&&Number.isFinite(item.data?.coordinates?.lat)&&Number.isFinite(item.data?.coordinates?.lng));
    paintOptions();draw();schedule();
  };
  const onToggle=()=>{if(sheet?.classList.contains('is-open')){showSheet(false);return;}enabled=!enabled;popup?.remove();draw();schedule();};
  const onSelect=()=>{selected=select.value;popup?.remove();remote=[];branches=local;draw();schedule();};
  listen(toggle,'click',onToggle);listen(select,'change',onSelect);
  listen(search,'input',drawList);listen(root.querySelector('[data-places-close]'),'click',()=>showSheet(false));
  let start=null,suppressClick=false;
  listen(toggle,'touchstart',event=>{const touch=event.touches[0];start=touch?{x:touch.clientX,y:touch.clientY}:null;suppressClick=false;},{passive:true});
  listen(toggle,'touchend',event=>{const touch=event.changedTouches[0];if(start&&touch&&start.y-touch.clientY>35&&Math.abs(touch.clientX-start.x)<start.y-touch.clientY){suppressClick=true;enabled=true;draw();showSheet(true);schedule();}start=null;},{passive:true});
  listen(toggle,'touchcancel',()=>{start=null;suppressClick=false;},{passive:true});
  listen(toggle,'click',event=>{if(suppressClick){suppressClick=false;event.stopImmediatePropagation();event.preventDefault();}},true);
  listen(toggle,'keydown',event=>{if(event.key==='ArrowUp'){event.preventDefault();enabled=true;draw();showSheet(true);schedule();}});
  let sheetStart=null;
  listen(sheet,'touchstart',event=>{sheetStart=event.target.closest('[data-places-handle],header')?event.touches[0]?.clientY:null;},{passive:true});
  listen(sheet,'touchend',event=>{if(sheetStart!=null&&event.changedTouches[0]?.clientY-sheetStart>70)showSheet(false);sheetStart=null;},{passive:true});
  const click=event=>{
    if(!enabled||disposed)return;
    const box=[[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]];
    const feature=map.queryRenderedFeatures(box,{layers:[points]})[0];if(!feature)return;
        const branch=branches.find(item=>item.id===feature.properties.id);if(!branch)return;
    if(sheet){openPlace(branch);return;}
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
  const offPlaces=['location.created','location.updated','location.deleted'].map(name=>events?.on(name,()=>refresh().catch(()=>{})));
  map.on('moveend',drawList);map.on('moveend',schedule);
  listen(window,'sharon-place-feedback-changed',event=>{draw();if(event.detail?.hidden)activePlace();});
  refresh().catch(()=>{status.hidden=false;status.textContent='Lokale winkelgegevens zijn niet beschikbaar.';});
  return {closeBoard(){boardRevision++;closeDeck?.();closeDeck=null;activePlace();},handles(event){return enabled&&!disposed&&map.queryRenderedFeatures([[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]],{layers:[points]}).length>0;},destroy(){disposed=true;revision++;queryRevision++;boardRevision++;request?.abort();clearTimeout(timer);popup?.remove();closeDeck?.();off?.();offCards?.();offPlaces.forEach(off=>off?.());listeners.forEach(off=>off());map.off('click',click);map.off('moveend',drawList);map.off('moveend',schedule);}};
}
