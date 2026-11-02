import test from 'node:test';
import assert from 'node:assert/strict';
import {appHarness,until} from '../helpers/app-harness.mjs';

function pointer(app,handle,type,y) {
  const event=new app.window.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:1,pointerType:'touch',button:0,clientY:y,clientX:300});
  handle.dispatchEvent(event);
}
function geometry(app) {
  app.document.querySelectorAll('[data-list-drag]').forEach((handle,index)=>{
    handle.closest('[data-list-item],[data-node]').getBoundingClientRect=()=>({top:100+index*80,bottom:180+index*80,height:80,left:0,right:350,width:350});
  });
}
test('handgreep sleept een kaart naar boven, slaat op en opent geen pasboard',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  for(const [id,name] of [['DragCard0001','Alpha'],['DragCard0002','Beta'],['DragCard0003','Charlie']])await app.store.put('objects',{id,type:'card',name});
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[data-list-sort="custom"]'))).click();
  const handle=await until(()=>app.document.querySelector('[data-list-drag="DragCard0003"]'));
  assert.equal(app.document.querySelector('[data-list-move]'),null);
  geometry(app);
  pointer(app,handle,'pointerdown',300);pointer(app,handle,'pointermove',110);
  assert.ok(app.document.querySelector('.is-order-dragging'));
  assert.ok(app.document.querySelector('.is-order-before'));
  pointer(app,handle,'pointerup',110);
  await until(()=>app.document.querySelector('[data-card-list] [data-swipe-row]')?.dataset.swipeRow==='DragCard0003');
  assert.deepEqual(JSON.parse(JSON.stringify((await app.store.get('meta','cards.list.preferences')).value.order)),['DragCard0003','DragCard0001','DragCard0002']);
  assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
  assert.equal(app.document.querySelector('.is-order-dragging'),null);
  geometry(app);
  const cancel=app.document.querySelector('[data-list-drag="DragCard0001"]');
  pointer(app,cancel,'pointerdown',220);pointer(app,cancel,'pointermove',100);pointer(app,cancel,'pointercancel',100);
  assert.equal(app.document.querySelector('.is-order-dragging'),null);
  assert.equal(app.document.querySelector('[data-card-list] [data-swipe-row]').dataset.swipeRow,'DragCard0003');
  assert.deepEqual(app.errors,[]);
});

test('sublocatie kan alleen naar een plek binnen dezelfde hoofdlocatie worden gesleept',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  for(const [id,title,parentId] of [['DragParent01','Centrum',''],['DragChild001','Alpha','DragParent01'],['DragChild002','Beta','DragParent01'],['DragParent02','Werk','']])await app.store.put('objects',{id,type:'location',data:{title,parentId}});
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="locations"]'))).click();
  (await until(()=>app.document.querySelector('[data-list-sort="custom"]'))).click();
  const handle=await until(()=>app.document.querySelector('[data-list-drag="DragChild002"]'));geometry(app);
  const first=app.document.querySelector('[data-list-drag="DragChild001"]').closest('[data-node]').getBoundingClientRect();
  pointer(app,handle,'pointerdown',first.top+120);pointer(app,handle,'pointermove',first.top+5);
  const target=app.document.querySelector('.is-order-before');
  assert.equal(target?.dataset.node,'DragChild001');
  pointer(app,handle,'pointerup',first.top+5);
  await until(async()=>{
    const order=(await app.store.get('meta','locations.preferences'))?.value.order||[];
    return order.indexOf('DragChild002')<order.indexOf('DragChild001');
  });
  assert.equal((await app.store.get('objects','DragChild002')).data.parentId,'DragParent01');
  assert.deepEqual(app.errors,[]);
});
