import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createDemoWorkspaceStore} from '../src/core/skeleton/DemoWorkspaceStore.js';
import {demoDataset,SKELETON_DEMO_KEY,SKELETON_DEMO_DATA_KEY} from '../src/core/skeleton/SkeletonCore.js';
import {openCardsView} from '../src/ui/CardsView.js';
import {openLocationsView} from '../src/ui/LocationsView.js';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(t){
 const dom=new JSDOM('<main></main>',{url:'https://sharon.test/'}),previous={document:globalThis.document,window:globalThis.window,confirm:globalThis.confirm,CustomEvent:globalThis.CustomEvent};
 Object.assign(globalThis,{document:dom.window.document,window:dom.window,confirm:()=>true,CustomEvent:dom.window.CustomEvent});
 const data=demoDataset();data.objects.push({id:'LooseCard001',module:'cards',title:'Losse kaart',status:'active',fields:{}});
 const rows=new Map([[SKELETON_DEMO_KEY,{value:true}],[SKELETON_DEMO_DATA_KEY,{value:data}]]);
 const base={get:async(_,key)=>structuredClone(rows.get(key)),put:async(_,row)=>rows.set(row.key,structuredClone(row)),delete:async(_,key)=>rows.delete(key)};
 const store=createDemoWorkspaceStore(base),root=document.querySelector('main');
 t.after(()=>{dom.window.close();Object.assign(globalThis,previous);});
 return {store,root,rows,dom};
}
test('Linked cards explicitly archive, recover below the list, and preserve relations while loose cards delete',async t=>{
 const f=fixture(t),events={emit(){}};const close=await openCardsView(f.root,{store:f.store,location:{latest:null},events});
 const linked=f.root.querySelector('[data-swipe-row="DemoCard0001"]');assert.equal(linked.querySelector('[data-swipe-secondary]').textContent,'Archiveren');assert.equal(linked.querySelector('[data-swipe-delete]'),null);
 assert.equal(f.root.querySelector('[data-swipe-row="LooseCard001"] [data-swipe-delete]').textContent,'Verwijder');
 const before=structuredClone(f.rows.get(SKELETON_DEMO_DATA_KEY).value.relations);
 linked.querySelector('[data-swipe-secondary]').click();await settle();await settle();
 const archive=f.root.querySelector('[data-card-archive]');assert(archive);assert.equal(archive.previousElementSibling.dataset.cardList,'');assert.equal(f.root.querySelector('[data-card-list] [data-swipe-row="DemoCard0001"]'),null);
 archive.querySelector('[data-card-restore]').click();await settle();await settle();assert(f.root.querySelector('[data-swipe-row="DemoCard0001"]'));assert.equal(f.root.querySelector('[data-card-archive]'),null);assert.deepEqual(f.rows.get(SKELETON_DEMO_DATA_KEY).value.relations,before);
 f.root.querySelector('[data-swipe-row="LooseCard001"] [data-swipe-delete]').click();await settle();await settle();assert.equal(await f.store.get('objects','LooseCard001'),undefined);close();
});
test('Archived linked locations can be restored from the bottom of Locations without changing graph relations',async t=>{
 const f=fixture(t),events={emit(){}};const close=await openLocationsView(f.root,{store:f.store,location:{latest:null},events});
 const before=structuredClone(f.rows.get(SKELETON_DEMO_DATA_KEY).value.relations),row=f.root.querySelector('[data-swipe-row="DemoPlace001"]');assert.equal(row.querySelector('[data-swipe-delete]'),null);assert.equal(row.querySelector('[data-swipe-secondary]').textContent,'Archiveren');
 row.querySelector('[data-swipe-secondary]').click();await settle();await settle();const archive=f.root.querySelector('[data-location-archive]');assert(archive);assert(archive.previousElementSibling.matches('[data-swipe-list]'));
 archive.querySelector('[data-location-restore]').click();await settle();await settle();assert(f.root.querySelector('[data-swipe-row="DemoPlace001"]'));assert.equal(f.root.querySelector('[data-location-archive]'),null);assert.deepEqual(f.rows.get(SKELETON_DEMO_DATA_KEY).value.relations,before);close();
});
test('A parent location remains active while a visible sublocation inherits its position',async t=>{
 const f=fixture(t);const parent=await f.store.get('objects','DemoPlace001');parent.data.coordinates={lat:52,lng:5};await f.store.put('objects',parent);
 await f.store.put('objects',{id:'ChildPlace01',type:'location',data:{title:'Afdeling',parentId:parent.id}});
 const close=await openLocationsView(f.root,{store:f.store,location:{latest:null},events:{emit(){}}});
 f.root.querySelector('[data-swipe-row="DemoPlace001"] [data-swipe-secondary]').click();await settle();await settle();
 assert.equal((await f.store.get('objects','DemoPlace001')).archivedAt,null);assert(f.root.querySelector('[data-swipe-row="ChildPlace01"]'));assert.match(f.root.querySelector('[data-list-status]').textContent,/onderliggende locaties/);close();
});
