import { inAnalysisRange, analysisFetchRadius, analysisRangeLabel, analysisRange, ANALYSIS_RANGE_EVENT } from './AnalysisRange.js?v=0.4.41';
import { SHOP_CATEGORIES, shopCategory } from '../core/chains/ChainCategories.js?v=0.4.41';
import { mountChainFilters } from './ChainFilters.js?v=0.4.41';
import { sortBoards, boardOrderMode, BOARD_ORDER_EVENT, loadBoardSummaries } from './BoardOrder.js?v=0.4.41';
import { closeBoardOrder } from './BoardOrderControls.js?v=0.4.41';
import { createBoardMapAlignment } from './BoardMapAlignment.js?v=0.4.41';
import { ChainBrowse, chainAreaBounds } from '../core/chains/ChainBrowse.js?v=0.4.41';
import { placeHidden, activePlace } from './PlaceFeedback.js?v=0.4.41';
import { OSM_MAP_CREDIT } from './EnvironmentAttribution.js?v=0.4.41';
import { openLocationDeck } from './LocationDeck.js?v=0.4.41';
import { openBoardViewer } from './BoardViewer.js?v=0.4.41';
import { localBranches, saveBranchLocation } from '../core/chains/ChainModel.js?v=0.4.41';
import { CHAIN_CATALOG } from '../core/chains/ChainCatalog.js?v=0.4.41';
import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.4.41';
export function mountChainLayer(map,library,{store,events,location,root,initialChainId='',onFocus=()=>{},beforeOpen=()=>{},onOpen=null}={}){
  const toggle=root.querySelector('[data-chain-toggle]'),select=root.querySelector('[data-chain-filter]'),status=root.querySelector('[data-chain-status]');
  let enabled=Boolean(initialChainId),selected=initialChainId,branches=[],disposed=false,popup=null,revision=0,focusPending=Boolean(initialChainId),places=[],closeDeck=null;
  const sheet=root.querySelector('[data-places-sheet]'),list=root.querySelector('[data-places-list]'),search=root.querySelector('[data-places-search]');
  const listeners=[];
  const browse=new ChainBrowse(),canBrowse=typeof map.getBounds==='function'&&typeof map.getZoom==='function';
  let alignment=null;
  const inRange=branch=>{const center=map.getCenter?.()||location?.latest;return !center||inAnalysisRange(branch.coordinates,center);};
  let catalog=CHAIN_CATALOG,remote=[],local=[],request=null,timer=null,queryRevision=0,boardRevision=0,loadMessage='';
  const candidates=()=>{
    const own=places.filter(item=>!selected||selected==='@local'||item.data?.chainId===selected).filter(item=>inAnalysisRange(item.data?.coordinates,map.getCenter?.()||location?.latest));
    const refs=new Set(own.map(item=>item.data?.branchId).filter(Boolean));
    return [...own,...(selected==='@local'?[]:branches.filter(item=>(!selected||item.chainId===selected)&&inRange(item)&&!refs.has(item.id)))];
  };
  const filters=mountChainFilters(root,{getItems:candidates,getCatalog:()=>catalog,onChange:()=>{draw();window.dispatchEvent(new CustomEvent('sharon-chain-filters-changed'));}});
  const paintOptions=()=>{select.replaceChildren(new Option('Alle bekende locaties',''));select.append(new Option('Opgeslagen locaties','@local'));for(const chain of catalog)select.append(new Option(chain.name,chain.id));select.value=selected;};
  const loadArea=async()=>{
    const run=++queryRevision;request?.abort();request=null;
    if(disposed||!canBrowse||!enabled||selected==='@local')return;
    draw();
    if(map.getZoom()<11){loadMessage='Zoom verder in om winkels '+analysisRangeLabel()+' op te halen.';draw();return;}
    const bounds=chainAreaBounds(map.getCenter?.()||location?.latest,analysisFetchRadius());
    if(!bounds){loadMessage='Winkelbereik is hier niet beschikbaar.';draw();return;}
    request=new AbortController();const signal=request.signal;
    try{const value=await browse.catalog(signal);if(disposed||run!==queryRevision)return;catalog=value;paintOptions();}catch(error){if(disposed||signal.aborted)return;loadMessage=error.message+' Lokale gegevens blijven beschikbaar.';draw();return;}
    loadMessage='Winkelvestigingen ophalen…';draw();
    try{const area=await browse.area(bounds,selected,signal);if(disposed||run!==queryRevision)return;remote=analysisRange().unlimited?[...new Map([...remote,...area.points].map(item=>[item.sourceRef,item])).values()]:area.points.filter(inRange);loadBoardSummaries(remote);const merged=new Map(local.map(p=>[p.sourceRef,p]));for(const p of remote)merged.set(p.sourceRef,p);branches=[...merged.values()];loadMessage=area.truncated?'Veel vestigingen '+analysisRangeLabel()+': kies een keten om gerichter te zoeken.':'';draw();}
    catch(error){if(disposed||run!==queryRevision||signal.aborted)return;loadMessage=error.message+' Lokale gegevens blijven beschikbaar.';draw();}
  };
  const schedule=()=>{clearTimeout(timer);if(!disposed)timer=setTimeout(loadArea,400);};
  const listen=(node,name,fn,options)=>{node?.addEventListener(name,fn,options);listeners.push(()=>node?.removeEventListener(name,fn,options));};
  const showSheet=value=>{
    sheet?.classList.toggle('is-open',value);sheet?.setAttribute('aria-hidden',String(!value));toggle.setAttribute('aria-expanded',String(value));
    if(value){closeBoardOrder(root);const wiki=root.querySelector('[data-source-sheet]');wiki?.classList.remove('is-open');wiki?.setAttribute('aria-hidden','true');root.querySelector('[data-wiki-settings]')?.setAttribute('aria-expanded','false');}
  };
  const ownTitle=item=>String(item.data?.title||item.data?.name||'Locatie');
  const ownAddress=item=>typeof item.data?.address==='string'?item.data.address:[item.data?.address?.street,item.data?.address?.houseNumber,item.data?.address?.city].filter(Boolean).join(' ');
  const openPlace=item=>{
    beforeOpen();popup?.remove();closeDeck?.();showSheet(false);
    if(onOpen){onOpen(item);return;}
    if(item.type==='location'){
      closeDeck=openLocationDeck({store,objects:places,selected:{properties:{id:item.id}},map,location,events,category:SHOP_CATEGORIES[shopCategory(item,catalog)],onLocation:place=>focus(place.data.coordinates)});
    }else showBranch(item);
  };
  const focus=point=>{if(point){onFocus();map.easeTo({center:[Number(point.lng),Number(point.lat)],zoom:15,duration:400});}};
  const showBranch=(branch,deck=null,navigation=null)=>{
    const deckCenter=deck?.center||map.getCenter?.()||location?.latest;
    alignment?.destroy();alignment=null;closeDeck?.();closeDeck=null;const ticket=++boardRevision;focus(branch.coordinates);activePlace(branch.coordinates);let replacing=false;
    const order=deck||{center:deckCenter,mode:null,items:branches.filter(item=>(!selected||item.chainId===selected)&&inRange(item)&&!placeHidden(item))};
    if(order.mode!==boardOrderMode()){order.items=sortBoards(order.items,order.center);order.mode=boardOrderMode();}
    const available=order.items;
    const moveBranch=step=>{
      if(order.mode!==boardOrderMode()){order.items=sortBoards(order.items,order.center);order.mode=boardOrderMode();}
      const index=order.items.findIndex(item=>item.id===branch.id);
      showBranch(order.items[(index+step+order.items.length)%order.items.length],order);
    };
    alignment=createBoardMapAlignment(map,[branch.coordinates.lng,branch.coordinates.lat]);
    const render=current=>{
      if(closeDeck){replacing=true;closeDeck();replacing=false;}
      closeDeck=openBoardViewer({geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{title:branch.name}},{location,events,onLayout:alignment.onLayout,
        onClose:()=>{if(!replacing){boardRevision++;alignment?.destroy();activePlace();}},localBoard:{feedbackId:branch.sourceRef,feedbackReference:{source:'openstreetmap',id:branch.sourceRef,uri:'https://www.openstreetmap.org/'+branch.sourceRef},title:branch.name,category:SHOP_CATEGORIES[shopCategory(branch,catalog)],credit:'© OpenStreetMap',creditUrl:'https://www.openstreetmap.org/copyright',creditDescription:'© OpenStreetMap contributors · Open Database License (ODbL)',type:chainName(branch.chainId),address:current.address||'',description:[current.openingHours,current.loading,current.status==='possibly-closed'?'Mogelijk gesloten':''].filter(Boolean).join(' · '),website:current.website||'https://www.openstreetmap.org/'+branch.sourceRef,
          save:async()=>{const complete=current.remote?await browse.detail(branch):current;const record=await saveBranchLocation(store,complete);events?.emit('location.created',{id:record.id});events?.emit('cards.context.check');}},
        onNext:navigation?navigation.onNext:available.length>1?()=>moveBranch(1):null,
        onPrevious:navigation?navigation.onPrevious:available.length>1?()=>moveBranch(-1):null});
    };
    render(branch.remote?{...branch,loading:'Vestigingsdetails ophalen…'}:branch);
    if(branch.remote)browse.detail(branch).then(full=>{if(!disposed&&ticket===boardRevision)render(full);}).catch(()=>{if(!disposed&&ticket===boardRevision)render({...branch,loading:'Details tijdelijk niet beschikbaar. Open de bron voor meer informatie.'});});
  };
  const chainName=id=>catalog.find(chain=>chain.id===id)?.name||'Winkel';
  const drawList=()=>{
    if(!list)return;
    const term=(search?.value||'').trim().toLocaleLowerCase('nl');
    let matches=candidates().filter(item=>filters.matches(item)).filter(item=>{const own=item.type==='location';return [own?ownTitle(item):item.name,own?ownAddress(item):item.address,own?'':chainName(item.chainId)].join(' ').toLocaleLowerCase('nl').includes(term);});
    const center=map.getCenter?.()||location?.latest;
    matches=sortBoards(matches,center);
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
  let lastPoints='';
  const draw=()=>{
    const visible=enabled?branches.filter(branch=>(!selected||branch.chainId===selected)&&inRange(branch)&&filters.matches(branch)&&(!canBrowse||(()=>{const b=map.getBounds();return branch.coordinates.lng>=b.getWest()&&branch.coordinates.lng<=b.getEast()&&branch.coordinates.lat>=b.getSouth()&&branch.coordinates.lat<=b.getNorth();})())):[];
    const data={type:'FeatureCollection',features:visible.flatMap(branch=>branch.coordinates?[{type:'Feature',id:branch.id,
      geometry:{type:'Point',coordinates:[branch.coordinates.lng,branch.coordinates.lat]},properties:{id:branch.id,chainId:branch.chainId,title:branch.name,status:branch.status}}]:[])};
    const serialized=JSON.stringify(data);if(serialized!==lastPoints){lastPoints=serialized;map.getSource(source)?.setData(data);}
    toggle.setAttribute('aria-pressed',String(enabled));select.hidden=Boolean(sheet)||!enabled;status.hidden=sheet?false:!enabled;
    status.textContent=loadMessage||places.length+' opgeslagen locaties · '+visible.length+' vestigingen '+analysisRangeLabel()+''+(branches.length?'':'. Vestigingen worden beschikbaar na de eerste geslaagde import.');
    filters.update();drawList();
    const nearby=branches.filter(branch=>(!selected||branch.chainId===selected)&&inRange(branch)&&filters.matches(branch));
    if(focusPending&&nearby.length){
      const point=map.getCenter?.()||location?.latest;
      const nearest=point?[...nearby].sort((a,b)=>distanceMeters(point,a.coordinates)-distanceMeters(point,b.coordinates))[0]:nearby[0];
      focusPending=false;focus(nearest.coordinates);
    }
  };
  const refresh=async()=>{
    const run=++revision;
    const [all,objects]=await Promise.all([localBranches(store),store.getAll('objects')]);
    if(disposed||run!==revision)return;
    const ids=new Set(objects.filter(item=>item.type==='card'&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived').map(item=>item.chainId));
    local=all.filter(branch=>ids.has(branch.chainId)&&branch.coordinates);const merged=new Map(local.map(p=>[p.sourceRef,p]));for(const p of remote)merged.set(p.sourceRef,p);branches=[...merged.values()];
    places=objects.filter(item=>item.type==='location'&&!item.deletedAt&&!item.archivedAt&&Number.isFinite(item.data?.coordinates?.lat)&&Number.isFinite(item.data?.coordinates?.lng));
    loadBoardSummaries([...local.filter(inRange),...places]);
    paintOptions();draw();schedule();
  };
  const onToggle=()=>{closeBoardOrder(root);if(sheet?.classList.contains('is-open')){showSheet(false);return;}enabled=!enabled;popup?.remove();draw();window.dispatchEvent(new CustomEvent('sharon-chain-filters-changed'));schedule();};
  const onSelect=()=>{selected=select.value;popup?.remove();remote=[];branches=local;draw();window.dispatchEvent(new CustomEvent('sharon-chain-filters-changed'));schedule();};
  listen(toggle,'click',onToggle);listen(select,'change',onSelect);
  listen(root.querySelector('[data-places-search-toggle]'),'click',()=>{
    const field=root.querySelector('[data-places-search-field]'),button=root.querySelector('[data-places-search-toggle]');
    if(!field)return;field.hidden=!field.hidden;button.setAttribute('aria-expanded',String(!field.hidden));
    if(!field.hidden)search?.focus();else{search.value='';drawList();}
  });
  listen(search,'input',drawList);listen(root.querySelector('[data-places-close]'),'click',()=>showSheet(false));
  let start=null,suppressClick=false;
  listen(toggle,'touchstart',event=>{const touch=event.touches[0];start=touch?{x:touch.clientX,y:touch.clientY}:null;suppressClick=false;},{passive:true});
  listen(toggle,'touchend',event=>{const touch=event.changedTouches[0];if(start&&touch&&start.y-touch.clientY>35&&Math.abs(touch.clientX-start.x)<start.y-touch.clientY){suppressClick=true;enabled=true;draw();window.dispatchEvent(new CustomEvent('sharon-chain-filters-changed'));showSheet(true);schedule();}start=null;},{passive:true});
  listen(toggle,'touchcancel',()=>{start=null;suppressClick=false;},{passive:true});
  listen(toggle,'click',event=>{if(suppressClick){suppressClick=false;event.stopImmediatePropagation();event.preventDefault();}},true);
  listen(toggle,'keydown',event=>{if(event.key==='ArrowUp'){event.preventDefault();enabled=true;draw();window.dispatchEvent(new CustomEvent('sharon-chain-filters-changed'));showSheet(true);schedule();}});
  let sheetStart=null;
  listen(sheet,'touchstart',event=>{sheetStart=event.target.closest('[data-places-handle],header')?event.touches[0]?.clientY:null;},{passive:true});
  listen(sheet,'touchend',event=>{if(sheetStart!=null&&event.changedTouches[0]?.clientY-sheetStart>70)showSheet(false);sheetStart=null;},{passive:true});
  const click=event=>{
    if(!enabled||disposed)return;
    const box=[[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]];
    const feature=map.queryRenderedFeatures(box,{layers:[points]})[0];if(!feature)return;
        const branch=branches.find(item=>item.id===feature.properties.id);if(!branch)return;
    if(sheet||onOpen){openPlace(branch);return;}
    beforeOpen();focus(branch.coordinates);popup?.remove();const article=document.createElement('article');article.className='sh-chain-popup';
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
  listen(window,BOARD_ORDER_EVENT,draw);
  listen(window,ANALYSIS_RANGE_EVENT,()=>{draw();schedule();window.dispatchEvent(new CustomEvent('sharon-chain-filters-changed'));});
  listen(window,'sharon-information-changed',draw);
  listen(window,'sharon-place-feedback-changed',event=>{draw();if(event.detail?.hidden)activePlace();});
  refresh().catch(()=>{status.hidden=false;status.textContent='Lokale winkelgegevens zijn niet beschikbaar.';});
  const getBoards=()=>enabled?candidates().filter(item=>filters.matches(item)):[];
  return {getBoards,allowsLocation(item){return enabled?(!selected||selected==='@local'||item.data?.chainId===selected)&&filters.matches(item)&&inAnalysisRange(item.data?.coordinates,map.getCenter?.()||location?.latest):!placeHidden(item);},openBoard(item,navigation){
    if(item.type==='location'){
      closeDeck=openLocationDeck({store,objects:[item],selected:{properties:{id:item.id}},map,location,events,navigation,category:SHOP_CATEGORIES[shopCategory(item,catalog)],onLocation:place=>focus(place.data.coordinates)});
    }else showBranch(item,null,navigation);
  },closeBoard(){alignment?.destroy();boardRevision++;closeDeck?.();closeDeck=null;activePlace();},handles(event){return enabled&&!disposed&&map.queryRenderedFeatures([[event.point.x-14,event.point.y-14],[event.point.x+14,event.point.y+14]],{layers:[points]}).length>0;},destroy(){filters.destroy();alignment?.destroy();disposed=true;revision++;queryRevision++;boardRevision++;request?.abort();clearTimeout(timer);popup?.remove();closeDeck?.();off?.();offCards?.();offPlaces.forEach(off=>off?.());listeners.forEach(off=>off());map.off('click',click);map.off('moveend',drawList);map.off('moveend',schedule);}};
}
