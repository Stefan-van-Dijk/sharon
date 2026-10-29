import { renderListControls } from './ListControls.js?v=0.4.31';
import { cardSymbol, applyCardAppearance } from './CardSymbols.js?v=0.4.31';
import { locationIcon } from '../core/location/LocationTypeRegistry.js?v=0.4.31';
import { renderObjectStrip } from './ObjectStrip.js?v=0.4.31';
import { sortList } from '../core/storage/ListOrder.js?v=0.4.31';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.4.31';
import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.4.31';
import { wrapBoardSurface } from './BoardChrome.js?v=0.4.31';
import { sharingRecords, refreshQrShares } from './SharingStatus.js?v=0.4.31';
import { saveReceivedCard, buildLocationPayload } from './ReceivedObjects.js?v=0.4.31';
export { saveReceivedCard } from './ReceivedObjects.js?v=0.4.31';
import { publishTransfer } from './ObjectTransfer.js?v=0.4.31';
import { renderCardCode } from './CardCodes.js?v=0.4.31';
import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.31';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.4.31';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.4.31';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.4.31';

export function openCardShare(card,{store,onClose=()=>{},onStatusChange=()=>{},location:deviceLocation=null}) {
  const isLocation=card.type==='location';
  const layer=document.createElement('div');layer.className='sh-card-share-overlay';
  layer.innerHTML='<section class="sh-card-share-dialog sh-share-board" role="dialog" aria-modal="true" aria-label="Kaart delen met personen"><div class="sh-share-fixed sh-card-media" data-card-media><button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button><div class="sh-share-qr-panel"><h2 class="sh-share-side sh-share-side-left" data-share-title></h2><div data-share-qr-slot></div><span class="sh-share-side sh-share-side-right" role="status" data-qr-status>Scan in Sharon</span></div><button type="button" class="sh-card-deck-grab sh-board-compass" data-deck-grab aria-label="Swipe naar rechts en sleep om het deelboard te verplaatsen" aria-pressed="false"><span data-deck-start aria-hidden="true"></span><span data-share-pill-label>Deel kaart</span></button><button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van QR en informatie aanpassen"></button></div><div class="sh-share-board-info"><div data-share-location-option hidden><input type="checkbox" data-share-location hidden><button type="button" class="sh-share-location-source" data-share-location-toggle aria-label="Locatie meesturen" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg></button><p data-share-location-preview hidden></p></div><div data-share-summary-slot></div><div data-share-person-panel><div data-share-toolbar></div><div data-share-people></div><button type="button" data-share-send disabled>Deel met geselecteerde personen</button></div><p role="status" data-share-status>Contacten laden…</p></div></section>';
  const toolbar=layer.querySelector('[data-share-toolbar]');
  toolbar.innerHTML=renderListControls({placeholder:'Zoek persoon',near:true,logical:true,sort:'logical'});
  toolbar.dataset.shareSearchWrap='';toolbar.querySelector('input').dataset.shareSearch='';
  const surface=layer.firstElementChild;surface.dataset.cardBoard='';surface.tabIndex=-1;
  const stack=wrapBoardSurface(layer,surface);stack.classList.add('sh-share-zone-stack');
  let gestures=null,introTimer=null,introStarted=false,introCancelled=false;
  const info=layer.querySelector('.sh-share-board-info');
  const stopIntro=()=>{introCancelled=true;clearTimeout(introTimer);};
  for(const event of ['pointerdown','keydown','wheel','touchstart'])layer.addEventListener(event,stopIntro,{capture:true,passive:true});
  const previewToolbar=()=>{
    if(introStarted||introCancelled||!contacts.length)return;
    introStarted=true;
    introTimer=setTimeout(()=>{
      if(disposed||introCancelled||!layer.isConnected)return;
      const top=info.scrollTop+toolbar.getBoundingClientRect().bottom-info.getBoundingClientRect().top;
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(info.scrollTo)info.scrollTo({top,behavior:reduced?'instant':'smooth'});
      else info.scrollTop=top;
    },500);
  };

  const title=layer.querySelector('[data-share-title]');
  const icon=document.createElement('span');icon.dataset.shareItemIcon='';icon.setAttribute('aria-hidden','true');
  icon.innerHTML=isLocation?locationIcon(card.data?.kind):cardSymbol(card.cardKind);
  const titleText=document.createElement('span');titleText.textContent=card.name||card.data?.title||'Locatie';
  title.append(titleText);layer.querySelector('.sh-share-fixed').append(icon);
  if(!isLocation)applyCardAppearance(icon,card.color);
  const color=isLocation?(card.data?.color||card.color):card.color;
  layer.querySelector('.sh-share-fixed').style.setProperty('--share-accent',/^#[0-9a-f]{6}$/i.test(color||'')?color:'#489ff8');
  if(isLocation){layer.querySelector('[data-share-pill-label]').textContent='Deel locatie';layer.querySelector('[role=dialog]').setAttribute('aria-label','Locatie delen');}
  document.body.append(layer);
  const service=new ConnectionService(store),selected=new Set(),sent=new Set(),retries=new Map();
  let disposed=false,busy=false,contacts=[],location=null,shareText=null,existingQr=null,ready=false,checking=true,qrBusy=false,autoQr=false,locationTouched=false,qrQueued=false,publicationOff=false,qrSettled=false;
  let relatedPeople=new Set(),places=[],shareRows=[],peopleOrder=[],prefs={sort:'logical'};
  const modes=['alpha','near','recent','logical','custom'];
  const sortLabels={alpha:'Alfabetisch',near:'Dichtbij',recent:'Recent',logical:'Logisch',custom:'Eigen volgorde'};
  const sortIcons={alpha:'A–Z',near:'⌖',recent:'◷',logical:'◇',custom:'↕'};
  const savePrefs=()=>store.put('meta',{key:'sharing.people.preferences',value:prefs}).catch(()=>{});
  const openSearch=()=>{layer.querySelector('[data-share-search-wrap]').hidden=false;paint();layer.querySelector('[data-share-search]').focus();};
  toolbar.querySelectorAll('[data-list-sort]').forEach(button=>button.addEventListener('click',()=>{prefs.sort=button.dataset.listSort;paint();savePrefs();}));
  const source=()=>({id:card.id,relatedIds:!isLocation&&locationChoice.checked&&card.locationId?[card.locationId]:[]});
  const sharing=document.createElement('div');sharing.className='sh-sharing-details';
  sharing.dataset.sharingDetails='';layer.querySelector('[data-share-summary-slot]').append(sharing);
  const paintSharing=async()=>{
    const rows=await sharingRecords(store,card.id);if(disposed)return;
    shareRows=rows;
    sharing.replaceChildren();
    const active=rows.filter(row=>row.sourceId===card.id&&row.channel==='qr'&&['online','unknown','pending'].includes(row.state)&&row.expiresAt>Date.now());
    const line=document.createElement('label');line.className='sh-share-publication-line';
    const caption=document.createElement('span');caption.textContent=active.some(row=>row.state==='online')?'QR-deling online':active.length?'QR-status niet bevestigd':'QR-deling offline';
    const toggle=document.createElement('input');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','QR-deling online');toggle.dataset.sharePublication='';toggle.checked=active.length>0;toggle.disabled=!ready||checking||qrBusy||busy;
    toggle.addEventListener('change',()=>setPublication(toggle.checked));line.append(caption,toggle);sharing.append(line);
    paint();
    existingQr=rows.find(row=>row.sourceId===card.id&&row.channel==='qr'&&['online','unknown'].includes(row.state)&&row.expiresAt>Date.now());
    if(existingQr&&!autoQr&&!locationTouched&&!busy&&shareText===null)locationChoice.checked=Boolean(existingQr.includeLocation);
    qr.textContent=existingQr?'Toon gedeelde QR':'Deel via korte QR';
    onStatusChange();
  };
  const locationChoice=layer.querySelector('[data-share-location]');
  const close=()=>{if(busy)return;if(disposed)return;disposed=true;stopIntro();gestures?.dispose();layer.remove();onClose();};
  const dispose=()=>{disposed=true;stopIntro();gestures?.dispose();layer.remove();};
  const status=message=>{if(!disposed)layer.querySelector('[data-share-status]').textContent=message;};
  const send=layer.querySelector('[data-share-send]');
  const contactShareLabel=contact=>{
    const rows=shareRows.filter(row=>row.channel==='chat'&&row.chatId===contact.chatId);
    const confirmed=rows.filter(row=>row.state==='sent').sort((a,b)=>Number(b.verifiedAt)-Number(a.verifiedAt))[0];
    const parts=[];
    if(confirmed)parts.push('Gedeeld · '+new Date(confirmed.verifiedAt).toLocaleString('nl-NL'));
    else if(sent.has(contact.personId))parts.push('Gedeeld');
    if(rows.some(row=>row.state==='pending'))parts.push('Wacht op bevestiging');
    if(!parts.length&&relatedPeople.has(contact.personId))parts.push('Gekoppeld aan deze kaart of locatie');
    return parts.join(' · ');
  };
  const paint=()=>{
    if(disposed)return;
    const query=layer.querySelector('[data-share-search]').value.trim().toLocaleLowerCase('nl');
    const host=layer.querySelector('[data-share-people]');host.replaceChildren();
    const lookup=new Map(places.map(p=>[p.id,p]));
    const origin=deviceLocation?.latest||location?.coordinates;
    const distance=c=>Math.min(Infinity,...places.filter(p=>p.personIds?.includes(c.personId)).map(p=>{const point=resolveLocation(p,lookup).coordinates;return origin&&point?distanceBetween(origin,point):Infinity;}));
    let ranked=sortList(contacts.map(c=>({...c,id:c.personId})),{sort:prefs.sort,order:peopleOrder,distance});
    if(prefs.sort==='logical')ranked.sort((a,b)=>Number(relatedPeople.has(b.personId))-Number(relatedPeople.has(a.personId))||(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0)||a.name.localeCompare(b.name,'nl'));
    const suggested=ranked.filter(c=>c.name.toLocaleLowerCase('nl').includes(query));
    toolbar.querySelectorAll('[data-list-sort]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.listSort===prefs.sort)));
    layer.querySelector('[data-deck-grab]').setAttribute('aria-label',(isLocation?'Deel locatie':'Deel kaart')+' · swipe rechts om op te pakken en sleep om te verplaatsen.');
    for(const contact of suggested) {
      const row=document.createElement('div');row.className='sh-share-person-row';
      row.innerHTML=renderObjectStrip({module:'persons',id:contact.personId,title:contact.name,subtitle:contactShareLabel(contact),actions:[],trailingHtml:'<span aria-hidden="true">'+(selected.has(contact.personId)?'✓':'+')+'</span>'});
      const button=row.querySelector('[data-swipe-surface]');button.dataset.sharePerson=contact.personId;button.disabled=busy||sent.has(contact.personId);button.setAttribute('aria-pressed',String(selected.has(contact.personId)));
      button.addEventListener('click',()=>{if(selected.has(contact.personId))selected.delete(contact.personId);else selected.add(contact.personId);paint();});
      host.append(row);
    }
    qr.disabled=qrBusy||!ready||checking;
    const publication=layer.querySelector('[data-share-publication]');if(publication)publication.disabled=qrBusy||busy||!ready||checking;
    if(publicationOff)qr.hidden=true;
    if(ready&&!checking&&!autoQr){autoQr=true;queueMicrotask(()=>{if(!disposed&&!publicationOff)qr.click();});}
    if(ready&&!checking&&!qrBusy&&autoQr&&(publicationOff||qrSettled))previewToolbar();
    send.disabled=busy||![...selected].some(id=>!sent.has(id));
    locationChoice.disabled=busy||shareText!==null;
    const locationButton=layer.querySelector('[data-share-location-toggle]');locationButton.disabled=locationChoice.disabled;locationButton.setAttribute('aria-pressed',String(locationChoice.checked));
  };
  const controlDock=document.createElement('div');controlDock.className='sh-share-controls';
  controlDock.append(layer.querySelector('[data-deck-grab]'),layer.querySelector('[data-share-summary-slot]'));
  layer.querySelector('.sh-share-fixed').append(layer.querySelector('[data-share-location-option]'),controlDock);
  layer.querySelector('[data-share-location-toggle]').addEventListener('click',()=>locationChoice.click());
  locationChoice.addEventListener('change',()=>{locationTouched=true;paint();code.replaceChildren();if(publicationOff){qrNote('QR-deling offline.');return;}qr.hidden=false;if(qrBusy)qrQueued=true;else qr.click();});
  layer.querySelector('[data-share-search]').addEventListener('input',paint);
  gestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore:store,layoutKey:'sharing.board.layout',onGrabSearch:openSearch});
  layer.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  send.addEventListener('click',async()=>{
    if(busy)return;busy=true;paint();status(isLocation?'Locatie versturen…':'Kaart versturen…');
    try {
      const text=shareText??(isLocation?buildLocationPayload(location):buildCardPayload(card,{location:locationChoice.checked?location:null}));
      shareText=text;
      for(const contact of contacts.filter(c=>selected.has(c.personId)&&!sent.has(c.personId))) {
        if(!retries.has(contact.personId)) {
          const pending=(await service.cachedMessages(contact.chatId)).find(m=>m.text===text&&m.delivery==='pending'&&(!m.sharedObjectId||m.sharedObjectId===card.id));
          if(pending)retries.set(contact.personId,pending.id);
        }
        try {await service.send(contact.chatId,text,retries.get(contact.personId)||'',{source:{...source(),recipientName:contact.name}});sent.add(contact.personId);await paintSharing();}
        catch(error){
          const pending=(await service.cachedMessages(contact.chatId)).find(m=>m.text===text&&m.delivery==='pending'&&(!m.sharedObjectId||m.sharedObjectId===card.id));
          if(pending)retries.set(contact.personId,pending.id);
          throw error;
        }
      }
      status((isLocation?'Locatie':'Kaart')+' verstuurd naar '+contacts.filter(c=>sent.has(c.personId)).map(c=>c.name).join(', ')+'.');
    }catch(error){status((sent.size?'Al verstuurd naar '+sent.size+'. ':'')+error.message);}
    finally{busy=false;if(!disposed){paint();paintSharing().catch(()=>{});}}
  });
  Promise.all([service.contacts({offline:true}),store.getAll('objects'),store.get('meta','sharing.people.preferences'),store.get('meta','people.list.preferences'),store.get('meta','sharing.publication.'+card.id)]).then(([value,objects,saved,peoplePrefs,publication])=>{
    if(disposed)return;
    publicationOff=publication?.value===false;
    if(publicationOff){code.replaceChildren();qr.hidden=true;}
    contacts=value;places=objects.filter(o=>o.type==='location'&&!o.deletedAt&&!o.archivedAt);
    if(modes.includes(saved?.value?.sort))prefs={sort:saved.value.sort};
    peopleOrder=Array.isArray(peoplePrefs?.value?.order)?peoplePrefs.value.order:[];
    relatedPeople=new Set([...(card.personIds||[]),...objects.filter(o=>o.type==='location'&&!o.deletedAt&&(o.id===card.locationId||o.id===card.id)).flatMap(o=>o.personIds||[])]);
    const lookup=new Map(objects.filter(o=>o.type==='location'&&!o.deletedAt).map(o=>[String(o.id),o]));
    const place=isLocation?card:lookup.get(String(card.locationId));
    if(place&&!place.archivedAt&&place.status!=='archived') {
      const resolved=resolveLocation(place,lookup);
      location={title:String(place.data?.title||'Locatie').slice(0,100),address:resolved.address.slice(0,500),
        coordinates:resolved.coordinates?{lat:resolved.coordinates.lat,lng:resolved.coordinates.lng}:null};
      layer.querySelector('[data-share-location-option]').hidden=isLocation;
      layer.querySelector('[data-share-location-preview]').textContent=[location.title,location.address,
        location.coordinates?'Kaartpositie beschikbaar.':'Geen kaartpositie bekend.'].filter(Boolean).join(' · ');
    }
    if(publicationOff)qrNote('QR-deling offline.');
    ready=true;paintSharing().catch(()=>{});paint();status(contacts.length?'':'Nog geen contacten. Maak eerst verbinding bij Personen.');
  }).catch(error=>status(error.message));
  const qr=document.createElement('button');qr.type='button';qr.textContent='Deel via korte QR';qr.dataset.shareQr='';qr.disabled=true;
  const code=document.createElement('div');code.dataset.shareQrCode='';
  layer.querySelector('[data-share-qr-slot]').append(code);layer.querySelector('.sh-share-board-info').prepend(qr);
  const qrStatus=layer.querySelector('[data-qr-status]');
  const qrNote=message=>{
    qrStatus.replaceChildren();
    if(message.startsWith('Scan in Sharon')){
      for(const text of ['Scan in Sharon','Deling 7 dagen geldig']){const line=document.createElement('span');line.textContent=text;qrStatus.append(line);}
      if(message.includes('Vorige QR'))status('Vorige QR kon nog niet worden ingetrokken.');
    }else qrStatus.textContent=message;
  };
  const setPublication=async online=>{
    if(qrBusy||busy||!ready||checking)return;
    if(online){
      busy=true;paint();
      try{await store.put('meta',{key:'sharing.publication.'+card.id,value:true});publicationOff=false;qr.hidden=false;busy=false;qr.click();}
      catch(error){status(error.message);}
      finally{busy=false;if(!disposed){await paintSharing();paint();}}
      return;
    }
    busy=true;publicationOff=true;qrQueued=false;code.replaceChildren();qr.hidden=true;paint();
    status('Publicatie intrekken…');
    try{
      // Persist the intent first: reopening must never republish a withdrawn QR.
      await store.put('meta',{key:'sharing.publication.'+card.id,value:false});
      const records=(await sharingRecords(store,card.id)).filter(row=>row.sourceId===card.id&&row.channel==='qr'&&!['missing','expired','withdrawn'].includes(row.state));
      for(const row of records){
        await service.request('share-ack',{id:row.id,access:row.access});
        await store.put('meta',{key:'sharing.qr.'+row.id,value:{...row,state:'withdrawn',checkedAt:Date.now()}});
      }
      existingQr=null;qrNote('QR-deling offline.');status('Publicatie ingetrokken.');
    }catch(error){
      for(const row of (await sharingRecords(store,card.id)).filter(row=>row.sourceId===card.id&&row.channel==='qr'&&['online','pending'].includes(row.state))){
        await store.put('meta',{key:'sharing.qr.'+row.id,value:{...row,state:'unknown',checkedAt:Date.now()}}).catch(()=>{});
      }
      qrNote('Intrekken niet bevestigd.');status('Publicatie kon niet worden ingetrokken. '+error.message);
    }
    finally{busy=false;if(!disposed){await paintSharing();paint();}}
  };
  qr.addEventListener('click',async()=>{if(disposed||qrBusy||publicationOff||!ready||checking)return;qrBusy=true;qr.disabled=true;let retirementWarning='';qrNote('QR-code voorbereiden…');try{
    const includedAtStart=!isLocation&&locationChoice.checked;
    const qrSource={id:card.id,relatedIds:includedAtStart&&card.locationId?[card.locationId]:[],includeLocation:includedAtStart};
    const qrText=isLocation?buildLocationPayload(location):buildCardPayload(card,{location:locationChoice.checked?location:null});
    paint();const includeLocation=includedAtStart;
    const reusable=existingQr&&Boolean(existingQr.includeLocation)===includeLocation;
    const previous=existingQr;
    const reference=reusable?existingQr.id:await publishTransfer(store,qrText,{source:qrSource});
    if(previous&&!reusable){
      try{await service.request('share-ack',{id:previous.id,access:previous.access});await store.put('meta',{key:'sharing.qr.'+previous.id,value:{...previous,state:'missing'}});}catch{retirementWarning=' Vorige QR kon nog niet worden ingetrokken.';}
    }await paintSharing();if(disposed)return;if(includedAtStart!==(!isLocation&&locationChoice.checked)){qrQueued=true;return;}await renderCardCode(code,'QR_CODE',reference);if(includedAtStart!==(!isLocation&&locationChoice.checked)){code.replaceChildren();qrQueued=true;return;}qr.hidden=true;qrNote('Scan in Sharon. QR-code staat online. Maximaal zeven dagen geldig.'+retirementWarning);
  }catch(error){if(!disposed){qrNote(error.message);qr.hidden=false;}}finally{qrBusy=false;qrSettled=true;if(!disposed){paint();paintSharing().catch(()=>{});if(qrQueued){qrQueued=false;queueMicrotask(()=>{if(!disposed&&!publicationOff)qr.click();});}}}});
  paintSharing().then(()=>disposed?null:refreshQrShares(store,card.id,{force:true})).then(paintSharing).catch(()=>{}).finally(()=>{checking=false;if(!disposed)paint();});
  surface.focus();
  return dispose;
}
