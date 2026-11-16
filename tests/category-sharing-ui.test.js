import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {openListShare} from '../src/ui/ListSharing.js';
test('Category sharing requires a chosen category and grants read-only subset to selected person',async()=>{
 const dom=new JSDOM('<main/>'),previous={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window:dom.window,document:dom.window.document});
 const calls=[],api={read:async()=>({categorySharing:true,role:'owner',list:{members:{},payload:{categories:[{id:'fruit',name:'Fruit'},{id:'bread',name:'Brood'}]}}}),connection:{contacts:async()=>[{personId:'kim',name:'Kim'}]},share:async(...args)=>calls.push(args)};
 const store={get:async()=>null,put:async()=>{}};let close;
 try{
 close=openListShare({id:'weekend',name:'Weekend'},{store,api});await new Promise(r=>setTimeout(r,0));
 document.querySelector('[data-swipe-surface]').click();
 const scope=document.querySelector('[aria-label="Inhoud delen"]');scope.value='categories';scope.dispatchEvent(new dom.window.Event('change'));
 assert.equal(document.querySelector('[data-share-send]').disabled,true);
 const checkbox=document.querySelector('.sh-list-share-categories input');checkbox.checked=true;checkbox.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(document.querySelector('[aria-label="Toegang"]').disabled,true);
 document.querySelector('[data-share-send]').click();await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(calls,[['weekend','kim','read',['fruit']]]);
 }finally{close?.();Object.assign(globalThis,previous);dom.window.close();}
});
