import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openShopPairing} from '../src/ui/ShopPairing.js';

function fixture(t){
 const dom=new JSDOM('<button id="launch">Apps</button>',{url:'https://stefan-van-dijk.github.io/sharon/'});
 const previous={document:globalThis.document,window:globalThis.window};Object.assign(globalThis,{document:dom.window.document,window:dom.window});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 document.querySelector('#launch').focus();
 t.after(()=>{dom.window.close();Object.assign(globalThis,previous);});
 return dom.window;
}
function swipe(win,target,dy,cancel=false){
 for(const [type,y]of [['pointerdown',20],['pointermove',20+dy],[cancel?'pointercancel':'pointerup',20+dy]]){
  const event=new win.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,pointerType:'touch',clientX:150,clientY:y});target.dispatchEvent(event);
 }
}
test('Pairing can be dismissed while its server request is pending, restoring focus and ignoring late completion',async t=>{
 const win=fixture(t);let finish,calls=0;
 const connection={device:async()=>({}),request:()=>{calls++;return new Promise(resolve=>finish=resolve);}};
 const close=openShopPairing(connection);t.after(close);await Promise.resolve();await Promise.resolve();
 const dialog=document.querySelector('dialog');
 assert(dialog.querySelector('.sh-board-stack [data-card-board] .sh-card-media'));
 assert.equal(dialog.querySelector('[data-shop-close]'),null);
 assert.equal(dialog.querySelectorAll('[data-deck-size]').length,2);
 swipe(win,dialog.querySelector('h2'),100);
 assert.equal(dialog.isConnected,false);assert.equal(document.activeElement.id,'launch');
 finish({devices:[]});await Promise.resolve();await Promise.resolve();
 document.dispatchEvent(new window.Event('visibilitychange'));await Promise.resolve();
 assert.equal(calls,1);assert.equal(document.querySelector('dialog'),null);
});
test('Pairing board closes on completed media pull-down, preserving content scrolling and cancellation',async t=>{
 const win=fixture(t);const close=openShopPairing({device:async()=>({}),request:async()=>({devices:[]})});t.after(close);
 const dialog=document.querySelector('dialog'),header=dialog.querySelector('[data-card-media]');
 swipe(win,dialog.querySelector('.sh-shop-access-content'),100);assert(dialog.isConnected);
 swipe(win,header,100,true);assert(dialog.isConnected);
 swipe(win,header,100);assert.equal(dialog.isConnected,false);
});

test('App board size handles adjust height independently and cancelled resizing restores layout',t=>{
 const win=fixture(t);const close=openShopPairing({device:async()=>({}),request:async()=>({devices:[]})});t.after(close);
 const dialog=document.querySelector('dialog'),stack=dialog.querySelector('.sh-board-stack');
 const height=()=>parseFloat(stack.style.getPropertyValue('--card-deck-height'));
 const media=()=>parseFloat(stack.style.getPropertyValue('--card-deck-media'));
 const initial=height(),picture=media();swipe(win,dialog.querySelector('[data-deck-size="board"]'),50);assert.equal(height(),initial-50);assert.equal(media(),picture);
 swipe(win,dialog.querySelector('[data-deck-size="media"]'),-30);assert.equal(media(),picture-30);
 swipe(win,dialog.querySelector('[data-deck-size="board"]'),40,true);assert.equal(height(),initial-50);assert(dialog.isConnected);
});
test('Reopening an active connection only reads status, even after the invitation expiry',async t=>{
 fixture(t);const calls=[];
 const connection={device:async()=>({}),request:async action=>{calls.push(action);return {devices:[{id:'active',status:'active',fingerprint:'ABCD',expiresAt:1}]};}};
 for(let i=0;i<2;i++){
  const close=openShopPairing(connection);await new Promise(r=>setTimeout(r,0));
  assert.match(document.querySelector('.sh-shop-invitation').textContent,/is verbonden/);
  assert.equal(document.querySelector('input'),null);assert.equal(document.querySelector('[data-pair-create]').textContent,'Andere installatie koppelen');close();
 }
 assert.deepEqual(calls,['shop-pair-list','shop-pair-list']);
});
test('Only explicit additional installation creates and copies a code; ready remains pending until acknowledgement',async t=>{
 fixture(t);const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),copied=[],calls=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>copied.push(value)}}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;});
 let pending=null;const connection={device:async()=>({}),request:async action=>{calls.push(action);if(action==='shop-pair-create'){pending={id:'new',status:'pending',compact:true};return {id:'new',code:'abcdefghijkl',expiresAt:Date.now()+60000};}return {devices:[{id:'existing',status:'active',fingerprint:'FIRST'},...(pending?[pending]:[])]};}};
 const close=openShopPairing(connection);t.after(close);const settle=()=>new Promise(r=>setTimeout(r,0));await settle();
 document.querySelector('[data-pair-create]').click();await settle();assert.deepEqual(copied,['abcdefghijkl']);assert.equal(calls.filter(a=>a==='shop-pair-create').length,1);assert.equal(document.querySelector('[data-pair-create]').disabled,false);
 const refresh=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Vernieuwen').click();
 pending.status='ready';refresh();await settle();assert.match(document.querySelector('.sh-notes-body').textContent,/rondt het opslaan/);assert(document.querySelector('input'));
 pending.status='active';refresh();await settle();assert.equal(document.querySelector('input'),null);assert.match(document.querySelector('[role="status"]').textContent,/Koppeling geslaagd/);
});
test('Unavailable status cannot create a code or claim the app is disconnected',async t=>{
 fixture(t);const calls=[];const close=openShopPairing({device:async()=>({}),request:async action=>{calls.push(action);throw Error('Offline');}});t.after(close);await new Promise(r=>setTimeout(r,0));
 assert.match(document.querySelector('[role="status"]').textContent,/Verbindingsstatus kon niet worden opgehaald/);assert.equal(document.querySelector('[data-pair-create]'),null);assert.deepEqual(calls,['shop-pair-list']);
});
