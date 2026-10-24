import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.3.94';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.94';
import { saveReceivedCard, saveReceivedLocation, parseLocationPayload } from './ReceivedObjects.js?v=0.3.94';
import { parseCardPayload } from './CardPayload.js?v=0.3.94';
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const digest=text=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
const key=async secret=>crypto.subtle.importKey('raw',await digest('encrypt:'+secret),'AES-GCM',false,['encrypt','decrypt']);
export const isObjectTransfer=value=>/^S1:[A-Za-z0-9_-]{12}:[A-Za-z0-9_-]{22}$/.test(value||'');
export async function publishTransfer(store,text){
 if(!parseCardPayload(text)&&!parseLocationPayload(text))throw Error('Ongeldige informatie om te delen.');
 const id=IdentifierService.create(),secret=encode(crypto.getRandomValues(new Uint8Array(16))),iv=crypto.getRandomValues(new Uint8Array(12));
 const payload={iv:encode(iv),data:encode(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await key(secret),new TextEncoder().encode(text)))};
 const access=encode(await digest('access:'+secret));
 const service=new ConnectionService(store);await service.request('share-publish',{id,access,payload},await service.device());
 return 'S1:'+id+':'+secret;
}
export async function receiveTransfer(store,reference){
 if(!isObjectTransfer(reference))throw Error('Ongeldige deelcode.');
 const [,id,secret]=reference.split(':'),service=new ConnectionService(store),access=encode(await digest('access:'+secret));
 const saved=(await store.get('meta','transfer.received.'+id))?.value;
 if(saved&&await store.get('objects',saved.id)){await service.request('share-ack',{id,access});return saved;}
 const result=await service.request('share-read',{id,access});
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(result.payload.iv),additionalData:new TextEncoder().encode(id)},await key(secret),decode(result.payload.data));
 const text=new TextDecoder().decode(plain);const type=parseLocationPayload(text)?'location':parseCardPayload(text)?'card':null;
 if(!type)throw Error('Ongeldige gedeelde informatie.');
 const objectId=await (type==='card'?saveReceivedCard:saveReceivedLocation)(store,{id,text});
 const value={id:objectId,type};await store.put('meta',{key:'transfer.received.'+id,value});
 await service.request('share-ack',{id,access});return value;
}
