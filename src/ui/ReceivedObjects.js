import { parseCardPayload, sharedLocation } from './CardPayload.js?v=0.4.20';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.4.20';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.4.20';
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


export function parseLocationPayload(text){
 try {const data=JSON.parse(text);if(data.kind!=='sharon-location'||data.version!==1)return null;return sharedLocation(data.location);}catch{return null;}
}
export function buildLocationPayload(location){const value=sharedLocation(location);if(!value)throw Error('Ongeldige locatie.');return JSON.stringify({kind:'sharon-location',version:1,location:value});}
export function saveReceivedLocation(store,message){
 const previous=saves.get(store)||Promise.resolve();
 const result=previous.catch(()=>{}).then(()=>saveLocation(store,message));saves.set(store,result);return result;
}
async function saveLocation(store,message){
 const location=parseLocationPayload(message.text);if(!location)throw Error('Ongeldige locatie.');
 const key='locations.received.'+message.id;
 const previous=(await store.get('meta',key))?.value;if(previous&&await store.get('objects',previous))return previous;
 const all=await store.getAll('objects');
 let place=all.find(item=>item.type==='location'&&!item.deletedAt&&!item.archivedAt&&
   (item.data?.source?.messageId===message.id || (location.coordinates&&item.data?.coordinates?.lat===location.coordinates.lat&&item.data?.coordinates?.lng===location.coordinates.lng)));
 if(!place){let id;do{id=IdentifierService.create();}while(await store.get('objects',id));
  const now=new Date().toISOString();place={id,type:'location',createdAt:now,updatedAt:now,data:{title:location.title,address:{text:location.address},coordinates:location.coordinates,kind:'other',radiusM:100,source:{provider:'sharon-share',messageId:message.id}}};await store.put('objects',place);}
 await store.put('meta',{key,value:place.id});return place.id;
}
