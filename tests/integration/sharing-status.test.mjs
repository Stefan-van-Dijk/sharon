import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const modulePath=name=>'./src/'+name+'.js?v='+version;
async function setup(t){
  const app=await appHarness();t.after(()=>app.close());
  const {ConnectionService}=await app.load(modulePath('core/connection/ConnectionService'));
  const service=new ConnectionService(app.store),device=await service.device();
  await service.rememberSelf({personId:device.personId,networkId:'Network00001',line:0});
  return {app,service,device,...await app.load(modulePath('ui/SharingStatus'))};
}
test('QR upload tracks source only locally, survives closing share sheet and reuses the online QR',async t=>{
  const {app,sharingRecords,mountSharingBadges}=await setup(t);let entry,publishes=0;
  app.window.eval(readFileSync('vendor/qrcode-2.0.4.js','utf8'));
  app.window.fetch=async(_,options)=>{
    const input=JSON.parse(options.body);
    if(input.action==='share-publish'){entry=input;publishes++;return {ok:true,status:200,json:async()=>({ok:true})};}
    if(input.action==='share-read')return {ok:true,status:200,json:async()=>({payload:entry.payload})};
    throw Error(input.action);
  };
  const card={id:'PrivateCard1',type:'card',name:'Mijn pas',cardKind:'loyalty',codeFormat:'',codeValue:'',fields:[]};
  await app.store.put('objects',card);
  const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
  let close=openCardShare(card,{store:app.store});
  await until(()=>!app.document.querySelector('[data-share-qr]').disabled);
  await until(()=>app.document.querySelector('[data-sharing-details]').textContent.includes('QR-deling online'));
  assert.match(app.document.querySelector('[data-qr-status]').textContent,/Geen locatie gekoppeld/);
  assert.ok(!app.document.querySelector('[data-qr-status]').textContent.includes('Locatie-icoon'));
  assert.equal(app.document.querySelector('[data-share-location-option]').hidden,true);
  close();assert.equal(publishes,1);assert.ok(!JSON.stringify(entry).includes(card.id));
  const rows=await sharingRecords(app.store,card.id);assert.equal(rows.length,1);assert.equal(rows[0].state,'online');
  const root=app.document.createElement('div');root.innerHTML='<div data-swipe-row="PrivateCard1"><button data-swipe-surface>Pas</button></div>';app.document.body.append(root);
  await mountSharingBadges(root,app.store,{refresh:false});assert.equal(root.querySelector('[data-sharing-state]').textContent,'');assert.equal(root.querySelector('[data-sharing-state]').className,'sh-sharing-dot');assert.match(root.querySelector('[data-sharing-state]').getAttribute('aria-label'),/online/);
  assert.ok(!root.innerHTML.includes(rows[0].id));assert.ok(!root.innerHTML.includes(rows[0].access));
  close=openCardShare(card,{store:app.store});t.after(close);
  await until(()=>app.document.querySelector('[data-share-qr]').textContent==='Toon gedeelde QR'&&!app.document.querySelector('[data-share-qr]').disabled);
  await until(()=>app.document.querySelector('[data-share-qr-code] svg'));
  assert.equal(publishes,1);
});
test('QR availability distinguishes consumed, expired and unreachable and never uses historical share-check',async t=>{
  const {app,refreshQrShares,sharingSummary,qrShareKey}=await setup(t);
  const row={id:'Transfer0001',sourceId:'PrivateCard1',access:'a'.repeat(43),state:'online',expiresAt:Date.now()+86400000};
  await app.store.put('meta',{key:qrShareKey(row.id),value:row});
  let calls=0;
  app.window.fetch=async(_,options)=>{calls++;assert.equal(JSON.parse(options.body).action,'share-read');throw new TypeError('Offline');};
  let rows=await refreshQrShares(app.store,row.sourceId,{force:true});assert.equal(sharingSummary(rows).state,'unknown');
  app.window.fetch=async()=>({ok:false,status:403,json:async()=>({error:'unauthorized'})});
  rows=await refreshQrShares(app.store,row.sourceId,{force:true});assert.equal(sharingSummary(rows).state,'unknown');
  app.window.fetch=async()=>({ok:false,status:410,json:async()=>({error:'share_unavailable'})});
  rows=await refreshQrShares(app.store,row.sourceId,{force:true});assert.equal(sharingSummary(rows),null);
  await app.store.put('meta',{key:qrShareKey(row.id),value:{...row,expiresAt:Date.now()-1}});
  app.window.fetch=async()=>{throw Error('Expired records must not reach network');};
  rows=await refreshQrShares(app.store,row.sourceId,{force:true});assert.equal(sharingSummary(rows),null);
});
test('chat status waits for server confirmation, keeps retry identity and also marks an included location',async t=>{
  const {app,service,device,sharingRecords,sharingSummary}=await setup(t);let fail=true;const requests=[];
  app.window.fetch=async(_,options)=>{
    const input=JSON.parse(options.body);requests.push(input);
    if(fail)throw new TypeError('Offline');
    return {ok:true,status:200,json:async()=>({message:{id:input.id,chatId:input.chatId,senderId:device.personId,text:input.text,seq:1,at:1000}})};
  };
  const source={id:'PrivateCard1',relatedIds:['PrivateHome1']};
  await assert.rejects(service.send('AlphaChat001','Deelvoorbeeld','',{source}));
  let rows=await sharingRecords(app.store,source.id);assert.equal(sharingSummary(rows).state,'unknown');
  fail=false;await service.send('AlphaChat001','Deelvoorbeeld',rows[0].id,{source});
  rows=await sharingRecords(app.store,source.id);assert.equal(rows.length,1);assert.equal(sharingSummary(rows).state,'shared');
  assert.equal(sharingSummary(await sharingRecords(app.store,'PrivateHome1')).state,'shared');
  assert.equal(requests[0].id,requests[1].id);assert.ok(!JSON.stringify(requests).includes('PrivateCard1'));
  const message=await app.store.get('objects',rows[0].id);
  app.window.fetch=async()=>({ok:true,status:200,json:async()=>({messages:[{id:message.id,chatId:message.chatId,senderId:message.senderId,text:message.text,seq:1,at:1000}]})});
  await service.sync('AlphaChat001');
  assert.equal(sharingSummary(await sharingRecords(app.store,source.id)).state,'shared');
  assert.equal((await app.store.get('objects',message.id)).sharedConfirmedAt,message.sharedConfirmedAt);
});
test('failed QR publication never produces an online badge and creates no untraceable upload on storage failure',async t=>{
  const {app,sharingRecords,sharingSummary}=await setup(t);
  const {publishTransfer}=await app.load(modulePath('ui/ObjectTransfer'));
  const {buildCardPayload}=await app.load(modulePath('ui/CardPayload'));
  app.window.fetch=async()=>{throw new TypeError('Offline');};
  const text=buildCardPayload({name:'Pas',cardKind:'loyalty',codeFormat:'',codeValue:''});
  await assert.rejects(publishTransfer(app.store,text,{source:{id:'PrivateCard1'}}));
  assert.equal(sharingSummary(await sharingRecords(app.store,'PrivateCard1')).state,'unknown');
  let uploaded=false;app.window.fetch=async()=>{uploaded=true;throw Error('Must not upload');};
  const put=app.store.put.bind(app.store);app.store.put=async(name,row)=>{if(row.key?.startsWith('sharing.qr.'))throw Error('Disk full');return put(name,row);};
  await assert.rejects(publishTransfer(app.store,text,{source:{id:'PrivateCard1'}}),/Disk full/);assert.equal(uploaded,false);
});

