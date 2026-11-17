import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openNotesView} from '../src/ui/NotesView.js';
const settle=()=>new Promise(r=>setTimeout(r,0));
function pointer(win,target,type,x,y){const event=new win.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});target.dispatchEvent(event);}
function swipe(win,target,dx,dy=0){pointer(win,target,'pointerdown',150,50);pointer(win,target,'pointermove',150+dx,50+dy);pointer(win,target,'pointerup',150+dx,50+dy);}
test('Mixed notes deck swipes in filtered order, freezes navigation fullscreen, returns and picks up',async t=>{
 const dom=new JSDOM('<main/>',{url:'https://sharon.test/'}),old={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent};
 Object.assign(globalThis,{document:dom.window.document,window:dom.window,CustomEvent:dom.window.CustomEvent});
 const {document}=dom.window;dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 let stop=()=>{};t.after(()=>{stop();dom.window.close();Object.assign(globalThis,old);});
 const metadata=new Map(),calls=[];
 const store={get:async(_,key)=>metadata.get(key),getAll:async()=>[{id:'note',type:'note',name:'Alpha',data:{kind:'note',body:'Mijn notitie'}},{id:'other',type:'note',name:'Zulu',data:{kind:'idea',body:'Andere'}}],put:async(_,record)=>metadata.set(record.key,record)};
 const api={connection:{device:async()=>({personId:'me',registered:true,self:{line:1,name:'Test'}})},index:async()=>({lists:[{id:'shop',name:'Boodschappen',role:'owner'}]}),read:async id=>{calls.push(id);return {list:{payload:{list:{id,name:'Boodschappen',items:[]},products:[]}}};}};
 stop=await openNotesView(document.querySelector('main'),{store,api});await settle();
 document.querySelector('[data-swipe-row="local:note"] [data-swipe-surface]').click();await settle();
 const heading=()=>document.querySelector('.sh-notes-deck h2');
 assert.equal(heading().textContent,'Alpha');
 swipe(dom.window,heading(),-90);await settle();assert.equal(heading().textContent,'Boodschappen');assert.deepEqual(calls,['shop']);
 const source=document.querySelector('button.sh-notes-app-source');assert(source);assert.equal(source.getAttribute('target'),null);assert(document.querySelector('[data-card-media] [data-deck-grab]'));
 document.querySelector('[data-notes-fullscreen]').click();await settle();assert(document.querySelector('.sh-notes-deck.is-fullscreen'));
 swipe(dom.window,heading(),-90);await settle();assert.equal(heading().textContent,'Boodschappen');
 const frame=document.querySelector('iframe');
 dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'https://evil.example',source:frame.contentWindow,data:{type:'shop:return'}}));assert(document.querySelector('.is-fullscreen'));
 dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'https://stefan-van-dijk.github.io',source:dom.window,data:{type:'shop:return'}}));assert(document.querySelector('.is-fullscreen'));
 dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'https://stefan-van-dijk.github.io',source:frame.contentWindow,data:{type:'shop:return'}}));await settle();assert.equal(document.querySelector('.is-fullscreen'),null);
 swipe(dom.window,heading(),90);await settle();assert.equal(heading().textContent,'Alpha');
 const grab=document.querySelector('[data-deck-grab]'),stack=document.querySelector('.sh-share-zone-stack');
 pointer(dom.window,grab,'pointerdown',100,100);pointer(dom.window,grab,'pointermove',140,100);assert(stack.classList.contains('is-card-deck-lifted'));
 pointer(dom.window,grab,'pointermove',140,145);pointer(dom.window,grab,'pointerup',140,145);await settle();
 assert.equal(metadata.get('notes.board.layout').value.y,45/dom.window.innerHeight);
});
