import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const modulePath='./src/core/connection/ConnectionService.js?v='+version;
function touch(app,target,type,x,y=250){
 const event=new app.window.Event(type,{bubbles:true,cancelable:true});
 const point={clientX:x,clientY:y};Object.assign(event,{touches:type==='touchend'?[]:[point],changedTouches:[point]});target.dispatchEvent(event);
}
test('right swipe from the middle of a Home menu row opens the camera, vertical scroll stays on Home',async t=>{
 const app=await appHarness();t.after(()=>app.close());
 app.window.HTMLMediaElement.prototype.pause=function(){};
 app.window.ZXing={};let cameraRequests=0;
 Object.defineProperty(app.window.navigator,'mediaDevices',{value:{getUserMedia:async()=>{cameraRequests++;throw Object.assign(Error('denied'),{name:'NotAllowedError'});}}});
 await app.boot();
 const row=await until(()=>app.document.querySelector('[data-module="cards"]'));
 assert.equal(app.document.querySelector('[data-module="people"]'),null);
 touch(app,row,'touchstart',150);touch(app,row,'touchmove',160,350);touch(app,row,'touchend',160,350);
 assert.equal(app.document.querySelector('[data-scan-video]'),null);
 touch(app,row,'touchstart',150);touch(app,row,'touchmove',335);touch(app,row,'touchend',335);
 await until(()=>app.document.querySelector('[data-scan-video]'));
 await until(()=>cameraRequests===1);
 assert.match(app.document.querySelector('[data-scan-status]').textContent,/cameratoegang/);
 assert.deepEqual(app.errors,[]);
});
test('contact strips edit locally, survive refresh and reload, delete without reappearing, and reconnect with the same identity',async t=>{
 const app=await appHarness();t.after(()=>app.close());
 const {ConnectionService}=await app.load(modulePath),service=new ConnectionService(app.store);
 const d=await service.device();
 await service.rememberSelf({personId:d.personId,networkId:'Network00001',line:1,name:'Eigen naam'});
 const peer={personId:'OtherUser001',chatId:'ChatWith0001',name:'Oorspronkelijke naam'};
 let requests=0;
 app.window.fetch=async(_,options)=>{
  const action=JSON.parse(options.body).action;requests++;
  assert.equal(action,'contacts');return {ok:true,json:async()=>({contacts:[peer]})};
 };
 const {openPeopleView}=await app.load('./src/ui/PeopleView.js?v='+version);
 const host=app.document.createElement('main');app.document.body.append(host);
 let cleanup=openPeopleView(host,{store:app.store,settings:{get:()=>({profile:{name:'Eigen naam'}})}});
 t.after(()=>cleanup());
 let row=await until(()=>{const r=host.querySelector('[data-swipe-row]');return r&&!r.querySelector('button').disabled&&r;});
 assert.ok(row.classList.contains('sh-object-strip'));
 row.querySelector('[data-swipe-edit]').click();
 let form=await until(()=>host.querySelector('[data-contact-form]'));
 await until(()=>!form.querySelector('button').disabled);
 form.elements.name.value='Mijn contactnaam';
 form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>host.querySelector('[data-swipe-surface]')?.textContent.includes('Mijn contactnaam'));
 assert.equal((await service.contacts())[0].name,'Mijn contactnaam');
 assert.equal(peer.name,'Oorspronkelijke naam');
 cleanup();cleanup=openPeopleView(host,{store:app.store,settings:{get:()=>({profile:{name:'Eigen naam'}})}});
 row=await until(()=>{const r=host.querySelector('[data-swipe-row]');return r&&!r.querySelector('button').disabled&&r;});
 assert.match(row.textContent,/Mijn contactnaam/);
 app.window.confirm=()=>false;row.querySelector('[data-swipe-delete]').click();
 await until(()=>!row.querySelector('button').disabled);
 assert.ok(host.querySelector('[data-swipe-row]'));
 app.window.confirm=()=>true;row.querySelector('[data-swipe-delete]').click();
 await until(()=>!host.querySelector('[data-swipe-row]')&&host.querySelector('[data-invite]'));
 assert.equal((await service.contacts()).length,0);
 assert.equal((await new ConnectionService(app.store).contacts({offline:true})).length,0);
 await service.restoreContact(peer.personId);
 const restored=(await service.contacts())[0];
 assert.equal(restored.personId,peer.personId);assert.equal(restored.chatId,peer.chatId);
 assert.equal(restored.name,'Mijn contactnaam');
 assert.ok(requests>0);assert.deepEqual(app.errors,[]);
});

test('the central camera routes an ordinary QR to Cards without saving a card or joining the network',async t=>{
 const app=await appHarness();t.after(()=>app.close());
 app.window.HTMLMediaElement.prototype.pause=function(){};
 app.window.TextEncoder=TextEncoder;
 app.window.URL.createObjectURL=()=> 'blob:scan-test';app.window.URL.revokeObjectURL=()=>{};
 app.window.ZXing={
  DecodeHintType:{POSSIBLE_FORMATS:1,TRY_HARDER:2},BarcodeFormat:{QR_CODE:0,0:'QR_CODE'},
  BrowserMultiFormatReader:class {
   async decodeFromImageUrl(){return {getBarcodeFormat:()=>0,getText:()=> 'https://example.test/mijn-pas'};}
   reset(){}
  }
 };
 await app.boot();
 (await until(()=>app.document.querySelector('[data-module="codes"]'))).click();
 const photo=await until(()=>app.document.querySelector('[data-scan-photo]'));
 Object.defineProperty(photo,'files',{value:[new app.window.File(['test'],'code.png',{type:'image/png'})]});
 photo.dispatchEvent(new app.window.Event('change',{bubbles:true}));
 await until(()=>app.document.querySelector('[name="codeValue"]')?.value==='https://example.test/mijn-pas');
 assert.equal((await app.store.getAll('objects')).filter(o=>o.type==='card').length,0);
 const {ConnectionService}=await app.load(modulePath);
 assert.equal((await new ConnectionService(app.store).device()).registered,false);
 assert.deepEqual(app.requests,[]);assert.deepEqual(app.errors,[]);
});
