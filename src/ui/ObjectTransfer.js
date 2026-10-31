import { qrShareKey } from './SharingStatus.js?v=0.4.48';
import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.48';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.4.48';
import { saveReceivedCard, saveReceivedLocation, parseLocationPayload } from './ReceivedObjects.js?v=0.4.48';
import { parseCardPayload } from './CardPayload.js?v=0.4.48';
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const digest=text=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
const key=async secret=>crypto.subtle.importKey('raw',await digest('encrypt:'+secret),'AES-GCM',false,['encrypt','decrypt']);
const legacyTransfer=value=>/^S1:[A-Za-z0-9_-]{12}:[A-Za-z0-9_-]{22}$/.test(value||'');
export const isObjectTransfer=value=>IdentifierService.isValid(value)||legacyTransfer(value);
export async function isTransferScan(store,result){
 if(result?.format!=='QR_CODE')return false;
 if(legacyTransfer(result.value))return true;
 if(!IdentifierService.isValid(result.value))return false;
 if((await store.get('meta','transfer.received.'+result.value))?.value)return true;
 const response=await new ConnectionService(store).request('share-check',{id:result.value});return response.valid===true;
}
export async function publishTransfer(store,text,{source}={}){
 if(!parseCardPayload(text)&&!parseLocationPayload(text))throw Error('Ongeldige informatie om te delen.');
 const id=IdentifierService.create(),secret=id,iv=crypto.getRandomValues(new Uint8Array(12));
 const payload={iv:encode(iv),data:encode(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await key(secret),new TextEncoder().encode(text)))};
 const access=encode(await digest('access:'+secret));
 const record=source?.id?{id,access,sourceId:source.id,includeLocation:Boolean(source.includeLocation),relatedIds:source.relatedIds||[],state:'pending',createdAt:Date.now(),expiresAt:Date.now()+7*86400000}:null;
 if(record)await store.put('meta',{key:qrShareKey(id),value:record});
 const service=new ConnectionService(store);await service.request('share-publish',{id,access,payload},await service.device());
 if(record)await store.put('meta',{key:qrShareKey(id),value:{...record,state:'online',verifiedAt:Date.now()}});
 return id;
}
export async function receiveTransfer(store,reference){
 if(!isObjectTransfer(reference))throw Error('Ongeldige deelcode.');
 const [id,secret]=IdentifierService.isValid(reference)?[reference,reference]:reference.split(':').slice(1);
 const service=new ConnectionService(store),access=encode(await digest('access:'+secret));
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
