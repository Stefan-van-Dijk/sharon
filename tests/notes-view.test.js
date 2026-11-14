import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {openNotesView} from '../src/ui/NotesView.js';
function fixture(t,online=true){
 const dom=new JSDOM('<main></main>',{url:'https://stefan-van-dijk.github.io/sharon/'});const prev={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent};Object.assign(globalThis,{document:dom.window.document,window:dom.window,CustomEvent:dom.window.CustomEvent});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 const records=new Map(),shares=[],metadata=new Map();const store={get:async(_,key)=>metadata.get(key),getAll:async()=>[...records.values()],put:async(table,r)=>(table==='meta'?metadata:records).set(table==='meta'?r.key:r.id,structuredClone(r))};
 const api={index:async()=>{if(!online)throw Error('Offline');return {lists:[{id:'shared',name:'Weekend',role:'owner'}]};},read:async()=>({role:'owner',list:{members:{},payload:{products:[{id:'milk',name:'Melk'}],list:{items:[{productId:'milk',quantity:6,done:false}]}}}}),share:async(...args)=>shares.push(args),connection:{contacts:async()=>[{personId:'person',name:'Kim'}]}};
 t.after(()=>{document.querySelector('[data-share-close]')?.click();Object.assign(globalThis,prev);dom.window.close();});return {outlet:document.querySelector('main'),dom,records,store,api,shares,metadata};
}
const settle=()=>new Promise(r=>setTimeout(r,0));
test('Free text and ideas save without the network and survive reopening',async t=>{
 const f=fixture(t,false);let stop=await openNotesView(f.outlet,f);await settle();f.outlet.querySelector('button').click();
 document.querySelector('[aria-label="Titel"]').value='Idee voor later';document.querySelector('[aria-label="Soort"]').value='idea';document.querySelector('textarea').value='Vrije tekst\nTweede regel';
 [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Bewaren').click();await settle();assert.equal(f.records.size,1);assert.equal([...f.records.values()][0].data.body,'Vrije tekst\nTweede regel');stop();stop=await openNotesView(f.outlet,f);assert.match(f.outlet.textContent,/Idee voor later/);stop();
});
test('Linked list opens a branded board; right swipe opens sharing and only explicit save grants access',async t=>{
 const f=fixture(t);const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();const surface=f.outlet.querySelector('[data-swipe-surface]');surface.click();await settle();assert.equal(document.querySelector('.sh-notes-wordmark').textContent,'ShopList.');assert.match(document.querySelector('dialog').textContent,/Weekend.*6 × Melk/s);document.querySelector('dialog').close();
 function pointer(type,x,y=20){const e=new f.dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});surface.dispatchEvent(e);}
 pointer('pointerdown',10);pointer('pointermove',85);pointer('pointerup',85);await settle();assert.equal(f.shares.length,0);const share=document.querySelector('.sh-list-share');assert.match(share.textContent,/Kim/);assert(share.querySelector('[data-deck-grab]'));share.querySelector('[data-swipe-surface]').click();assert.equal(f.shares.length,0);const select=share.querySelector('select');select.value='write';share.querySelector('[data-share-send]').click();await settle();assert.deepEqual(f.shares,[['shared','person','write']]);
});
test('Vertical scrolling does not share; leaving the module removes its board',async t=>{
 const f=fixture(t);const stop=await openNotesView(f.outlet,f);await settle();const surface=f.outlet.querySelector('[data-swipe-surface]');for(const [type,x,y]of [['pointerdown',10,10],['pointermove',15,90],['pointerup',15,90]]){const e=new f.dom.window.Event(type,{bubbles:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});surface.dispatchEvent(e);}assert.equal(document.querySelector('dialog'),null);surface.click();await settle();stop();assert.equal(document.querySelector('dialog'),null);
});
test('A checklist can be checked, edited and reopened with its progress retained',async t=>{
 const f=fixture(t,false);f.records.set('n',{id:'n',type:'note',name:'Inpakken',data:{kind:'list',body:'Paspoort',items:[{text:'Paspoort',done:false}]}});
 const stop=await openNotesView(f.outlet,f);t.after(stop);f.outlet.querySelector('[data-swipe-surface]').click();await settle();const check=document.querySelector('dialog input[type=checkbox]');check.checked=true;check.dispatchEvent(new f.dom.window.Event('change'));await settle();assert.equal(f.records.get('n').data.items[0].done,true);
 [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Bewerken').click();[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Bewaren').click();await settle();assert.equal(f.records.get('n').data.items[0].done,true);
});
test('Read-only linked lists cannot expose owner sharing controls',async t=>{
 const f=fixture(t);f.api.index=async()=>({lists:[{id:'shared',name:'Weekend',role:'read'}]});const original=f.api.read;f.api.read=async id=>({...await original(id),role:'read'});const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();assert.equal(f.outlet.querySelector('[data-shareable]'),null);f.outlet.querySelector('[data-swipe-surface]').click();await settle();assert.equal([...document.querySelectorAll('dialog button')].some(b=>b.textContent==='Delen'),false);
});

test('Shared list controls search and persist sorting independently of Cards',async t=>{
 const f=fixture(t,false);f.records.set('a',{id:'a',type:'note',name:'Alpha',updatedAt:1,data:{kind:'note',body:'Find me'}});f.records.set('z',{id:'z',type:'note',name:'Zulu',updatedAt:2,data:{kind:'idea',body:''}});
 let stop=await openNotesView(f.outlet,f);f.outlet.querySelector('[data-list-sort="recent"]').click();await settle();assert.equal(f.outlet.querySelector('[data-swipe-surface] strong').textContent,'Zulu');
 const input=f.outlet.querySelector('[data-list-search]');input.value='Find me';input.dispatchEvent(new f.dom.window.Event('input'));assert.equal(f.outlet.querySelectorAll('[data-swipe-surface]').length,1);assert.equal(f.outlet.querySelector('[data-swipe-surface] strong').textContent,'Alpha');
 stop();stop=await openNotesView(f.outlet,f);t.after(stop);assert.equal(f.outlet.querySelector('[data-list-sort="recent"]').getAttribute('aria-pressed'),'true');assert.equal(f.metadata.has('cards.list.preferences'),false);
});
test('List sharing preserves failed selections and closes cleanly',async t=>{
 const f=fixture(t);f.api.connection.contacts=async()=>[{personId:'one',name:'One'},{personId:'two',name:'Two'}];let fail=true;f.api.share=async(...args)=>{if(args[1]==='two'&&fail)throw Error('Offline');f.shares.push(args);};
 const {openListShare}=await import('../src/ui/ListSharing.js');const close=openListShare({id:'shared',name:'Weekend'},f);await settle();const panel=document.querySelector('.sh-list-share');panel.querySelectorAll('[data-swipe-surface]').forEach(b=>b.click());panel.querySelector('[data-share-send]').click();await settle();assert.deepEqual(f.shares,[['shared','one','read']]);assert.equal(panel.querySelectorAll('[data-swipe-surface][aria-pressed="true"]').length,1);assert.match(panel.textContent,/Offline/);fail=false;panel.querySelector('[data-share-send]').click();await settle();assert.deepEqual(f.shares,[['shared','one','read'],['shared','two','read']]);close();assert.equal(document.querySelector('.sh-card-share-overlay'),null);
});
