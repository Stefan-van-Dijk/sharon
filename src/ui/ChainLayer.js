import { placeHidden, activePlace } from './PlaceFeedback.js?v=0.3.95';
import { OSM_MAP_CREDIT } from './EnvironmentAttribution.js?v=0.3.95';
import { openLocationDeck } from './LocationDeck.js?v=0.3.95';
import { openBoardViewer } from './BoardViewer.js?v=0.3.95';
import { localBranches, saveBranchLocation, branchZone } from '../core/chains/ChainModel.js?v=0.3.95';
import { CHAIN_CATALOG } from '../core/chains/ChainCatalog.js?v=0.3.95';
import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.3.95';
export function mountChainLayer(map,library,{store,events,location,root,initialChainId='',beforeOpen=()=>{}}={}){
  const toggle=root.querySelector('[data-chain-toggle]'),select=root.querySelector('[data-chain-filter]'),status=root.querySelector('[data-chain-status]');
  let enabled=Boolean(initialChainId),selected=initialChainId,branches=[],disposed=false,popup=null,revision=0,focusPending=Boolean(initialChainId),places=[],closeDeck=null;
  const sheet=root.querySelector('[data-places-sheet]'),list=root.querySelector('[data-places-list]'),search=root.querySelector('[data-places-search]');
  const listeners=[];
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
    closeDeck?.();focus(branch.coordinates);activePlace(branch.coordinates);
    const available=branches.filter(item=>!selected||item.chainId===selected),index=available.findIndex(item=>item.id===branch.id);
    closeDeck=openBoardViewer({geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{title:branch.name}},{location,events,
      onClose:()=>activePlace(),localBoard:{feedbackId:branch.sourceRef,feedbackReference:{source:'openstreetmap',id:branch.sourceRef,uri:'https://www.openstreetmap.org/'+branch.sourceRef},title:branch.name,credit:'© OpenStreetMap',creditUrl:'https://www.openstreetmap.org/copyright',creditDescription:'© OpenStreetMap contributors · Open Database License (ODbL)',type:chainName(branch.chainId),address:branch.address,description:[branch.openingHours,branch.status==='possibly-closed'?'Mogelijk gesloten':''].filter(Boolean).join(' · '),website:'https://www.openstreetmap.org/'+branch.sourceRef,
        save:async()=>{const record=await saveBranchLocation(store,branch);events?.emit('location.created',{id:record.id});events?.emit('cards.context.check');}},
      onNext:available.length>1?()=>showBranch(available[(index+1)%available.length]):null,
      onPrevious:available.length>1?()=>showBranch(available[(index+available.length-1)%available.length]):null});
  };
  const chainName=id=>CHAIN_CATALOG.find(chain=>chain.id===id)?.name||'Winkel';
  const drawList=()=>{
    if(!list)return;
    const term=(search?.value||'').trim().toLocaleLowerCase('nl');
    const ownRefs=new Set(places.map(item=>item.data?.branchId).filter(Boolean));
    const candidates=[...places.filter(item=>!selected||selected==='@local'||item.data?.chainId===selected),...(selected==='@local'?[]:branches.filter(item=>(!selected||item.chainId===selected)&&!ownRefs.has(item.id)))];
    const matches=candidates.filter(item=>{const own=item.type==='location';return [own?ownTitle(item):item.name,own?ownAddress(item):item.address].join(' ').toLocaleLowerCase('nl').includes(term);});
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
    const visible=enabled?branches.filter(branch=>(!selected||branch.chainId===selected)&&!placeHidden(branch)):[];
    map.getSource(source)?.setData({type:'FeatureCollection',features:visible.flatMap(branch=>branch.coordinates?[{type:'Feature',id:branch.id,
      geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{id:branch.id,chainId:branch.chainId,title:branch.name,status:branch.status}}]:[])});
    toggle.setAttribute('aria-pressed',String(enabled));select.hidden=sheet?false:!enabled;status.hidden=sheet?false:!enabled;
    status.textContent=places.length+' opgeslagen locaties · '+visible.length+' lokale vestigingen'+(branches.length?'':'. Vestigingen worden beschikbaar na de eerste geslaagde import.');
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
    branches=all.filter(branch=>ids.has(branch.chainId)&&branch.coordinates);
    places=objects.filter(item=>item.type==='location'&&!item.deletedAt&&!item.archivedAt&&Number.isFinite(item.data?.coordinates?.lat)&&Number.isFinite(item.data?.coordinates?.lng));
    select.replaceChildren(new Option('Alle bekende locaties',''));
    select.append(new Option('Opgeslagen locaties','@local'));
    for(const chain of CHAIN_CATALOG.filter(chain=>ids.has(chain.id)))select.append(new Option(chain.name,chain.id));
    if(selected!=='@local'&&!ids.has(selected))selected='';select.value=selected;draw();
  };
  const onToggle=()=>{if(sheet?.classList.contains('is-open')){showSheet(false);return;}enabled=!enabled;popup?.remove();draw();};
  const onSelect=()=>{selected=select.value;popup?.remove();draw();};
  listen(toggle,'click',onToggle);listen(select,'change',onSelect);
  listen(search,'input',drawList);listen(root.querySelector('[data-places-close]'),'click',()=>showSheet(false));
  let start=null,suppressClick=false;
  listen(toggle,'touchstart',event=>{const touch=event.touches[0];start=touch?{x:touch.clientX,y:touch.clientY}:null;suppressClick=false;},{passive:true});
  listen(toggle,'touchend',event=>{const touch=event.changedTouches[0];if(start&&touch&&start.y-touch.clientY>35&&Math.abs(touch.clientX-start.x)<start.y-touch.clientY){suppressClick=true;enabled=true;draw();showSheet(true);}start=null;},{passive:true});
  listen(toggle,'touchcancel',()=>{start=null;suppressClick=false;},{passive:true});
  listen(toggle,'click',event=>{if(suppressClick){suppressClick=false;event.stopImmediatePropagation();event.preventDefault();}},true);
  listen(toggle,'keydown',event=>{if(event.key==='ArrowUp'){event.preventDefault();enabled=true;draw();showSheet(true);}});
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
  map.on('moveend',drawList);
  listen(window,'sharon-place-feedback-changed',event=>{draw();if(event.detail?.hidden)activePlace();});
  refresh().catch(()=>{status.hidden=false;status.textContent='Lokale winkelgegevens zijn niet beschikbaar.';});
  return {closeBoard(){closeDeck?.();closeDeck=null;activePlace();},handles(event){return enabled&&!disposed&&map.queryRenderedFeatures([[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]],{layers:[points]}).length>0;},destroy(){disposed=true;revision++;popup?.remove();closeDeck?.();off?.();offCards?.();offPlaces.forEach(off=>off?.());listeners.forEach(off=>off());map.off('click',click);map.off('moveend',drawList);}};
}
