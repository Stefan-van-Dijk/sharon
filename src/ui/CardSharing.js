import { saveReceivedCard, buildLocationPayload } from './ReceivedObjects.js?v=0.3.96';
export { saveReceivedCard } from './ReceivedObjects.js?v=0.3.96';
import { publishTransfer } from './ObjectTransfer.js?v=0.3.96';
import { renderCardCode } from './CardCodes.js?v=0.3.96';
import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.3.96';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.3.96';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.96';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.3.96';

export function openCardShare(card,{store,onClose=()=>{}}) {
  const isLocation=card.type==='location';
  const layer=document.createElement('div');layer.className='sh-card-share-overlay';
  layer.innerHTML='<section class="sh-card-share-dialog" role="dialog" aria-modal="true" aria-label="Kaart delen met personen"><h2>Deel kaart</h2><p data-share-title></p><div data-share-location-option hidden><label class="sh-person-choice"><input type="checkbox" data-share-location>Locatie meesturen</label><p data-share-location-preview></p></div><label>Zoek een persoon<input type="search" data-share-search></label><div data-share-people></div><p role="status" data-share-status>Contacten laden…</p><div class="sh-connection-actions"><button type="button" data-share-close>Sluiten</button><button type="button" data-share-send disabled>Deel met geselecteerde personen</button></div></section>';
  layer.querySelector('[data-share-title]').textContent=card.name||card.data?.title||'Locatie';
  if(isLocation){layer.querySelector('h2').textContent='Deel locatie';layer.querySelector('[role=dialog]').setAttribute('aria-label','Locatie delen');}
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
    if(busy)return;busy=true;paint();status(isLocation?'Locatie versturen…':'Kaart versturen…');
    try {
      const text=shareText??(isLocation?buildLocationPayload(location):buildCardPayload(card,{location:locationChoice.checked?location:null}));
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
      status((isLocation?'Locatie':'Kaart')+' verstuurd naar '+sent.size+' '+(sent.size===1?'persoon.':'personen.'));
    }catch(error){status((sent.size?'Al verstuurd naar '+sent.size+'. ':'')+error.message);}
    finally{busy=false;if(!disposed)paint();}
  });
  Promise.all([service.contacts({offline:true}),store.getAll('objects')]).then(([value,objects])=>{
    if(disposed)return;
    contacts=value;
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
    paint();status(contacts.length?'Kies met wie je deze kaart wilt delen.':'Nog geen contacten. Maak eerst verbinding bij Personen.');
  }).catch(error=>status(error.message));
  const qr=document.createElement('button');qr.type='button';qr.textContent='Deel via korte QR';qr.dataset.shareQr='';
  const code=document.createElement('div');code.dataset.shareQrCode='';
  layer.querySelector('.sh-connection-actions').prepend(qr);layer.querySelector('section').append(code);
  qr.addEventListener('click',async()=>{qr.disabled=true;status('QR-overdracht voorbereiden…');try{
    shareText=shareText??(isLocation?buildLocationPayload(location):buildCardPayload(card,{location:locationChoice.checked?location:null}));
    paint();const reference=await publishTransfer(store,shareText);await renderCardCode(code,'QR_CODE',reference);status('Eenmalige QR, maximaal zeven dagen geldig. Het tijdelijke bestand verdwijnt na succesvol opslaan bij de ontvanger.');
  }catch(error){status(error.message);qr.disabled=false;}});
  layer.querySelector('[data-share-search]').focus();
  return dispose;
}
