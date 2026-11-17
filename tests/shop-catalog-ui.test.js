import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openShopCatalog} from '../src/ui/ShopCatalog.js';
const tick=()=>new Promise(r=>setTimeout(r,20));
test('Catalog sharing asks for a scope and grants nobody access automatically',async t=>{
 const dom=new JSDOM('<body/>',{url:'https://stefan-van-dijk.github.io/sharon/'});globalThis.document=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 t.after(()=>{delete globalThis.document;dom.window.close();});
 const calls=[],collections=[];
 const api={catalog:async()=>({catalog:{payload:{categories:[{id:'breakfast',name:'Ontbijt'}]}}}),library:async(cmd,input)=>{
  calls.push([cmd,input]);if(cmd==='index')return {collections};if(cmd==='contacts')return {contacts:[]};if(cmd==='create'){collections.push({...input,role:'owner',ownerName:'Stefan',products:[],members:{}});return {ok:true};}throw Error(cmd);
 }};
 const close=openShopCatalog({api,categoryId:'breakfast'});await tick();
 assert.equal(document.querySelector('select').value,'breakfast');
 [...document.querySelectorAll('button')].find(b=>b.textContent==='Personen en toegang kiezen').click();await tick();
 const created=calls.find(([cmd])=>cmd==='create')[1];assert.match(created.id,/^[A-Za-z0-9_-]{12}$/);assert.equal(created.scope,'branch');assert.deepEqual(created.categories,['breakfast']);assert.ok(!calls.some(([cmd])=>cmd==='share'));
 close();assert.equal(document.querySelector('dialog'),null);
});
