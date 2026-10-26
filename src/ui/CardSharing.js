import { renderObjectStrip } from './ObjectStrip.js?v=0.4.07';
import { sortList } from '../core/storage/ListOrder.js?v=0.4.07';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.4.07';
import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.4.07';
import { wrapBoardSurface } from './BoardChrome.js?v=0.4.07';
import { sharingRecords, refreshQrShares } from './SharingStatus.js?v=0.4.07';
import { saveReceivedCard, buildLocationPayload } from './ReceivedObjects.js?v=0.4.07';
export { saveReceivedCard } from './ReceivedObjects.js?v=0.4.07';
import { publishTransfer } from './ObjectTransfer.js?v=0.4.07';
import { renderCardCode } from './CardCodes.js?v=0.4.07';
import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.07';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.4.07';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.4.07';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.4.07';

export function openCardShare(card,{store,onClose=()=>{},onStatusChange=()=>{},location:deviceLocation=null}) {
  const isLocation=card.type==='location';
  const layer=document.createElement('div');layer.className='sh-card-share-overlay';
  layer.innerHTML='<section class="sh-card-share-dialog sh-share-board" role="dialog" aria-modal="true" aria-label="Kaart delen met personen"><div class="sh-share-fixed sh-card-media" data-card-media><button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button><div class="sh-share-qr-panel"><h2 class="sh-share-side sh-share-side-left" data-share-title></h2><div data-share-qr-slot></div><span class="sh-share-side sh-share-side-right" role="status" data-qr-status>Scan in Sharon</span></div><button type="button" class="sh-card-deck-grab sh-board-compass" data-deck-grab aria-label="Swipe naar rechts en sleep om het deelboard te verplaatsen" aria-pressed="false"><span data-deck-start aria-hidden="true"></span><span data-share-pill-label>Deel kaart</span><span aria-hidden="true">|</span><span data-share-sort-icon aria-hidden="true">◇</span></button><button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van QR en informatie aanpassen"></button></div><div class="sh-share-board-info"><div data-share-location-option hidden><input type="checkbox" data-share-location hidden><button type="button" class="sh-share-location-source" data-share-location-toggle aria-label="Locatie meesturen" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg></button><p data-share-location-preview hidden></p></div><div data-share-summary-slot></div><div data-share-person-panel><label data-share-search-wrap hidden>Zoek een persoon<input type="search" data-share-search></label><p data-share-suggestions>Suggesties op basis van locatie en recente contacten</p><div data-share-people></div><button type="button" data-share-send disabled>Deel met geselecteerde personen</button></div><p role="status" data-share-status>Contacten laden…</p></div></section>';
  const surface=layer.firstElementChild;surface.dataset.cardBoard='';surface.tabIndex=-1;
  const stack=wrapBoardSurface(layer,surface);stack.classList.add('sh-share-zone-stack');
  let gestures=null;
  layer.querySelector('[data-share-title]').textContent=card.name||card.data?.title||'Locatie';
  if(isLocation){layer.querySelector('[data-share-pill-label]').textContent='Deel locatie';layer.querySelector('[role=dialog]').setAttribute('aria-label','Locatie delen');}
  document.body.append(layer);
  const service=new ConnectionService(store),selected=new Set(),sent=new Set(),retries=new Map();
  let disposed=false,busy=false,contacts=[],location=null,shareText=null,existingQr=null,ready=false,checking=true,qrBusy=false,autoQr=false,locationTouched=false,qrQueued=false;
  let relatedPeople=new Set(),places=[],shareRows=[],peopleOrder=[],prefs={sort:'logical'};
  const modes=['alpha','near','recent','logical','custom'];
  const sortLabels={alpha:'Alfabetisch',near:'Dichtbij',recent:'Recent',logical:'Logisch',custom:'Eigen volgorde'};
  const sortIcons={alpha:'A–Z',near:'⌖',recent:'◷',logical:'◇',custom:'↕'};
  const savePrefs=()=>store.put('meta',{key:'sharing.people.preferences',value:prefs}).catch(()=>{});
  const openSearch=()=>{layer.querySelector('[data-share-search-wrap]').hidden=false;paint();layer.querySelector('[data-share-search]').focus();};
  const cycleSort=()=>{prefs.sort=modes[(modes.indexOf(prefs.sort)+1)%modes.length];paint();savePrefs();};
  const source=()=>({id:card.id,relatedIds:!isLocation&&locationChoice.checked&&card.locationId?[card.locationId]:[]});
  const sharing=document.createElement('div');sharing.className='sh-sharing-details';sharing.setAttribute('role','status');
  sharing.dataset.sharingDetails='';layer.querySelector('[data-share-summary-slot]').append(sharing);
  const paintSharing=async()=>{
    const rows=await sharingRecords(store,card.id);if(disposed)return;
    shareRows=rows;
    sharing.replaceChildren();
    for(const row of rows.filter(row=>row.channel==='qr'&&['online','unknown','pending'].includes(row.state)&&row.expiresAt>Date.now())){
      const line=document.createElement('small');line.textContent=row.state==='online'?'QR-deling online':'QR-status niet bevestigd';sharing.append(line);
    }
    paint();
    existingQr=rows.find(row=>row.sourceId===card.id&&row.channel==='qr'&&['online','unknown'].includes(row.state)&&row.expiresAt>Date.now());
    if(existingQr&&!autoQr&&!locationTouched&&!busy&&shareText===null)locationChoice.checked=Boolean(existingQr.includeLocation);
    qr.textContent=existingQr?'Toon gedeelde QR':'Deel via korte QR';
    onStatusChange();
  };
  const locationChoice=layer.querySelector('[data-share-location]');
  const close=()=>{if(busy)return;if(disposed)return;disposed=true;gestures?.dispose();layer.remove();onClose();};
  const dispose=()=>{disposed=true;gestures?.dispose();layer.remove();};
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
    layer.querySelector('[data-share-sort-icon]').textContent=sortIcons[prefs.sort];
    layer.querySelector('[data-deck-grab]').setAttribute('aria-label','Deel kaart · '+sortLabels[prefs.sort]+'. Klik om sortering te wijzigen, swipe links om te zoeken, swipe rechts om op te pakken.');
    layer.querySelector('[data-share-suggestions]').textContent=sortLabels[prefs.sort]+(prefs.sort==='near'&&!origin?' · Geen locatie bekend':'');
    for(const contact of suggested) {
      const row=document.createElement('div');row.className='sh-share-person-row';
      row.innerHTML=renderObjectStrip({module:'persons',id:contact.personId,title:contact.name,subtitle:contactShareLabel(contact),actions:[],trailingHtml:'<span aria-hidden="true">'+(selected.has(contact.personId)?'✓':'+')+'</span>'});
      const button=row.querySelector('[data-swipe-surface]');button.dataset.sharePerson=contact.personId;button.disabled=busy||sent.has(contact.personId);button.setAttribute('aria-pressed',String(selected.has(contact.personId)));
      button.addEventListener('click',()=>{if(selected.has(contact.personId))selected.delete(contact.personId);else selected.add(contact.personId);paint();});
      host.append(row);
    }
    qr.disabled=qrBusy||!ready||checking;
    if(ready&&!checking&&!autoQr){autoQr=true;queueMicrotask(()=>{if(!disposed)qr.click();});}
    send.disabled=busy||![...selected].some(id=>!sent.has(id));
    locationChoice.disabled=busy||shareText!==null;
    const locationButton=layer.querySelector('[data-share-location-toggle]');locationButton.disabled=locationChoice.disabled;locationButton.setAttribute('aria-pressed',String(locationChoice.checked));
  };
  layer.querySelector('.sh-share-fixed').append(layer.querySelector('[data-share-location-option]'));
  layer.querySelector('[data-share-location-toggle]').addEventListener('click',()=>locationChoice.click());
  locationChoice.addEventListener('change',()=>{locationTouched=true;paint();code.replaceChildren();qr.hidden=false;if(qrBusy)qrQueued=true;else qr.click();});
  layer.querySelector('[data-share-search]').addEventListener('input',paint);
  gestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore:store,layoutKey:'sharing.board.layout',onGrabTap:cycleSort,onGrabSearch:openSearch});
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
  Promise.all([service.contacts({offline:true}),store.getAll('objects'),store.get('meta','sharing.people.preferences'),store.get('meta','people.list.preferences')]).then(([value,objects,saved,peoplePrefs])=>{
    if(disposed)return;
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
    ready=true;paintSharing().catch(()=>{});paint();status(contacts.length?'':'Nog geen contacten. Maak eerst verbinding bij Personen.');
  }).catch(error=>status(error.message));
  const qr=document.createElement('button');qr.type='button';qr.textContent='Deel via korte QR';qr.dataset.shareQr='';qr.disabled=true;
  const code=document.createElement('div');code.dataset.shareQrCode='';
  layer.querySelector('[data-share-qr-slot]').append(code);layer.querySelector('.sh-share-board-info').prepend(qr);
  const qrStatus=layer.querySelector('[data-qr-status]');
  const qrNote=message=>{qrStatus.textContent=message+(isLocation?'':location?(locationChoice.checked?' Locatie wordt meegestuurd.':' Locatie wordt niet meegestuurd.'):' Geen locatie gekoppeld.');};
  qr.addEventListener('click',async()=>{if(disposed||qrBusy||!ready||checking)return;qrBusy=true;qr.disabled=true;let retirementWarning='';qrNote('QR-code voorbereiden…');try{
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
  }catch(error){if(!disposed){qrNote(error.message);qr.hidden=false;}}finally{qrBusy=false;if(!disposed){paint();paintSharing().catch(()=>{});if(qrQueued){qrQueued=false;queueMicrotask(()=>{if(!disposed)qr.click();});}}}});
  paintSharing().then(()=>disposed?null:refreshQrShares(store,card.id,{force:true})).then(paintSharing).catch(()=>{}).finally(()=>{checking=false;if(!disposed)paint();});
  surface.focus();
  return dispose;
}
