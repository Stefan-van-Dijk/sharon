import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openAppIntroBoard} from '../src/ui/ShopPairing.js';

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
const openBoard=(options={})=>openAppIntroBoard({
 title:'ShopList',description:'Uitleg',layoutKey:'apps.shoplist.board.layout',onTap:()=>{},...options
});
test('The board can close while connecting and returns focus to its launcher',async t=>{
 const win=fixture(t);let finish;
 const board=openBoard({onTap:()=>new Promise(resolve=>{finish=resolve;})});t.after(board.close);
 const dialog=document.querySelector('dialog');
 assert(dialog.querySelector('.sh-board-stack [data-card-board] .sh-card-media'));
 board.pill.click();
 swipe(win,dialog.querySelector('h2'),100);
 assert.equal(dialog.isConnected,false);
 assert.equal(document.activeElement.id,'launch');
 finish();await Promise.resolve();
 assert.equal(document.querySelector('dialog'),null);
});
test('The board closes on a completed pull-down from the header or pill',t=>{
 const win=fixture(t);let taps=0;
 const board=openBoard({onTap:()=>{taps++;}});t.after(board.close);
 const dialog=document.querySelector('dialog'),header=dialog.querySelector('[data-card-media]');
 swipe(win,dialog.querySelector('.sh-shop-access-content'),100);assert(dialog.isConnected);
 swipe(win,header,100,true);assert(dialog.isConnected);
 swipe(win,board.pill,100);assert.equal(dialog.isConnected,false);
 assert.equal(taps,0);
});

test('App board size handles adjust height independently and cancelled resizing restores layout',t=>{
 const win=fixture(t);const {close}=openBoard();t.after(close);
 const dialog=document.querySelector('dialog'),stack=dialog.querySelector('.sh-board-stack');
 const height=()=>parseFloat(stack.style.getPropertyValue('--card-deck-height'));
 const media=()=>parseFloat(stack.style.getPropertyValue('--card-deck-media'));
 const initial=height(),picture=media();swipe(win,dialog.querySelector('[data-deck-size="board"]'),50);assert.equal(height(),initial-50);assert.equal(media(),picture);
 swipe(win,dialog.querySelector('[data-deck-size="media"]'),-30);assert.equal(media(),picture-30);
 swipe(win,dialog.querySelector('[data-deck-size="board"]'),40,true);assert.equal(height(),initial-50);assert(dialog.isConnected);
});
test('App connection restores its own position and both sizes after closing and status updates',async t=>{
 const win=fixture(t),records=new Map([['cards.board.layout',{key:'cards.board.layout',value:{x:0,y:0,height:.8,media:.4}}]]);
 const store={get:async(_,key)=>records.get(key),put:async(_,record)=>records.set(record.key,structuredClone(record))};
 const options={layoutStore:store};
 const settle=()=>new Promise(r=>setTimeout(r,0));let close=openBoard(options).close;await settle();
 let dialog=document.querySelector('dialog'),stack=dialog.querySelector('.sh-board-stack');
 swipe(win,dialog.querySelector('[data-deck-size="board"]'),50);
 swipe(win,dialog.querySelector('[data-deck-size="media"]'),-30);
 dialog.querySelector('[data-deck-grab]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));await settle();
 const layout=stack.style.cssText,cardLayout=structuredClone(records.get('cards.board.layout'));
 assert(records.has('apps.shoplist.board.layout'));close();
 close=openBoard(options).close;t.after(close);await settle();
 dialog=document.querySelector('dialog');stack=dialog.querySelector('.sh-board-stack');assert.equal(stack.style.cssText,layout);
 assert.equal(stack.style.cssText,layout);assert.deepEqual(records.get('cards.board.layout'),cardLayout);
});
