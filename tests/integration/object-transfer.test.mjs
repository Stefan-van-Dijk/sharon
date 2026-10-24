import test from 'node:test';import assert from 'node:assert/strict';import {appHarness,until} from '../helpers/app-harness.mjs';
test('short encrypted QR retains server data until durable local save, retries ack without duplicating the object',async t=>{
 const app=await appHarness();t.after(()=>app.close());let entry,failAck=true;const calls=[];
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);calls.push(q.action);
  if(q.action==='share-publish'){entry=q;return {ok:true,json:async()=>({ok:true})};}
  if(q.action==='share-read'){assert.equal(q.access,entry.access);return {ok:true,json:async()=>({payload:entry.payload})};}
  if(q.action==='share-ack'){assert.ok((await app.store.getAll('objects')).some(o=>o.name==='Pas'));if(failAck)throw new TypeError('lost ack');entry=null;return {ok:true,json:async()=>({ok:true})};}throw Error(q.action);
 };
 const {publishTransfer,receiveTransfer}=await app.load('./src/ui/ObjectTransfer.js');
 const {buildCardPayload}=await app.load('./src/ui/CardPayload.js');
 const code=await publishTransfer(app.store,buildCardPayload({name:'Pas',cardKind:'loyalty',codeFormat:'',codeValue:''}));
 assert.equal(code.length,12);assert.ok(!entry.payload.data.includes('Pas'));
 await assert.rejects(receiveTransfer(app.store,code));assert.ok(entry);const objects=(await app.store.getAll('objects')).filter(o=>o.name==='Pas');assert.equal(objects.length,1);
 failAck=false;const result=await receiveTransfer(app.store,code);assert.equal(result.id,objects[0].id);assert.equal(entry,null);assert.equal(calls.filter(a=>a==='share-read').length,1);
});
test('right swipe invokes shared sharing action while left swipe edits and vertical scroll remains native',async t=>{
 const app=await appHarness();t.after(()=>app.close());const {renderObjectStrip}=await app.load('./src/ui/ObjectStrip.js');const {bindSwipeRows}=await app.load('./src/ui/SwipeRows.js');
 const root=app.document.createElement('div');root.innerHTML=renderObjectStrip({id:'ShareObject1',title:'Deelbaar',shareable:true});app.document.body.append(root);let shares=0;
 const stop=bindSwipeRows(root,{onShare:()=>shares++});t.after(stop);const surface=root.querySelector('[data-swipe-surface]');
 const pointer=(type,x,y)=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',button:0,clientX:x,clientY:y});surface.dispatchEvent(e);return e;};
 pointer('pointerdown',100,100);assert.equal(pointer('pointermove',200,101).defaultPrevented,true);pointer('pointerup',200,101);assert.equal(shares,1);
 pointer('pointerdown',100,100);assert.equal(pointer('pointermove',101,200).defaultPrevented,false);pointer('pointerup',101,200);assert.equal(shares,1);
 pointer('pointerdown',100,100);pointer('pointermove',200,100);pointer('pointercancel',200,100);assert.equal(shares,1);
});

test('location sharing sends a clean snapshot to a selected chat and preserves an existing personal location',async t=>{
 const app=await appHarness();t.after(()=>app.close());const {ConnectionService}=await app.load('./src/core/connection/ConnectionService.js');
 const service=new ConnectionService(app.store),device=await service.device();await service.rememberSelf({personId:device.personId,networkId:'Network00001',line:0});
 await app.store.setMeta('connection.contacts.log-json.v1',[{personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna'}]);
 const place={id:'PrivateHome1',type:'location',personIds:['SecretUser01'],data:{title:'Thuis',kind:'home',radiusM:321,notes:'Niet delen',coordinates:{lat:52,lng:5},address:{text:'Dorpsstraat 1'}}};await app.store.put('objects',place);let sent;
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);assert.equal(q.action,'send');sent=q;return {ok:true,json:async()=>({message:{id:q.id,chatId:q.chatId,senderId:device.personId,text:q.text,seq:1,at:1000}})};};
 const {openCardShare}=await app.load('./src/ui/CardSharing.js');const stop=openCardShare(place,{store:app.store});t.after(stop);
 (await until(()=>app.document.querySelector('[data-share-person]'))).click();app.document.querySelector('[data-share-send]').click();
 await until(()=>sent);const data=JSON.parse(sent.text);assert.equal(data.kind,'sharon-location');assert.equal(data.location.title,'Thuis');assert.ok(!sent.text.includes('Niet delen'));assert.ok(!sent.text.includes('SecretUser01'));
 const {saveReceivedLocation}=await app.load('./src/ui/ReceivedObjects.js');data.location.title='Naam van ander';
 const id=await saveReceivedLocation(app.store,{id:'Incoming0001',text:JSON.stringify(data)});assert.equal(id,place.id);assert.equal((await app.store.get('objects',id)).data.kind,'home');assert.equal((await app.store.get('objects',id)).data.title,'Thuis');
});

test('bare transfer codes are probed without treating ordinary card or contact codes as transfers',async t=>{
 const app=await appHarness();t.after(()=>app.close());const {isTransferScan}=await app.load('./src/ui/ObjectTransfer.js');let calls=0;
 app.window.fetch=async(_,options)=>{calls++;const q=JSON.parse(options.body);assert.equal(q.action,'share-check');return {ok:true,json:async()=>({valid:q.id==='Transfer0001'})};};
 assert.equal(await isTransferScan(app.store,{value:'Transfer0001',format:'QR_CODE'}),true);
 assert.equal(await isTransferScan(app.store,{value:'Ordinary0001',format:'QR_CODE'}),false);
 assert.equal(await isTransferScan(app.store,{value:'123456789012',format:'CODE128'}),false);
 assert.equal(calls,2);
});

test('old S1 transfers still decrypt after switching new QR codes to bare identifiers',async t=>{
 const app=await appHarness();t.after(()=>app.close());const {webcrypto}=await import('node:crypto');
 const id='Legacy000001',secret='a'.repeat(22),iv=webcrypto.getRandomValues(new Uint8Array(12));
 const {buildCardPayload}=await app.load('./src/ui/CardPayload.js');const text=buildCardPayload({name:'Oude QR',cardKind:'loyalty',codeFormat:'',codeValue:''});
 const key=await webcrypto.subtle.importKey('raw',await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('encrypt:'+secret)),'AES-GCM',false,['encrypt']);
 const data=await webcrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(text));
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);assert.ok(['share-read','share-ack'].includes(q.action));return {ok:true,json:async()=>q.action==='share-read'?{payload:{iv:Buffer.from(iv).toString('base64url'),data:Buffer.from(data).toString('base64url')}}:{ok:true}};};
 const {isTransferScan,receiveTransfer}=await app.load('./src/ui/ObjectTransfer.js');const code='S1:'+id+':'+secret;
 assert.equal(await isTransferScan(app.store,{format:'QR_CODE',value:code}),true);const saved=await receiveTransfer(app.store,code);assert.equal((await app.store.get('objects',saved.id)).name,'Oude QR');
});
