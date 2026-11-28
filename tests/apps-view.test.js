import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openAppsView} from '../src/ui/AppsView.js';
const orderModules=()=>document.querySelector('[data-apps-order]').click();
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const items=[{id:'environment',title:'Omgeving'},{id:'locations',title:'Locaties'},{id:'notes',title:'Notities en lijsten'}];
function fixture(t,connection,initial={home:{modules:['environment','locations']}},signedIn=true){
 const dom=new JSDOM('<main/>',{url:'https://sharon.test/'}),previous={document:globalThis.document,window:globalThis.window};Object.assign(globalThis,{document:dom.window.document,window:dom.window});
 const original=connection;
 connection={device:async()=>({personId:'DemoUser0001',deviceToken:'d'.repeat(43)}),request:async(action,...args)=>{
  if(action==='account-app-code')return {code:'c'.repeat(43)};
  if(action==='account-status')return {account:signedIn?{id:'DemoUser0001',email:'test@example.test',personId:'DemoUser0001'}:null};
  return original?.request(action,...args);
 }};
 let value=initial,fail=false;const changes=[];
 const settings={get:()=>structuredClone(value),update:async patch=>{if(fail)throw Error('Opslag vol');value={...value,...structuredClone(patch)};}};
 const metadata=new Map(signedIn?[['account.session.v1',{key:'account.session.v1',value:{token:'s'.repeat(43)}}]]:[]);
 const store={get:async(_table,key)=>metadata.get(key),put:async(_table,row)=>metadata.set(row.key,row),delete:async(_table,key)=>metadata.delete(key)};let close=openAppsView(document.querySelector('main'),{settings,store,items,connection,onChanged:ids=>changes.push(ids)});
 t.after(()=>{close();dom.window.close();Object.assign(globalThis,previous);});
 return {dom,settings,changes,fail:()=>{fail=true;},close:()=>close(),reopen:()=>{close();close=openAppsView(document.querySelector('main'),{settings,store,items,connection});}};
}
test('Home module choices persist, reorder and keep all choices reachable when every module is hidden',async t=>{
 const f=fixture(t);orderModules();const toggle=id=>document.querySelector(`[data-module-choice="${id}"] [role="switch"]`);
 assert.equal(toggle('notes').getAttribute('aria-checked'),'false');toggle('notes').click();await settle();assert.deepEqual(f.settings.get().home.modules,['environment','locations','notes']);
 document.querySelector('[data-module-handle="notes"]').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));await settle();assert.deepEqual(f.settings.get().home.modules,['environment','notes','locations']);
 f.reopen();orderModules();assert.equal(toggle('notes').getAttribute('aria-checked'),'true');
 for(const id of ['environment','notes','locations']){toggle(id).click();await settle();}
 assert.deepEqual(f.settings.get().home.modules,[]);assert.equal(document.querySelectorAll('[role="switch"]').length,3);
});
test('Failed Home settings write retains prior toggles and exposes the storage error',async t=>{
 const f=fixture(t);orderModules();f.fail();document.querySelector('[data-module-choice="environment"] button').click();await settle();
 assert.equal(document.querySelector('[data-module-choice="environment"] [role="switch"]').getAttribute('aria-checked'),'true');assert.match(document.querySelector('[role="status"]').textContent,/Opslag vol/);assert.equal(f.changes.length,0);
});
test('Dragging a selected module reorders it without changing membership',async t=>{
 const f=fixture(t);orderModules();const source=document.querySelector('[data-module-choice="locations"]'),target=document.querySelector('[data-module-choice="environment"]');
 const handle=source.querySelector('[data-module-handle]');document.elementFromPoint=()=>target;
 for(const type of ['pointerdown','pointermove','pointerup']){const event=new f.dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,clientX:20,clientY:20,button:0});handle.dispatchEvent(event);}
 await settle();assert.deepEqual(f.settings.get().home.modules,['locations','environment']);
 const order=f.settings.get().home.order;
 document.querySelector('[data-module-choice="locations"] [role="switch"]').click();await settle();
 document.querySelector('[data-module-choice="locations"] [role="switch"]').click();await settle();
 assert.deepEqual(f.settings.get().home.order,order);assert.deepEqual(f.settings.get().home.modules,['locations','environment']);
 f.reopen();orderModules();assert.deepEqual([...document.querySelectorAll('[data-module-choice]')].map(el=>el.dataset.moduleChoice),order);

});
test('ShopList connects through the signed-in account and then opens fullscreen',async t=>{
 const calls=[];
 const f=fixture(t,{request:async action=>{calls.push(action);return {devices:[]};}});
 f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 const openShop=()=>document.querySelector('[data-swipe-row="shoplist"] [data-swipe-surface]').click();
 await settle();openShop();await settle();
 const board=document.querySelector('dialog[aria-label="ShopList"]');
 const pill=board.querySelector('[data-deck-grab]');
 assert.equal(pill.textContent,'Verbind ShopList');
 assert.equal(board.querySelector('.sh-board-photo-source').hidden,true);
 assert.equal(board.querySelectorAll('.sh-shop-access-content button, input').length,0);
 assert.equal(document.querySelector('iframe'),null);
 pill.click();await settle();
 assert.equal(pill.textContent,'ShopList verbonden');
 assert.equal(pill.getAttribute('aria-disabled'),'true');
 const source=board.querySelector('[data-card-media] .sh-board-photo-source');
 assert.equal(source.getAttribute('aria-label'),'Open ShopList');
 assert.equal(source.hidden,false);
 pill.click();
 assert.equal(document.querySelector('iframe'),null);
 source.click();
 assert(document.querySelector('.sh-notes-deck.is-fullscreen iframe'));
 assert.deepEqual(f.settings.get().home.modules,['environment','locations','notes']);
 assert.deepEqual(calls,['shop-pair-list']);
 f.reopen();
 await settle();openShop();await settle();
 document.querySelector('dialog[aria-label="ShopList"] .sh-board-photo-source').click();
 const fullscreen=document.querySelector('.sh-notes-deck.is-fullscreen');
 assert(fullscreen?.querySelector('iframe'));
 assert.equal(document.querySelector('.sh-shop-access'),null);
 fullscreen.dispatchEvent(new f.dom.window.Event('cancel',{cancelable:true}));
 assert.equal(document.querySelector('iframe'),null);
});

