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

test('Category strips share, archive and restore, and boards open the selected category or list in ShopList',async t=>{
 const dom=new JSDOM('<body/>',{url:'https://stefan-van-dijk.github.io/sharon/'});
 globalThis.document=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 t.after(()=>{delete globalThis.document;dom.window.close();});
 let archived=false;
 const calls=[],api={
  connection:{device:async()=>({personId:'me'})},
  catalog:async()=>({catalog:{payload:{categories:[{id:'fruit',name:'Fruit'}]}},archivedCategoryIds:archived?['fruit']:[]}),
  library:async(command,input)=>{
   calls.push([command,input]);
   if(command==='index')return {collections:[]};
   if(command==='category-archive'){archived=input.archived;return {ok:true};}
   if(command==='category-lists')return {lists:[
    {id:'weekend',name:'Weekend',items:[{name:'Appel',quantity:2,done:false}]},
    {id:'werk',name:'Werk',items:[{name:'Peer',quantity:1,done:true}]}
   ]};
   throw Error(command);
  }
 };
 const close=openShopCatalog({api});t.after(close);await tick();
 const row=()=>document.querySelector('[data-swipe-row="category:fruit"]');
 const click=label=>[...document.querySelectorAll('dialog button')].find(button=>button.textContent===label).click();
 assert.equal(row().querySelector('[data-swipe-delete]'),null);
 row().querySelector('[data-swipe-share]').click();await tick();
 assert.equal(document.querySelector('select').value,'fruit');
 assert.equal(calls.some(([command])=>command==='share'),false);
 click('Terug');await tick();
 row().querySelector('[data-swipe-surface]').click();await tick();
 assert.match(document.querySelector('dialog').textContent,/Weekend.*2 × Appel.*Werk.*✓ 1 × Peer/s);
 click('Open categorie in ShopList');await tick();
 const frame=document.querySelector('iframe');
 assert.equal(new URL(frame.src).searchParams.get('category'),'fruit');
 const send=(origin,type)=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin,source:frame.contentWindow,data:{type}}));
 send('https://example.com','shop:return');assert.equal(document.querySelector('iframe'),frame);
 send('https://stefan-van-dijk.github.io','shop:return');await tick();
 click('Open lijst in ShopList');await tick();
 assert.equal(new URL(document.querySelector('iframe').src).searchParams.get('shoplist'),'weekend');
 click('Terug');await tick();
 click('Terug');await tick();
 row().querySelector('[data-swipe-secondary]').click();await tick();
 assert.equal(row(),null);
 click('Archief · herstellen');await tick();
 assert.equal(row().querySelector('[data-swipe-secondary]').textContent,'Terugzetten');
 row().querySelector('[data-swipe-secondary]').click();await tick();
 assert.ok(row());
 assert.deepEqual(calls.filter(([command])=>command==='category-archive'),[
  ['category-archive',{id:'fruit',archived:true}],['category-archive',{id:'fruit',archived:false}]
 ]);
});