test('share board immediately shows people, ranks linked contacts and renews encrypted QR when location is included',async t=>{
 const {app}=await setup(t);app.window.eval(readFileSync('vendor/qrcode-2.0.4.js','utf8'));
 await app.store.put('objects',{id:'PrivateHome1',type:'location',personIds:['AlphaUser001'],data:{title:'Winkel',address:{text:'Dorpsstraat 1'},coordinates:{lat:52,lng:5}}});
 await app.store.setMeta('connection.contacts.log-json.v1',[{personId:'BetaUser0001',chatId:'BetaChat0001',name:'Bram',updatedAt:900},{personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna',updatedAt:100}]);
 const entries=new Map();let uploads=0;
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);
 if(q.action==='share-publish'){entries.set(q.id,q);uploads++;return {ok:true,status:200,json:async()=>({ok:true})};}
 if(q.action==='share-read')return {ok:true,status:200,json:async()=>({payload:entries.get(q.id).payload})};
 if(q.action==='share-ack'){entries.delete(q.id);return {ok:true,status:200,json:async()=>({ok:true})};}throw Error(q.action);};
 const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
 const close=openCardShare({id:'PrivateCard1',type:'card',name:'Mijn kaart',locationId:'PrivateHome1',cardKind:'loyalty',codeFormat:'',codeValue:''},{store:app.store});t.after(close);
 await until(()=>app.document.querySelector('[data-share-qr-code] svg'));
 assert.ok(app.document.querySelector('.sh-board-stack .sh-share-board'));
 assert.equal(app.document.querySelector('[data-share-person-panel]').hidden,false);
 assert.equal(app.document.querySelector('[data-share-person-toggle]'),null);
 assert.equal(app.document.querySelector('[data-deck-grab] svg'),null);
 assert.equal(app.document.querySelector('[data-share-title]').textContent,'Mijn kaart');
 assert.equal(app.document.querySelector('[data-share-person-panel]').hidden,false);
 assert.equal(app.document.querySelector('[data-share-person]').dataset.sharePerson,'AlphaUser001');
 const search=app.document.querySelector('[data-share-search]');search.value='Bram';search.dispatchEvent(new app.window.Event('input'));
 assert.equal(app.document.querySelector('[data-share-person]').dataset.sharePerson,'BetaUser0001');
 await until(()=>!app.document.querySelector('[data-share-location]').disabled);
 const previous=[...entries.keys()][0];app.document.querySelector('[data-share-location]').click();
 await until(()=>uploads===2&&entries.size===1&&app.document.querySelector('[data-share-qr-code] svg'));
 assert.equal(entries.has(previous),false);
 const receiver=await appHarness();t.after(()=>receiver.close());
 receiver.window.fetch=app.window.fetch;
 const {receiveTransfer}=await receiver.load(modulePath('ui/ObjectTransfer'));
 const result=await receiveTransfer(receiver.store,[...entries.keys()][0]);
 const card=await receiver.store.get('objects',result.id);assert.ok(card.locationId);
 assert.equal((await receiver.store.get('objects',card.locationId)).data.title,'Winkel');
});

test('late QR status cannot overwrite a location choice made while the share board initializes',async t=>{
 const {app}=await setup(t);app.window.eval(readFileSync('vendor/qrcode-2.0.4.js','utf8'));
 await app.store.put('objects',{id:'PrivateHome1',type:'location',data:{title:'Winkel',address:{text:'Dorpsstraat 1'}}});
 await app.store.put('meta',{key:'sharing.qr.Transfer0001',value:{id:'Transfer0001',access:'a'.repeat(43),sourceId:'PrivateCard1',includeLocation:false,state:'online',expiresAt:Date.now()+86400000}});
 let release;const gate=new Promise(resolve=>release=resolve);const getAll=app.store.getAll.bind(app.store);
 app.store.getAll=async table=>{if(table==='meta')await gate;return getAll(table);};
 const publications=[];
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);
 if(q.action==='share-publish')publications.push(q);
 return {ok:true,status:200,json:async()=>q.action==='share-read'?{payload:{iv:'test',data:'test'}}:{ok:true}};};
 const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
 const close=openCardShare({id:'PrivateCard1',type:'card',name:'Pas',locationId:'PrivateHome1',cardKind:'loyalty',codeFormat:'',codeValue:''},{store:app.store});t.after(close);
 const choice=app.document.querySelector('[data-share-location]');choice.click();assert.equal(choice.checked,true);
 release();await until(()=>app.document.querySelector('[data-share-qr-code] svg'));
 assert.equal(choice.checked,true);assert.equal(publications.length,1);
 const rows=await getAll('meta');const current=rows.find(row=>row.key.startsWith('sharing.qr.')&&row.value.state==='online');
 assert.equal(current.value.includeLocation,true);assert.ok(current.value.relatedIds.includes('PrivateHome1'));
});