test('Horizontal swipes cycle app boards and keep each app connection separate',async t=>{
 const f=fixture(t,{request:async()=>({devices:[]})});
 const win=f.dom.window;
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 await settle();
 document.querySelector('[data-swipe-row="shoplist"] [data-swipe-surface]').click();await settle();
 const board=()=>document.querySelector('dialog');
 const swipe=dx=>{
  const header=board().querySelector('[data-card-media]');
  for(const [type,x] of [['pointerdown',120],['pointermove',120+dx],['pointerup',120+dx]]){
   const event=new win.Event(type,{bubbles:true,cancelable:true});
   Object.assign(event,{pointerId:1,pointerType:'touch',clientX:x,clientY:40});
   header.dispatchEvent(event);
  }
 };
 const stack=()=>board().querySelector('.sh-board-stack');
 const handle=board().querySelector('[data-deck-size="board"]');
 for(const [type,y] of [['pointerdown',20],['pointermove',70],['pointerup',70]]){
  const event=new win.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:2,pointerType:'touch',clientX:120,clientY:y});
  handle.dispatchEvent(event);
 }
 const height=stack().style.getPropertyValue('--card-deck-height');
 swipe(-100);await settle();
 assert.equal(stack().style.getPropertyValue('--card-deck-height'),height);
 assert.equal(board().getAttribute('aria-label'),'Event Line');
 board().querySelector('[data-deck-grab]').click();await settle();
 swipe(100);
 assert.equal(board().getAttribute('aria-label'),'ShopList');
 assert.equal(board().querySelector('.sh-board-photo-source').hidden,true);
 swipe(-100);
 assert.equal(board().getAttribute('aria-label'),'Event Line');
 assert.equal(board().querySelector('.sh-board-photo-source').hidden,false);
 for(const title of ['Ritten','Taken','Pasjes','Gesprekken','ShopList']){
  swipe(-100);
  assert.equal(board().getAttribute('aria-label'),title);
  assert(board().querySelector('[data-deck-grab] [data-deck-start]'));
  assert(board().querySelector('[data-deck-grab] [data-deck-icon]'));
 }
 assert.equal(document.querySelectorAll('dialog').length,1);
 assert.equal(document.querySelector('iframe'),null);
});

test('Existing profile without Home preference starts with all current choices enabled',async t=>{
 const f=fixture(t,undefined,{profile:{name:'Stefan'}});orderModules();
 assert.equal(document.querySelectorAll('[role="switch"][aria-checked="true"]').length,items.length);
 document.querySelector('[data-module-choice="locations"] button').click();await settle();
 assert.deepEqual(f.settings.get().home.modules,['environment','notes']);
});

