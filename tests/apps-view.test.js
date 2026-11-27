import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openAppsView} from '../src/ui/AppsView.js';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const items=[{id:'environment',title:'Omgeving'},{id:'locations',title:'Locaties'},{id:'notes',title:'Notities en lijsten'}];
function fixture(t,connection,initial={home:{modules:['environment','locations']}}){
 const dom=new JSDOM('<main/>',{url:'https://sharon.test/'}),previous={document:globalThis.document,window:globalThis.window};Object.assign(globalThis,{document:dom.window.document,window:dom.window});
 let value=initial,fail=false;const changes=[];
 const settings={get:()=>structuredClone(value),update:async patch=>{if(fail)throw Error('Opslag vol');value={...value,...structuredClone(patch)};}};
 const metadata=new Map();
 const store={get:async(_table,key)=>metadata.get(key),put:async(_table,row)=>metadata.set(row.key,row)};let close=openAppsView(document.querySelector('main'),{settings,store,items,connection,onChanged:ids=>changes.push(ids)});
 t.after(()=>{close();dom.window.close();Object.assign(globalThis,previous);});
 return {dom,settings,changes,fail:()=>{fail=true;},close:()=>close(),reopen:()=>{close();close=openAppsView(document.querySelector('main'),{settings,store,items,connection});}};
}
test('Home module choices persist, reorder and keep all choices reachable when every module is hidden',async t=>{
 const f=fixture(t);const toggle=id=>document.querySelector(`[data-module-choice="${id}"] [role="switch"]`);
 assert.equal(toggle('notes').getAttribute('aria-checked'),'false');toggle('notes').click();await settle();assert.deepEqual(f.settings.get().home.modules,['environment','locations','notes']);
 document.querySelector('[data-module-handle="notes"]').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));await settle();assert.deepEqual(f.settings.get().home.modules,['environment','notes','locations']);
 f.reopen();assert.equal(toggle('notes').getAttribute('aria-checked'),'true');
 for(const id of ['environment','notes','locations']){toggle(id).click();await settle();}
 assert.deepEqual(f.settings.get().home.modules,[]);assert.equal(document.querySelectorAll('[role="switch"]').length,3);
});
test('Failed Home settings write retains prior toggles and exposes the storage error',async t=>{
 const f=fixture(t);f.fail();document.querySelector('[data-module-choice="environment"] button').click();await settle();
 assert.equal(document.querySelector('[data-module-choice="environment"] [role="switch"]').getAttribute('aria-checked'),'true');assert.match(document.querySelector('[role="status"]').textContent,/Opslag vol/);assert.equal(f.changes.length,0);
});
test('Dragging a selected module reorders it without changing membership',async t=>{
 const f=fixture(t),source=document.querySelector('[data-module-choice="locations"]'),target=document.querySelector('[data-module-choice="environment"]');
 const handle=source.querySelector('[data-module-handle]');document.elementFromPoint=()=>target;
 for(const type of ['pointerdown','pointermove','pointerup']){const event=new f.dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,clientX:20,clientY:20,button:0});handle.dispatchEvent(event);}
 await settle();assert.deepEqual(f.settings.get().home.modules,['locations','environment']);
 const order=f.settings.get().home.order;
 document.querySelector('[data-module-choice="locations"] [role="switch"]').click();await settle();
 document.querySelector('[data-module-choice="locations"] [role="switch"]').click();await settle();
 assert.deepEqual(f.settings.get().home.order,order);assert.deepEqual(f.settings.get().home.modules,['locations','environment']);
 f.reopen();assert.deepEqual([...document.querySelectorAll('[data-module-choice]')].map(el=>el.dataset.moduleChoice),order);

});
test('Explicit app connection enables its content module and closes its board when management is left',async t=>{
 const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const connection={device:async()=>({}),request:async action=>action==='shop-pair-create'?{id:'pairing',code:'abcdefghijkl'}:{devices:[{id:'shop',status:'active'}]}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{}}}});
 t.after(()=>{if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;});
 const f=fixture(t,connection);f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 document.querySelector('[data-apps-tab="apps"]').click();document.querySelector('[data-app-connection]').click();await settle();await settle();
 assert.deepEqual(f.settings.get().home.modules,['environment','locations','notes']);assert(document.querySelector('.sh-shop-access'));f.close();assert.equal(document.querySelector('.sh-shop-access'),null);
});

test('Existing profile without Home preference starts with all current choices enabled',async t=>{
 const f=fixture(t,undefined,{profile:{name:'Stefan'}});
 assert.equal(document.querySelectorAll('[role="switch"][aria-checked="true"]').length,items.length);
 document.querySelector('[data-module-choice="locations"] button').click();await settle();
 assert.deepEqual(f.settings.get().home.modules,['environment','notes']);
});

test('Event Line connects from its board and opens inside Apps', async t => {
 const f=fixture(t);
 f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 document.querySelector('[data-apps-tab="apps"]').click();
 const launch=document.querySelector('button[data-app-link="eventline"]');
 assert(document.querySelector('button[data-app-connection="shoplist"]'));
 launch.click();
 await settle();
 const board=document.querySelector('dialog[aria-label="Event Line"]');
 assert(board);
 assert.equal(document.querySelector('iframe'),null);
 [...board.querySelectorAll('button')].find(b=>b.textContent==='Verbind Event Line').click();
 await settle();
 [...board.querySelectorAll('button')].find(b=>b.textContent==='Open Event Line').click();
 const frame=document.querySelector('iframe[title="Event Line"]');
 assert.equal(frame.src,'https://sharon.life/eventline/');
 const external=document.querySelector('.sh-eventline-controls a');
 assert.equal(external.href,frame.src);
 assert.equal(external.target,'_blank');
 assert.equal(external.relList.contains('noopener'),true);
 document.querySelector('.sh-eventline-controls button').click();
 assert.equal(document.querySelector('iframe'),null);
 assert.equal(document.activeElement.dataset.appLink,'eventline');
 assert.deepEqual(f.settings.get().home.modules,['environment','locations']);
});