test('share board reuses deck resizing, dragging, cancellation and pull-down close with independent layout',async t=>{
 const {app}=await setup(t);app.window.fetch=async()=>{throw new TypeError('Offline');};
 const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
 const stop=openCardShare({id:'PrivateCard1',type:'card',name:'Pas',cardKind:'loyalty',codeFormat:'',codeValue:''},{store:app.store});t.after(stop);
 const board=app.document.querySelector('.sh-share-board'),stack=board.parentElement;
 assert.equal(board.querySelector('[data-share-close]'),null);assert.equal(board.querySelectorAll('[data-deck-size]').length,2);
 assert.ok(board.querySelector('.sh-share-side-right[data-qr-status]'));
 function pointer(target,type,x,y){const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',button:0,clientX:x,clientY:y});target.dispatchEvent(e);}
 const resizer=board.querySelector('[data-deck-size="media"]');const before=stack.style.getPropertyValue('--card-deck-media');
 pointer(resizer,'pointerdown',100,200);pointer(app.window,'pointermove',100,240);pointer(app.window,'pointercancel',100,240);
 assert.equal(stack.style.getPropertyValue('--card-deck-media'),before);
 pointer(resizer,'pointerdown',100,200);pointer(app.window,'pointermove',100,230);pointer(app.window,'pointerup',100,230);
 await until(async()=>await app.store.get('meta','sharing.board.layout'));
 assert.equal(await app.store.get('meta','cards.board.layout'),undefined);
 const grab=board.querySelector('[data-deck-grab]');pointer(grab,'pointerdown',100,100);pointer(app.window,'pointermove',130,100);pointer(app.window,'pointermove',150,120);pointer(app.window,'pointerup',150,120);
 assert.equal(stack.style.getPropertyValue('--card-deck-x'),'20px');
 const title=board.querySelector('[data-share-title]');pointer(title,'pointerdown',100,100);pointer(app.window,'pointermove',100,210);pointer(app.window,'pointerup',100,210);
 assert.equal(app.document.querySelector('.sh-card-share-overlay'),null);
});

test('share pill cycles five sorts, uses the Persons custom order and opens search on left swipe without sorting',async t=>{
 const {app}=await setup(t);app.window.fetch=async()=>{throw new TypeError('Offline');};
 await app.store.setMeta('connection.contacts.log-json.v1',[
 {personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna',updatedAt:100},
 {personId:'BetaUser0001',chatId:'BetaChat0001',name:'Bram',updatedAt:900},
 {personId:'GammaUser001',chatId:'GammaChat001',name:'Cato',updatedAt:500}]);
 await app.store.put('objects',{id:'NearPlace001',type:'location',personIds:['GammaUser001'],data:{title:'Dichtbij',coordinates:{lat:52,lng:5}}});
 await app.store.put('objects',{id:'FarPlace0001',type:'location',personIds:['BetaUser0001'],data:{title:'Ver',coordinates:{lat:53,lng:6}}});
 await app.store.setMeta('people.list.preferences',{sort:'custom',order:['GammaUser001','BetaUser0001','AlphaUser001']});
 const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
 const card={id:'PrivateCard1',type:'card',name:'Pas',personIds:['BetaUser0001'],cardKind:'loyalty',codeFormat:'',codeValue:''};
 let close=openCardShare(card,{store:app.store,location:{latest:{lat:52,lng:5}}});t.after(()=>close());
 await until(()=>app.document.querySelector('[data-share-person]'));
 const first=()=>app.document.querySelector('[data-share-person]').dataset.sharePerson;
 const pill=()=>app.document.querySelector('[data-deck-grab]');
 assert.equal(first(),'BetaUser0001');assert.ok(app.document.querySelector('[data-share-person]').closest('.sh-object-strip'));
 pill().click();assert.match(pill().getAttribute('aria-label'),/Eigen volgorde/);
 assert.equal(first(),'GammaUser001');
 assert.equal(app.document.querySelector('[data-share-move]'),null);
 assert.deepEqual(Array.from((await app.store.get('meta','people.list.preferences')).value.order),['GammaUser001','BetaUser0001','AlphaUser001']);
 pill().click();assert.equal(first(),'AlphaUser001');assert.match(pill().getAttribute('aria-label'),/Alfabetisch/);
 pill().click();assert.equal(first(),'GammaUser001');assert.match(pill().getAttribute('aria-label'),/Dichtbij/);
 pill().click();assert.equal(first(),'BetaUser0001');assert.match(pill().getAttribute('aria-label'),/Recent/);
 pill().click();assert.match(pill().getAttribute('aria-label'),/Logisch/);
 function pointer(target,type,x,y){const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',button:0,clientX:x,clientY:y});target.dispatchEvent(e);}
 pointer(pill(),'pointerdown',200,100);pointer(app.window,'pointermove',100,100);pointer(app.window,'pointerup',100,100);
 assert.equal(app.document.querySelector('[data-share-search-wrap]').hidden,false);
 pill().click();assert.match(pill().getAttribute('aria-label'),/Logisch/); // Synthetic click following swipe is suppressed.
 const search=app.document.querySelector('[data-share-search]');search.value='Cato';search.dispatchEvent(new app.window.Event('input'));assert.equal(first(),'GammaUser001');
 close();close=openCardShare(card,{store:app.store});
 await until(()=>app.document.querySelector('[data-share-person]'));assert.match(pill().getAttribute('aria-label'),/Logisch/);
});

test('publication switch withdraws the live QR, stays offline after reopening and preserves confirmed person history',async t=>{
 const {app,sharingRecords,sharingSummary,mountSharingBadges}=await setup(t);app.window.eval(readFileSync('vendor/qrcode-2.0.4.js','utf8'));
 const entries=new Map();let uploads=0;
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);
 if(q.action==='share-publish'){entries.set(q.id,q);uploads++;return {ok:true,status:200,json:async()=>({ok:true})};}
 if(q.action==='share-read')return entries.has(q.id)?{ok:true,status:200,json:async()=>({payload:entries.get(q.id).payload})}:{ok:false,status:410,json:async()=>({error:'share_unavailable'})};
 if(q.action==='share-ack'){entries.delete(q.id);return {ok:true,status:200,json:async()=>({ok:true})};}throw Error(q.action);};
 const card={id:'PrivateCard1',type:'card',name:'Pas',locationId:'PrivateHome1',cardKind:'loyalty',codeFormat:'',codeValue:''};
 await app.store.put('objects',{id:'PrivateHome1',type:'location',data:{title:'Winkel'}});
 await app.store.setMeta('connection.contacts.log-json.v1',[{personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna'}]);
 await app.store.put('objects',{id:'Message00001',type:'chat-message',chatId:'AlphaChat001',sharedObjectId:card.id,delivery:'sent',sharedConfirmedAt:Date.now()});
 const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
 let close=openCardShare(card,{store:app.store});t.after(()=>close());
 const toggle=()=>app.document.querySelector('[data-share-publication]');
 await until(()=>app.document.querySelector('[data-share-qr-code] svg')&&!toggle().disabled);
 assert.equal(toggle().checked,true);toggle().click();
 await until(()=>entries.size===0&&!toggle().disabled);
 assert.equal(toggle().checked,false);assert.equal(app.document.querySelector('[data-share-qr-code] svg'),null);
 assert.equal(sharingSummary(await sharingRecords(app.store,card.id)).state,'shared');
 const root=app.document.createElement('div');root.innerHTML='<div data-swipe-row="PrivateCard1"><button data-swipe-surface>Pas</button></div>';app.document.body.append(root);
 await mountSharingBadges(root,app.store,{refresh:false});assert.equal(root.querySelector('[data-sharing-state]').dataset.sharingState,'shared');
 close();close=openCardShare(card,{store:app.store});
 await until(()=>toggle()&&!toggle().disabled);
 assert.equal(uploads,1);assert.equal(entries.size,0);assert.equal(toggle().checked,false);
 assert.match(app.document.querySelector('[data-share-person="AlphaUser001"]').textContent,/Gedeeld/);
 app.document.querySelector('[data-share-location]').click();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(uploads,1);
 toggle().click();await until(()=>uploads===2&&app.document.querySelector('[data-share-qr-code] svg')&&!toggle().disabled);
 assert.equal(toggle().checked,true);assert.equal(entries.size,1);
});

test('failed withdrawal retains online evidence and a missing QR has no status dot',async t=>{
 const {app,sharingSummary,mountSharingBadges}=await setup(t);app.window.eval(readFileSync('vendor/qrcode-2.0.4.js','utf8'));
 let payload;
 app.window.fetch=async(_,options)=>{const q=JSON.parse(options.body);
 if(q.action==='share-publish'){payload=q.payload;return {ok:true,status:200,json:async()=>({ok:true})};}
 if(q.action==='share-read')return {ok:true,status:200,json:async()=>({payload})};
 throw new TypeError('Offline');};
 const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
 const close=openCardShare({id:'PrivateCard1',type:'card',name:'Pas',cardKind:'loyalty',codeFormat:'',codeValue:''},{store:app.store});t.after(close);
 await until(()=>app.document.querySelector('[data-share-qr-code] svg')&&!app.document.querySelector('[data-share-publication]').disabled);
 app.document.querySelector('[data-share-publication]').click();
 await until(()=>app.document.querySelector('[data-share-status]').textContent.includes('kon niet worden ingetrokken'));
 assert.equal(app.document.querySelector('[data-share-publication]').checked,true);
 assert.match(app.document.querySelector('[data-qr-status]').textContent,/niet bevestigd/);
 assert.equal(sharingSummary([{channel:'qr',state:'missing',expiresAt:Date.now()+1000}]),null);
 await app.store.put('meta',{key:'sharing.qr.Missing00001',value:{id:'Missing00001',sourceId:'OtherCard001',state:'missing',expiresAt:Date.now()+1000}});
 const root=app.document.createElement('div');root.innerHTML='<div data-swipe-row="OtherCard001"><button data-swipe-surface><span data-sharing-state="online"></span>Pas</button></div>';app.document.body.append(root);
 await mountSharingBadges(root,app.store,{refresh:false});assert.equal(root.querySelector('[data-sharing-state]'),null);
});
