import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.3.78';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.3.78';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.78';

export async function saveReceivedCard(store,message) {
  const card=parseCardPayload(message.text);
  if(!card)throw Error('Dit bericht bevat geen geldige kaart.');
  const key='cards.received.'+message.id;
  const old=(await store.get('meta',key))?.value;
  if(old&&await store.get('objects',old))return old;
  let id;do{id=IdentifierService.create();}while(await store.get('objects',id));
  const now=new Date().toISOString();
  await store.put('objects',{...card,id,type:'card',createdAt:now,updatedAt:now});
  await store.put('meta',{key,value:id});
  return id;
}

export function openCardShare(card,{store,onClose=()=>{}}) {
  const layer=document.createElement('div');layer.className='sh-card-share-overlay';
  layer.innerHTML='<section class="sh-card-share-dialog" role="dialog" aria-modal="true" aria-label="Kaart delen met personen"><h2>Deel kaart</h2><p data-share-title></p><label>Zoek een persoon<input type="search" data-share-search></label><div data-share-people></div><p role="status" data-share-status>Contacten laden…</p><div class="sh-connection-actions"><button type="button" data-share-close>Sluiten</button><button type="button" data-share-send disabled>Deel met geselecteerde personen</button></div></section>';
  layer.querySelector('[data-share-title]').textContent=card.name;
  document.body.append(layer);
  const service=new ConnectionService(store),selected=new Set(),sent=new Set(),retries=new Map();
  let disposed=false,busy=false,contacts=[];
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
  };
  layer.querySelector('[data-share-search]').addEventListener('input',paint);
  layer.querySelector('[data-share-close]').addEventListener('click',close);
  layer.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  send.addEventListener('click',async()=>{
    if(busy)return;busy=true;paint();status('Kaart versturen…');
    try {
      const text=buildCardPayload(card);
      for(const contact of contacts.filter(c=>selected.has(c.personId)&&!sent.has(c.personId))) {
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
  service.contacts({offline:true}).then(async value=>{
    contacts=value;
    const text=buildCardPayload(card);
    for(const contact of contacts){const pending=(await service.cachedMessages(contact.chatId)).find(m=>m.text===text&&m.delivery==='pending');if(pending)retries.set(contact.personId,pending.id);}
    if(disposed)return;paint();status(contacts.length?'Kies met wie je deze kaart wilt delen.':'Nog geen contacten. Maak eerst verbinding bij Personen.');
  }).catch(error=>status(error.message));
  layer.querySelector('[data-share-search]').focus();
  return dispose;
}
