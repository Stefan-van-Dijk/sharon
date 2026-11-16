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
 const store={get:async()=>undefined,put:async()=>{}};let close=openAppsView(document.querySelector('main'),{settings,store,items,connection,onChanged:ids=>changes.push(ids)});
 t.after(()=>{close();dom.window.close();Object.assign(globalThis,previous);});
 return {dom,settings,changes,fail:()=>{fail=true;},close:()=>close(),reopen:()=>{close();close=openAppsView(document.querySelector('main'),{settings,store,items,connection});}};
}
test('Home module choices persist, reorder and keep all choices reachable when every module is hidden',async t=>{
 const f=fixture(t);const toggle=id=>document.querySelector(`[data-module-choice="${id}"] [role="switch"]`);
 assert.equal(toggle('notes').getAttribute('aria-checked'),'false');toggle('notes').click();await settle();assert.deepEqual(f.settings.get().home.modules,['environment','locations','notes']);
 document.querySelector('[aria-label="Notities en lijsten omhoog"]').click();await settle();assert.deepEqual(f.settings.get().home.modules,['environment','notes','locations']);
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
 source.dispatchEvent(new f.dom.window.Event('dragstart',{bubbles:true}));target.dispatchEvent(new f.dom.window.Event('drop',{bubbles:true,cancelable:true}));await settle();assert.deepEqual(f.settings.get().home.modules,['locations','environment']);
});
test('Explicit app connection enables its content module and closes its board when management is left',async t=>{
 const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const connection={device:async()=>({}),request:async action=>action==='shop-pair-create'?{id:'pairing',code:'abcdefghijkl'}:{devices:[]}};
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
