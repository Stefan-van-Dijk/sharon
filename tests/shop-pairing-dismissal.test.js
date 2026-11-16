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
 fixture(t);let finish,calls=0;
 const connection={device:async()=>({}),request:()=>{calls++;return new Promise(resolve=>finish=resolve);}};
 const close=openShopPairing(connection);t.after(close);await Promise.resolve();await Promise.resolve();
 const dialog=document.querySelector('dialog');
 assert(dialog.querySelector('.sh-board-stack [data-card-board] .sh-card-media'));
 dialog.querySelector('[data-shop-close]').click();
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
