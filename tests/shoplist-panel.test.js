import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {mountShopListPanel} from '../src/ui/ShopListPanel.js';
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(t,role='owner'){
 const dom=new JSDOM('<main/>');t.after(()=>dom.window.close());const body=dom.window.document.querySelector('main');
 const payload={list:{id:'selected',name:'Weekend',items:[]},products:[{id:'p',name:'Different shared product',categoryId:'c',barcodes:[]}],categories:[{id:'c',name:'Other category'}]};
 const catalog={products:[{id:'p',name:'Milk',categoryId:'c',barcodes:[]}],categories:[{id:'c',name:'Dairy',entries:[]}],recipes:[{id:'r',name:'Breakfast',kind:'recipe',ingredients:[{productId:'p',quantity:2,note:''}]},{id:'a',name:'Picnic',kind:'activity',ingredients:[{productId:'p',quantity:3,note:'cold'}]}]};
 const calls=[];let record={payload,revision:0},catalogReads=0;const api={catalog:async()=>{catalogReads++;return {catalog:{payload:catalog,revision:1}};},write:async(p,revision,operation)=>{calls.push({payload:structuredClone(p),revision,operation});record={payload:p,revision:revision+1};return {list:record,role};},read:async()=>({list:record,role})};
 const controller=mountShopListPanel({body,response:{list:record,role},api});const click=text=>[...body.querySelectorAll('button')].find(b=>b.textContent===text).click();return {body,api,calls,click,controller,catalogReads:()=>catalogReads};
}
test('Fullscreen choices use account catalogue and safely add recipes and activities to selected list',async t=>{
 const f=fixture(t);await tick();f.click('Gerechten');assert.match(f.body.textContent,/Breakfast/);assert.doesNotMatch(f.body.textContent,/Picnic/);f.click('Toevoegen');await tick();
 assert.equal(f.calls[0].payload.list.id,'selected');assert.equal(f.calls[0].payload.list.items[0].quantity,2);assert.notEqual(f.calls[0].payload.list.items[0].productId,'p');assert.equal(f.calls[0].payload.products.find(p=>p.id==='p').name,'Different shared product');
 f.click('Activiteiten');f.click('Toevoegen');await tick();assert.equal(f.calls[1].payload.list.items[1].quantity,3);assert.equal(f.calls[1].payload.list.items[1].note,'cold');
 f.click('Lijst');const check=f.body.querySelector('input[type=checkbox]');check.checked=true;check.dispatchEvent(new check.ownerDocument.defaultView.Event('change'));await tick();assert.equal(f.calls[2].payload.list.items[0].done,true);
});
test('Failed save preserves operation for retry; read-only lists cannot change or load catalogue',async t=>{
 const f=fixture(t);await tick();const original=f.api.write;let lost=true;const operations=[];f.api.write=async(...args)=>{operations.push(args[2]);if(lost){lost=false;throw Error('Lost response');}return original(...args);};
 f.click('Producten');f.click('Toevoegen');await tick();assert.match(f.body.textContent,/Lost response/);assert.equal(f.calls.length,0);f.click('Opnieuw bewaren');await tick();assert.equal(operations[0],operations[1]);assert.equal(f.calls.length,1);
 const read=fixture(t,'read');await tick();assert.equal(read.catalogReads(),0);assert.equal([...read.body.querySelectorAll('button')].some(b=>b.textContent==='Producten'),false);assert.equal(read.calls.length,0);
});
test('Late catalogue completion does not recreate closed fullscreen panel',async t=>{
 const dom=new JSDOM('<main/>');t.after(()=>dom.window.close());const body=dom.window.document.querySelector('main');let resolve;
 mountShopListPanel({body,response:{role:'owner',list:{revision:0,payload:{list:{id:'x',items:[]},products:[],categories:[]}}},api:{catalog:()=>new Promise(r=>resolve=r)}});await tick();body.remove();const before=body.textContent;resolve({catalog:{payload:{products:[],categories:[],recipes:[]}}});await tick();assert.equal(body.textContent,before);
});

test('Leaving while saving is blocked and failed edits require explicit discard',async t=>{
 const f=fixture(t);await tick();let reject;
 f.api.write=()=>new Promise((_,r)=>reject=r);f.click('Producten');f.click('Toevoegen');
 assert.equal(f.controller.beforeLeave(),false);assert.match(f.body.textContent,/Wacht tot/);
 reject(Object.assign(Error('Conflict'),{code:'list_conflict'}));await tick();
 assert.match(f.body.textContent,/ondertussen gewijzigd/);f.body.ownerDocument.defaultView.confirm=()=>false;
 assert.equal(f.controller.beforeLeave(),false);f.body.ownerDocument.defaultView.confirm=()=>true;assert.equal(f.controller.beforeLeave(),true);
});
