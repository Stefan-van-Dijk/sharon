import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.3.80';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.3.80';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.80';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.3.80';

const saves = new WeakMap();
export function saveReceivedCard(store,message) {
  const previous=saves.get(store)||Promise.resolve();
  const result=previous.catch(()=>{}).then(()=>save(store,message));
  saves.set(store,result);
  return result;
}
async function save(store,message) {
  const payload=parseCardPayload(message.text);
  const {location,...card}=payload||{};
  if(!payload)throw Error('Dit bericht bevat geen geldige kaart.');
  const key='cards.received.'+message.id;
  const old=(await store.get('meta',key))?.value;
  if(old&&await store.get('objects',old))return old;
  let id;do{id=IdentifierService.create();}while(await store.get('objects',id));
  const now=new Date().toISOString();
  let locationId=null;
  if(location) {
    const objects=await store.getAll('objects');
    const lookup=new Map(objects.filter(o=>o.type==='location'&&!o.deletedAt).map(o=>[String(o.id),o]));
    let place=[...lookup.values()].find(o=>{
      if(o.archivedAt||o.status==='archived')return false;
      // Reuse a saved snapshot after an interrupted card write, even if edited.
      if(o.data?.source?.provider==='sharon-card'&&o.data.source.messageId===message.id)return true;
      const resolved=resolveLocation(o,lookup),point=resolved.coordinates;
      return Boolean(location.address||location.coordinates)&&o.data?.title===location.title&&resolved.address===location.address&&
        (location.coordinates ? point?.lat===location.coordinates.lat&&point?.lng===location.coordinates.lng : !point);
    });
    if(!place) {
      let placeId;do{placeId=IdentifierService.create();}while(await store.get('objects',placeId));
      place={id:placeId,type:'location',schemaVersion:1,createdAt:now,updatedAt:now,
        data:{title:location.title,address:{text:location.address},coordinates:location.coordinates,kind:'other',radiusM:100,
          source:{provider:'sharon-card',messageId:message.id}}};
      await store.put('objects',place);
    }
    locationId=place.id;
  }
  await store.put('objects',{...card,id,type:'card',...(locationId?{locationId}:{}),createdAt:now,updatedAt:now});
  await store.put('meta',{key,value:id});
  return id;
}

export function openCardShare(card,{store,onClose=()=>{}}) {
  const layer=document.createElement('div');layer.className='sh-card-share-overlay';
  layer.innerHTML='<section class="sh-card-share-dialog" role="dialog" aria-modal="true" aria-label="Kaart delen met personen"><h2>Deel kaart</h2><p data-share-title></p><div data-share-location-option hidden><label class="sh-person-choice"><input type="checkbox" data-share-location>Locatie meesturen</label><p data-share-location-preview></p></div><label>Zoek een persoon<input type="search" data-share-search></label><div data-share-people></div><p role="status" data-share-status>Contacten laden…</p><div class="sh-connection-actions"><button type="button" data-share-close>Sluiten</button><button type="button" data-share-send disabled>Deel met geselecteerde personen</button></div></section>';
  layer.querySelector('[data-share-title]').textContent=card.name;
  document.body.append(layer);
  const service=new ConnectionService(store),selected=new Set(),sent=new Set(),retries=new Map();
  let disposed=false,busy=false,contacts=[],location=null,shareText=null;
  const locationChoice=layer.querySelector('[data-share-location]');
  const close=()=>{if(busy)return;if(disposed)return;disposed=true;layer.remove();onClose();};
  const dispose=()=>{disposed=true;layer.remove();};
  const status=message=>{if(!disposed)layer.querySelector('[data-share-status]').textContent=message;};
  const send=layer.querySelector('[data-share-send]');
  const paint=()=>{
    if(disposed)return;
    const query=layer.querySelector('[data-share-search]').value.trim().toLocaleLowerCase('nl');
    const host=layer.querySelector('[data-share-people]');host.replaceChildren();
    for(const contact of contacts.filter(c=>c.name.toLocaleLowerCase('nl').includes(query))) {
      const label=document.createElement('label');label.className='sh-person-choice';
      const check=document.createElement('input');check.type='checkbox';check.dataset.sharePerson=contact.personId;
      check.checked=selected.has(contact.personId);check.disabled=busy||sent.has(contact.personId);
      check.addEventListener('change',()=>{if(check.checked)selected.add(contact.personId);else selected.delete(contact.personId);paint();});
      label.append(check,document.createTextNode(contact.name+(sent.has(contact.personId)?' · Verstuurd':'')));host.append(label);
    }
    send.disabled=busy||![...selected].some(id=>!sent.has(id));
    locationChoice.disabled=busy||shareText!==null;
  };
  layer.querySelector('[data-share-search]').addEventListener('input',paint);
  layer.querySelector('[data-share-close]').addEventListener('click',close);
  layer.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  send.addEventListener('click',async()=>{
    if(busy)return;busy=true;paint();status('Kaart versturen…');
    try {
      const text=shareText??buildCardPayload(card,{location:locationChoice.checked?location:null});
      shareText=text;
      for(const contact of contacts.filter(c=>selected.has(c.personId)&&!sent.has(c.personId))) {
        if(!retries.has(contact.personId)) {
          const pending=(await service.cachedMessages(contact.chatId)).find(m=>m.text===text&&m.delivery==='pending');
          if(pending)retries.set(contact.personId,pending.id);
        }
        try {await service.send(contact.chatId,text,retries.get(contact.personId)||'');sent.add(contact.personId);}
        catch(error){
          const pending=(await service.cachedMessages(contact.chatId)).find(m=>m.text===text&&m.delivery==='pending');
          if(pending)retries.set(contact.personId,pending.id);
          throw error;
        }
      }
      status('Kaart verstuurd naar '+sent.size+' '+(sent.size===1?'persoon.':'personen.'));
    }catch(error){status((sent.size?'Al verstuurd naar '+sent.size+'. ':'')+error.message);}
    finally{busy=false;if(!disposed)paint();}
  });
  Promise.all([service.contacts({offline:true}),store.getAll('objects')]).then(([value,objects])=>{
    if(disposed)return;
    contacts=value;
    const lookup=new Map(objects.filter(o=>o.type==='location'&&!o.deletedAt).map(o=>[String(o.id),o]));
    const place=lookup.get(String(card.locationId));
    if(place&&!place.archivedAt&&place.status!=='archived') {
      const resolved=resolveLocation(place,lookup);
      location={title:String(place.data?.title||'Locatie').slice(0,100),address:resolved.address.slice(0,500),
        coordinates:resolved.coordinates?{lat:resolved.coordinates.lat,lng:resolved.coordinates.lng}:null};
      layer.querySelector('[data-share-location-option]').hidden=false;
      layer.querySelector('[data-share-location-preview]').textContent=[location.title,location.address,
        location.coordinates?'Kaartpositie beschikbaar.':'Geen kaartpositie bekend.'].filter(Boolean).join(' · ');
    }
    paint();status(contacts.length?'Kies met wie je deze kaart wilt delen.':'Nog geen contacten. Maak eerst verbinding bij Personen.');
  }).catch(error=>status(error.message));
  layer.querySelector('[data-share-search]').focus();
  return dispose;
}
