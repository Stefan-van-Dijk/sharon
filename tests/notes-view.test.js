import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {openShopPairing} from '../src/ui/ShopPairing.js';import {openNotesView} from '../src/ui/NotesView.js';
function fixture(t,online=true){
 const dom=new JSDOM('<main></main>',{url:'https://stefan-van-dijk.github.io/sharon/'});const prev={document:globalThis.document,window:globalThis.window,CustomEvent:globalThis.CustomEvent};Object.assign(globalThis,{document:dom.window.document,window:dom.window,CustomEvent:dom.window.CustomEvent});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 const records=new Map(),shares=[],metadata=new Map();const store={get:async(_,key)=>metadata.get(key),getAll:async()=>[...records.values()],put:async(table,r)=>(table==='meta'?metadata:records).set(table==='meta'?r.key:r.id,structuredClone(r))};
 const api={isConnected:async()=>online,index:async()=>{if(!online)throw Error('Offline');return {lists:[{id:'shared',name:'Weekend',role:'owner'}]};},read:async()=>({role:'owner',list:{members:{},payload:{products:[{id:'milk',name:'Melk'}],list:{items:[{productId:'milk',quantity:6,done:false}]}}}}),share:async(...args)=>shares.push(args),connection:{device:async()=>({personId:'me',registered:true,self:{line:1,name:'Test'}}),contacts:async()=>[{personId:'person',name:'Kim'}]}};
 t.after(()=>{document.querySelector('[data-share-close]')?.click();Object.assign(globalThis,prev);dom.window.close();});return {outlet:document.querySelector('main'),dom,records,store,api,shares,metadata};
}
const settle=()=>new Promise(r=>setTimeout(r,0));
test('Free text and ideas save without the network and survive reopening',async t=>{
 const f=fixture(t,false);let stop=await openNotesView(f.outlet,f);await settle();f.outlet.querySelector('button').click();
 document.querySelector('[aria-label="Titel"]').value='Idee voor later';document.querySelector('[aria-label="Soort"]').value='idea';document.querySelector('textarea').value='Vrije tekst\nTweede regel';
 [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Bewaren').click();await settle();assert.equal(f.records.size,1);assert.equal([...f.records.values()][0].data.body,'Vrije tekst\nTweede regel');stop();stop=await openNotesView(f.outlet,f);assert.match(f.outlet.textContent,/Idee voor later/);stop();
});
test('Linked list opens a branded board; right swipe opens sharing and only explicit save grants access',async t=>{
 const f=fixture(t);const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();const surface=f.outlet.querySelector('[data-swipe-surface]');surface.click();await settle();assert.equal(document.querySelector('.sh-notes-wordmark').textContent,'ShopList.');assert.match(document.querySelector('dialog').textContent,/Weekend.*Melk6 ×/s);document.querySelector('dialog').close();
 function pointer(type,x,y=20){const e=new f.dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});surface.dispatchEvent(e);}
 pointer('pointerdown',10);pointer('pointermove',85);pointer('pointerup',85);await settle();assert.equal(f.shares.length,0);const share=document.querySelector('.sh-list-share');assert.match(share.textContent,/Kim/);assert(share.querySelector('[data-deck-grab]'));share.querySelector('[data-swipe-surface]').click();assert.equal(f.shares.length,0);const select=share.querySelector('select[aria-label="Toegang"]');select.value='write';share.querySelector('[data-share-send]').click();await settle();assert.deepEqual(f.shares,[['shared','person','write']]);
});
test('Vertical scrolling does not share; leaving the module removes its board',async t=>{
 const f=fixture(t);const stop=await openNotesView(f.outlet,f);await settle();const surface=f.outlet.querySelector('[data-swipe-surface]');for(const [type,x,y]of [['pointerdown',10,10],['pointermove',15,90],['pointerup',15,90]]){const e=new f.dom.window.Event(type,{bubbles:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});surface.dispatchEvent(e);}assert.equal(document.querySelector('dialog'),null);surface.click();await settle();stop();assert.equal(document.querySelector('dialog'),null);
});
test('A checklist can be checked, edited and reopened with its progress retained',async t=>{
 const f=fixture(t,false);f.records.set('n',{id:'n',type:'note',name:'Inpakken',data:{kind:'list',body:'Paspoort',items:[{text:'Paspoort',done:false}]}});
 const stop=await openNotesView(f.outlet,f);t.after(stop);f.outlet.querySelector('[data-swipe-surface]').click();await settle();const check=document.querySelector('dialog input[type=checkbox]');check.checked=true;check.dispatchEvent(new f.dom.window.Event('change'));await settle();assert.equal(f.records.get('n').data.items[0].done,true);
 document.querySelector('dialog').close();f.outlet.querySelector('[data-swipe-edit]').click();[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Bewaren').click();await settle();assert.equal(f.records.get('n').data.items[0].done,true);
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
test('Pairing requires a matching explicit confirmation without sharing lists',async t=>{
 const f=fixture(t),calls=[];let phase='empty';
 f.api.connection.device=async()=>({deviceToken:'private'});
 f.api.connection.request=async(action,input)=>{calls.push({action,input});if(action==='shop-pair-list')return {devices:phase==='empty'?[]:[{id:'device',status:phase,fingerprint:'1234ABCD'}]};if(action==='shop-pair-create'){phase='pending';return {id:'device',code:'SP1.code'};}if(action==='shop-pair-confirm'){phase='active';return {ok:true};}if(action==='shop-pair-revoke'){phase='pending';return {ok:true};}};
 const stop=await openNotesView(f.outlet,f);t.after(stop);const closePair=openShopPairing(f.api.connection);t.after(closePair);await settle();
 const board=document.querySelector('dialog'),pill=board.querySelector('[data-deck-grab]');
 assert.equal(board.querySelectorAll('.sh-shop-access-content button').length,0);
 pill.click();await settle();
 assert.match(board.textContent,/Tijdelijke koppelcode: SP1.code/);
 assert.equal(calls.some(c=>c.action==='shop-pair-confirm'),false);
 Object.defineProperty(document,'hidden',{value:false,configurable:true});
 phase='claimed';document.dispatchEvent(new f.dom.window.Event('visibilitychange'));await settle();
 assert.match(board.textContent,/1234ABCD/);
 assert.equal(pill.textContent,'Bevestig koppeling');
 pill.click();await settle();
 assert.deepEqual(calls.find(c=>c.action==='shop-pair-confirm').input,{id:'device',fingerprint:'1234ABCD'});
 assert.equal(f.shares.length,0);closePair();stop();assert.equal(document.querySelector('dialog'),null);
});
test('Compact pairing shows success only after Shop acknowledgement and refreshes on return',async t=>{
 const f=fixture(t);let phase='empty';const calls=[];
 Object.defineProperty(document,'hidden',{value:false,configurable:true});
 f.api.connection.device=async()=>({});f.api.connection.request=async(action,input)=>{calls.push(action);if(action==='shop-pair-create'){phase='pending';return {id:'device',code:'abcdefghijkl',expiresAt:Date.now()+604800000};}return {devices:phase==='empty'?[]:[{id:'device',compact:true,status:phase,fingerprint:'1234ABCD'}]};};
 const stop=await openNotesView(f.outlet,f);const closePair=openShopPairing(f.api.connection);t.after(closePair);await settle();document.querySelector('dialog [data-deck-grab]').click();await settle();assert.match(document.querySelector('dialog').textContent,/Tijdelijke koppelcode: abcdefghijkl/);
 phase='ready';document.dispatchEvent(new f.dom.window.Event('visibilitychange'));await settle();assert.match(document.querySelector('dialog').textContent,/rondt het opslaan/);assert.doesNotMatch(document.querySelector('dialog').textContent,/Shop verbonden/);
 phase='active';document.dispatchEvent(new f.dom.window.Event('visibilitychange'));await settle();assert.match(document.querySelector('dialog').textContent,/Koppeling geslaagd/);assert.doesNotMatch(document.querySelector('dialog').textContent,/abcdefghijkl/);assert.equal(calls.includes('shop-pair-confirm'),false);closePair();stop();const n=calls.length;document.dispatchEvent(new f.dom.window.Event('visibilitychange'));await settle();assert.equal(calls.length,n);
});

test('Notes only shows items; archive recovery follows every item and restores a local item',async t=>{
 const f=fixture(t);f.records.set('old',{id:'old',type:'note',name:'Oud idee',archivedAt:123,data:{kind:'idea',body:'Bewaren'}});
 const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();
 assert.equal(f.outlet.querySelector('[data-notes-mode]'),null);assert.equal(f.outlet.querySelector('.sh-app-connection'),null);
 const slot=f.outlet.querySelector('.sh-notes-archive-slot');assert.equal(slot.hidden,false);
 assert.equal(slot.previousElementSibling,f.outlet.querySelector('.swipe-list'));
 f.outlet.querySelector('[data-notes-archive]').click();assert.match(f.outlet.querySelector('.swipe-list').textContent,/Oud idee/);
 f.outlet.querySelector('[data-swipe-surface]').click();[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Terugzetten').click();await settle();
 assert.equal(f.records.get('old').archivedAt,null);assert.equal(slot.hidden,true);assert.match(f.outlet.querySelector('.swipe-list').textContent,/Oud idee/);assert.equal(document.querySelector('dialog'),null);
});
test('An empty archive has no recovery strip',async t=>{
 const f=fixture(t);const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();
 const slot=f.outlet.querySelector('.sh-notes-archive-slot');assert.equal(slot.hidden,true);assert.equal(slot.classList.contains('is-revealed'),false);
});
test('Linked archived list is restored through its server membership',async t=>{
 const f=fixture(t);let archived=true;f.api.index=async()=>({lists:[{id:'shared',name:'Weekend',archived}]});f.api.archive=async(id,value)=>{assert.equal(id,'shared');archived=value;};
 const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();f.outlet.querySelector('[data-notes-archive]').click();f.outlet.querySelector('[data-swipe-surface]').click();
 [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Terugzetten').click();await settle();assert.equal(archived,false);assert.match(f.outlet.querySelector('.swipe-list').textContent,/Weekend/);
});
test('Linked archive and removal act on membership and refresh the overview',async t=>{
 const f=fixture(t);let archived=false,removed=false;f.api.index=async()=>({lists:removed?[]:[{id:'shared',name:'Weekend',role:'read',archived}]});f.api.archive=async(id,value)=>{assert.equal(id,'shared');archived=value;};f.api.leave=async id=>{assert.equal(id,'shared');removed=true;};const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();
 swipe(f,f.outlet.querySelector('[data-swipe-surface]'),-100,0);assert(f.outlet.querySelector('.is-actions-open'));
 f.outlet.querySelector('[data-swipe-secondary]').click();await settle();assert.equal(archived,true);assert.equal(f.outlet.querySelector('[data-swipe-row="linked:shared"]'),null);assert.ok(f.outlet.querySelector('[data-swipe-row="shop:catalog"]'));
 f.outlet.querySelector('[data-notes-archive]').click();swipe(f,f.outlet.querySelector('[data-swipe-surface]'),-100,0);
 f.outlet.querySelector('[data-swipe-delete]').click();[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Verwijderen').click();await settle();assert.equal(removed,true);assert.equal(f.records.size,0);assert.equal(f.outlet.querySelector('[data-swipe-row="linked:shared"]'),null);assert.ok(f.outlet.querySelector('[data-swipe-row="shop:catalog"]'));
});

function swipe(f,target,dx,dy,cancel=false){
 for(const [type,x,y] of [['pointerdown',100,10],['pointermove',100+dx,10+dy],[cancel?'pointercancel':'pointerup',100+dx,10+dy]]){
 const e=new f.dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});target.dispatchEvent(e);
 }
}
test('List board closes only on completed top pull-down and links to its selected list in ShopList',async t=>{
 const f=fixture(t);const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();
 f.outlet.querySelector('[data-swipe-surface]').click();await settle();const dialog=document.querySelector('dialog'),top=dialog.querySelector('header');
 assert.equal(dialog.querySelector('.sh-notes-app-source').tagName,'BUTTON');
 assert.equal(dialog.querySelector('a[target="_blank"]'),null);
 swipe(f,dialog.querySelector('.sh-notes-body'),0,100);assert(dialog.isConnected);
 swipe(f,top,0,100,true);assert(dialog.isConnected);
 swipe(f,top,0,100);assert.equal(dialog.isConnected,false);
});

test('Selected list and its app icon fetch only that list inside Sharon, including on reopen',async t=>{
 const f=fixture(t),calls=[];let resolveOld;
 f.api.index=async()=>({lists:[{id:'a',name:'Alpha',role:'owner'},{id:'b',name:'Beta',role:'owner'}]});
 const result=(id,text)=>({role:'owner',list:{payload:{list:{id,name:text,items:[]},products:[]}}});
 f.api.read=id=>{calls.push(id);if(calls.length===1)return new Promise(resolve=>resolveOld=resolve);return Promise.resolve(result(id,'Verse '+id));};
 const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();assert.deepEqual(calls,[]);
 f.outlet.querySelector('[data-swipe-row="linked:a"] [data-swipe-surface]').click();await settle();
 f.outlet.querySelector('[data-swipe-row="linked:b"] [data-swipe-surface]').click();await settle();
 resolveOld(result('a','Oude Alpha'));await settle();
 assert.equal(document.querySelectorAll('dialog').length,1);assert.equal(document.querySelector('dialog h2').textContent,'Verse b');
 document.querySelector('.sh-notes-app-source').click();await settle();
 assert.deepEqual(calls,['a','b']);
 const frame=document.querySelector('iframe.sh-shop-app');assert.equal(new URL(frame.src).searchParams.get('shoplist'),'b');
 assert.equal(new URL(frame.src).searchParams.get('from'),'sharon');
 assert.equal(document.querySelector('.sh-shop-panel'),null);
});

test('Preview CTA opens the selected list in the remembered mode',async t=>{
 const f=fixture(t);f.metadata.set('shop.view.shared',{value:'check'});
 const stop=await openNotesView(f.outlet,f);t.after(stop);await settle();f.outlet.querySelector('[data-swipe-surface]').click();await settle();
 assert.equal(document.querySelector('[data-notes-fullscreen]').hidden,true);
 const cta=document.querySelector('.sh-shop-preview-open');assert.equal(cta.textContent,'Verder met afstrepen');cta.click();await settle();
 const url=new URL(document.querySelector('iframe').src);assert.equal(url.searchParams.get('shoplist'),'shared');assert.equal(url.searchParams.get('view'),'check');
});

test('Untethered ShopList data stays hidden, including the archive',async t=>{
 const f=fixture(t);
 let connected=true, reads=0;
 f.api.isConnected=async()=>connected;
 const index=f.api.index;
 f.api.index=async()=>{reads++;return index();};
 let stop=await openNotesView(f.outlet,f);
 t.after(()=>stop());
 const catalog=()=>f.outlet.querySelector('[data-swipe-row="shop:catalog"]');
 await settle();
 assert(catalog());
 assert(f.outlet.querySelector('[data-swipe-row="linked:shared"]'));
 catalog().querySelector('[data-swipe-secondary]').click();
 await settle();
 connected=false;
 stop();stop=await openNotesView(f.outlet,f);
 await settle();
 assert.equal(reads,1);
 assert.equal(catalog(),null);
 assert.equal(f.outlet.querySelector('[data-swipe-row="linked:shared"]'),null);
 assert.equal(f.outlet.querySelector('[data-notes-archive]').parentElement.hidden,true);
 connected=true;
 stop();stop=await openNotesView(f.outlet,f);
 await settle();
 f.outlet.querySelector('[data-notes-archive]').click();
 assert(catalog());
});