test('Event Line connects from its board and opens inside Apps', async t => {
 const f=fixture(t);
 f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};

 await settle();
 const launch=()=>document.querySelector('[data-swipe-row="eventline"] [data-swipe-surface]');
 assert(document.querySelector('[data-swipe-row="shoplist"]'));
 launch().click();
 await settle();
 const board=document.querySelector('dialog[aria-label="Event Line"]');
 assert(board);
 assert.equal(document.querySelector('iframe'),null);
 assert.equal(board.querySelectorAll('.sh-shop-access-content button').length,0);
 board.querySelector('[data-deck-grab]').click();
 await settle();
 board.querySelector('[data-card-media] .sh-board-photo-source').click();
 const frame=document.querySelector('iframe[title="Event Line"]');
 assert.equal(frame.src,'https://sharon.life/eventline/?from=sharon');
 assert(frame.closest('.sh-external-app-fullscreen'));
 const back=()=>document.querySelector('.sh-external-app-return');
 assert(back().querySelector('img'));
 back().click();
 assert.equal(document.querySelector('iframe'),null);
 launch().click();await settle();
 document.querySelector('dialog[aria-label="Event Line"] .sh-board-photo-source').click();
 const embedded=document.querySelector('.sh-external-app-fullscreen iframe');
 const send=(type,origin='https://sharon.life')=>f.dom.window.dispatchEvent(
  new f.dom.window.MessageEvent('message',{data:{type},origin,source:embedded.contentWindow})
 );
 send('eventline:return','https://example.org');
 assert(embedded.isConnected);
 const messages=[];embedded.contentWindow.postMessage=(data,origin)=>messages.push({data,origin});
 send('eventline:account-request');await settle();
 assert.deepEqual(messages,[{data:{type:'eventline:account-code',code:'c'.repeat(43)},origin:'https://sharon.life'}]);
 assert(!JSON.stringify(messages).includes('deviceToken'));
 send('eventline:return-ready');
 assert.equal(back().hidden,true);
 send('eventline:return');
 assert.equal(document.querySelector('iframe'),null);
 f.dom.window.confirm=()=>true;
 const surface=launch();
 for(const [type,x] of [['pointerdown',120],['pointermove',10],['pointerup',10]]){
  const event=new f.dom.window.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:8,pointerType:'touch',clientX:x,clientY:20});
  surface.dispatchEvent(event);
 }
 document.querySelector('[data-swipe-row="eventline"] [data-swipe-delete]').click();
 await settle();
 assert.equal(document.querySelector('[data-swipe-row="eventline"] [data-swipe-delete]'),null);
 launch().click();await settle();
 assert([...document.querySelectorAll('dialog button')].some(b=>b.textContent==='Verbind Event Line'));
 assert.deepEqual(f.settings.get().home.modules,['environment','locations']);
});

test('Ontkoppelen op de ShopList-strook deactiveert de app in Sharon na bevestiging',async t=>{
 const calls=[];
 const f=fixture(t,{request:async action=>{
  calls.push(action);
  return {devices:[{id:'existing',status:'active'}]};
 }});
 await settle();
 const remove=()=>document.querySelector('[data-swipe-row="shoplist"] [data-swipe-delete]');
 f.dom.window.confirm=()=>false;
 remove().click();await settle();
 assert(remove());
 f.dom.window.confirm=()=>true;
 remove().click();await settle();
 assert.equal(remove(),null);
 assert.deepEqual(calls,['shop-pair-list']);
});

test('Apps verbinden introduces the account above app strips and opens the extras boards',async t=>{
 const connection={device:async()=>({}),request:async()=>({devices:[]})};
 const f=fixture(t,connection);
 f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 await settle();
 const panel=document.querySelector('.sh-apps-panel');
 assert.equal(document.querySelector('[data-apps-order]').getAttribute('aria-pressed'),'false');
 orderModules();
 assert(panel.querySelector('[data-module-choice]'));
 orderModules();
 assert(panel.firstElementChild.matches('.sh-account-hero'));
 assert(panel.children[1].matches('.sh-account-intro'));
 assert(panel.children[2].matches('.sh-connected-apps'));
 for(const title of ['Ritten','Taken','Pasjes','Gesprekken']){
  const tile=[...panel.querySelectorAll('.sh-account-extra')].find(element=>element.textContent===title);
  tile.focus();
  tile.click();
  const board=document.querySelector('.sh-account-extra-board');
  assert.equal(board.querySelector('h2').textContent,title);
  assert(board.querySelector('.sh-shop-access-content p').textContent);
  assert.equal(board.querySelectorAll('.sh-shop-access-content button').length,0);
  board.dispatchEvent(new f.dom.window.Event('cancel',{cancelable:true}));
  assert.equal(document.activeElement,tile);
 }
});

test('Without a Sharon account app boards are readable and connecting requires login',async t=>{
 const f=fixture(t,undefined,undefined,false);
 f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 await settle();
 for(const [id,title] of [['shoplist','ShopList'],['eventline','Event Line']]){
  document.querySelector(`[data-swipe-row="${id}"] [data-swipe-surface]`).click();
  const board=document.querySelector('dialog');
  assert.equal(board.getAttribute('aria-label'),title);
  assert.equal(board.querySelector('[data-deck-grab]').textContent,'Inloggen bij Sharon');
  assert.equal(board.querySelectorAll('.sh-shop-access-content button').length,0);
  board.dispatchEvent(new f.dom.window.Event('cancel',{cancelable:true}));
 }
 [...document.querySelectorAll('.sh-account-controls button')].find(button=>button.textContent==='Account aanmaken').click();
 assert(document.querySelector('dialog[aria-label="Sharon-account"] input[autocomplete="new-password"]'));
});
