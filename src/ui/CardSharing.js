import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.4.04';
import { wrapBoardSurface } from './BoardChrome.js?v=0.4.04';
import { sharingRecords, sharingSummary, refreshQrShares } from './SharingStatus.js?v=0.4.04';
import { saveReceivedCard, buildLocationPayload } from './ReceivedObjects.js?v=0.4.04';
export { saveReceivedCard } from './ReceivedObjects.js?v=0.4.04';
import { publishTransfer } from './ObjectTransfer.js?v=0.4.04';
import { renderCardCode } from './CardCodes.js?v=0.4.04';
import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.04';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.4.04';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.4.04';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.4.04';

export function openCardShare(card,{store,onClose=()=>{},onStatusChange=()=>{}}) {
  const isLocation=card.type==='location';
  const layer=document.createElement('div');layer.className='sh-card-share-overlay';
  layer.innerHTML='<section class="sh-card-share-dialog sh-share-board" role="dialog" aria-modal="true" aria-label="Kaart delen met personen"><div class="sh-share-fixed sh-card-media" data-card-media><button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button><header class="sh-share-board-header"><h2 data-share-title></h2></header><div class="sh-share-qr-panel"><span class="sh-share-side sh-share-side-left" data-share-kind>Deel kaart</span><div data-share-qr-slot></div><span class="sh-share-side sh-share-side-right" role="status" data-qr-status>Scan in Sharon</span></div><button type="button" class="sh-card-deck-grab sh-board-compass" data-deck-grab aria-label="Swipe naar rechts en sleep om het deelboard te verplaatsen" aria-pressed="false"><span data-deck-start aria-hidden="true"></span><span>Deel kaart</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="3"/><path d="M7 3h10a3 3 0 0 1 3 3v11"/></svg></button><button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van QR en informatie aanpassen"></button></div><div class="sh-share-board-info"><div data-share-location-option hidden><label class="sh-person-choice"><input type="checkbox" data-share-location>Locatie meesturen in QR en bericht</label><p data-share-location-preview></p></div><div data-share-summary-slot></div><button type="button" data-share-person-toggle aria-expanded="false">Deel met personen</button><div data-share-person-panel hidden><label>Zoek een persoon<input type="search" data-share-search></label><p data-share-suggestions>Suggesties op basis van locatie en recente contacten</p><div data-share-people></div><button type="button" data-share-send disabled>Deel met geselecteerde personen</button></div><p role="status" data-share-status>Contacten laden…</p></div></section>';
  const surface=layer.firstElementChild;surface.dataset.cardBoard='';surface.tabIndex=-1;
  const stack=wrapBoardSurface(layer,surface);stack.classList.add('sh-share-zone-stack');
  let gestures=null;
  layer.querySelector('[data-share-title]').textContent=card.name||card.data?.title||'Locatie';
  if(isLocation){layer.querySelector('[data-share-kind]').textContent='Deel locatie';layer.querySelector('[role=dialog]').setAttribute('aria-label','Locatie delen');}
  document.body.append(layer);
  const service=new ConnectionService(store),selected=new Set(),sent=new Set(),retries=new Map();
  let disposed=false,busy=false,contacts=[],location=null,shareText=null,existingQr=null,ready=false,checking=true,qrBusy=false,autoQr=false,personPanelOpen=false,locationTouched=false,qrQueued=false;
  let relatedPeople=new Set();
  const source=()=>({id:card.id,relatedIds:!isLocation&&locationChoice.checked&&card.locationId?[card.locationId]:[]});
  const sharing=document.createElement('div');sharing.className='sh-sharing-details';sharing.setAttribute('role','status');
  sharing.dataset.sharingDetails='';layer.querySelector('[data-share-summary-slot]').append(sharing);
  const paintSharing=async()=>{
    const rows=await sharingRecords(store,card.id);if(disposed)return;
    const summary=sharingSummary(rows);
    sharing.replaceChildren();
    if(summary){
      const heading=document.createElement('strong');heading.textContent=summary.label;sharing.append(heading);
      for(const row of rows){
        const line=document.createElement('small');
        const recipient=contacts.find(contact=>contact.chatId===row.chatId)?.name||row.recipientName||'een contact';
        const when=row.verifiedAt?new Date(row.verifiedAt).toLocaleString('nl-NL'):'';
        line.textContent=row.channel==='chat'?(row.state==='sent'?'Gedeeld met '+recipient+' · laatst bevestigd online':'Delen met '+recipient+' wacht op bevestiging'):
          row.expiresAt<=Date.now()?'QR-deling verlopen':row.state==='online'?'QR-deling online':row.state==='missing'?'QR-deling opgehaald of verwijderd':'QR-status niet bevestigd';
        if(when)line.textContent+=' · '+when;
        sharing.append(line);
      }
    }
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
  const paint=()=>{
    if(disposed)return;
    const query=layer.querySelector('[data-share-search]').value.trim().toLocaleLowerCase('nl');
    const host=layer.querySelector('[data-share-people]');host.replaceChildren();
    const ranked=[...contacts].sort((a,b)=>Number(relatedPeople.has(b.personId))-Number(relatedPeople.has(a.personId))||(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0)||a.name.localeCompare(b.name,'nl'));
    const suggested=query?ranked.filter(c=>c.name.toLocaleLowerCase('nl').includes(query)):ranked.slice(0,6);
    for(const contact of suggested) {
      const label=document.createElement('label');label.className='sh-person-choice';
      const check=document.createElement('input');check.type='checkbox';check.dataset.sharePerson=contact.personId;
      check.checked=selected.has(contact.personId);check.disabled=busy||sent.has(contact.personId);
      check.addEventListener('change',()=>{if(check.checked)selected.add(contact.personId);else selected.delete(contact.personId);paint();});
      label.append(check,document.createTextNode(contact.name+(sent.has(contact.personId)?' · Verstuurd':'')));host.append(label);
    }
    qr.disabled=qrBusy||!ready||checking;
    if(ready&&!checking&&!autoQr){autoQr=true;queueMicrotask(()=>{if(!disposed)qr.click();});}
    send.disabled=busy||![...selected].some(id=>!sent.has(id));
    locationChoice.disabled=busy||shareText!==null;
  };
  layer.querySelector('[data-share-person-toggle]').addEventListener('click',()=>{
    personPanelOpen=!personPanelOpen;layer.querySelector('[data-share-person-panel]').hidden=!personPanelOpen;
    layer.querySelector('[data-share-person-toggle]').setAttribute('aria-expanded',String(personPanelOpen));
    sharing.hidden=personPanelOpen;paint();if(personPanelOpen)layer.querySelector('[data-share-search]').focus();
  });
  locationChoice.addEventListener('change',()=>{locationTouched=true;code.replaceChildren();qr.hidden=false;if(qrBusy)qrQueued=true;else qr.click();});
  layer.querySelector('[data-share-search]').addEventListener('input',paint);
  gestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore:store,layoutKey:'sharing.board.layout'});
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
  Promise.all([service.contacts({offline:true}),store.getAll('objects')]).then(([value,objects])=>{
    if(disposed)return;
    contacts=value;
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
    ready=true;paintSharing().catch(()=>{});paint();status(contacts.length?'Kies met wie je deze kaart wilt delen.':'Nog geen contacten. Maak eerst verbinding bij Personen.');
  }).catch(error=>status(error.message));
  const qr=document.createElement('button');qr.type='button';qr.textContent='Deel via korte QR';qr.dataset.shareQr='';qr.disabled=true;
  const code=document.createElement('div');code.dataset.shareQrCode='';
  layer.querySelector('[data-share-qr-slot]').append(code);layer.querySelector('.sh-share-board-info').prepend(qr);
  const qrStatus=layer.querySelector('[data-qr-status]');
  qr.addEventListener('click',async()=>{if(disposed||qrBusy||!ready||checking)return;qrBusy=true;qr.disabled=true;let retirementWarning='';qrStatus.textContent='QR-code voorbereiden…';try{
    const includedAtStart=!isLocation&&locationChoice.checked;
    const qrSource={id:card.id,relatedIds:includedAtStart&&card.locationId?[card.locationId]:[],includeLocation:includedAtStart};
    const qrText=isLocation?buildLocationPayload(location):buildCardPayload(card,{location:locationChoice.checked?location:null});
    paint();const includeLocation=includedAtStart;
    const reusable=existingQr&&Boolean(existingQr.includeLocation)===includeLocation;
    const previous=existingQr;
    const reference=reusable?existingQr.id:await publishTransfer(store,qrText,{source:qrSource});
    if(previous&&!reusable){
      try{await service.request('share-ack',{id:previous.id,access:previous.access});await store.put('meta',{key:'sharing.qr.'+previous.id,value:{...previous,state:'missing'}});}catch{retirementWarning=' Vorige QR kon nog niet worden ingetrokken.';}
    }await paintSharing();if(disposed)return;if(includedAtStart!==(!isLocation&&locationChoice.checked)){qrQueued=true;return;}await renderCardCode(code,'QR_CODE',reference);if(includedAtStart!==(!isLocation&&locationChoice.checked)){code.replaceChildren();qrQueued=true;return;}qr.hidden=true;qrStatus.textContent='Scan in Sharon. QR-code staat online. Na opslaan door de ontvanger verdwijnt het tijdelijke bestand. Maximaal zeven dagen geldig.'+retirementWarning;
  }catch(error){if(!disposed){qrStatus.textContent=error.message;qr.hidden=false;}}finally{qrBusy=false;if(!disposed){paint();paintSharing().catch(()=>{});if(qrQueued){qrQueued=false;queueMicrotask(()=>{if(!disposed)qr.click();});}}}});
  paintSharing().then(()=>disposed?null:refreshQrShares(store,card.id,{force:true})).then(paintSharing).catch(()=>{}).finally(()=>{checking=false;if(!disposed)paint();});
  surface.focus();
  return dispose;
}
