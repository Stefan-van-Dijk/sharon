import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {appHarness,until} from '../helpers/app-harness.mjs';
for(const chosen of [[],['environment','locations'],['environment','locations','cards'],['environment','locations','cards','notes']])test('Home invitation threshold and icons for '+chosen.length+' selected modules',async t=>{
 const app=await appHarness({root:resolve('.')});t.after(()=>app.close());
 const settings=await app.store.get('settings','app');settings.value.home={modules:chosen};await app.store.put('settings',settings);
 await app.boot();await until(()=>app.document.querySelector('[data-home-manage]'));
 assert.deepEqual([...app.document.querySelectorAll('.module-list [data-module]')].map(el=>el.dataset.module),chosen);
 assert.equal(!!app.document.querySelector('[data-home-invitation]'),chosen.length<4);
 for(const row of app.document.querySelectorAll('.module-list .module-row'))assert(row.querySelector('svg'));
 const controls=app.document.querySelector('[data-header-actions]');assert.equal(controls.children[0].dataset.homeBoardStack,'');assert.equal(controls.children[1].dataset.homeManage,'');assert.equal(controls.children[1].textContent.trim(),'');
 if(chosen.length<4)assert.match(app.document.querySelector('[data-home-invitation-text]').textContent,/Maak Sharon van jou/);
 assert.deepEqual(app.errors,[]);
});
test('Manage Home enables, orders and hides modules without touching objects, including after reopening',async t=>{
 const app=await appHarness({root:resolve('.')});t.after(()=>app.close());
 const saved=await app.store.get('settings','app');saved.value.home={modules:['environment','locations']};await app.store.put('settings',saved);
 const objects=JSON.stringify(await app.store.getAll('objects'));
 await app.boot();(await until(()=>app.document.querySelector('[data-home-manage]'))).click();
 const toggle=await until(()=>app.document.querySelector('[data-module-choice="cards"] [role=switch]'));toggle.click();
 await until(async()=> (await app.store.get('settings','app')).value.home.modules.includes('cards'));
 app.document.querySelector('[data-brand-control]').click();await until(()=>app.document.querySelector('[data-module="cards"]'));
 assert.equal(JSON.stringify(await app.store.getAll('objects')),objects);
 app.document.querySelector('[data-home-manage]').click();await until(()=>app.document.querySelector('[data-module-choice="cards"] [role=switch]'));
 assert.equal(app.document.querySelector('[data-module-choice="cards"] [role=switch]').getAttribute('aria-checked'),'true');assert.deepEqual(app.errors,[]);
});
test('Demo management cannot change live Home preferences or link a real app',async t=>{
 const app=await appHarness({root:resolve('.'),demo:true});t.after(()=>app.close());await app.boot();
 const before=JSON.stringify(await app.store.get('settings','app'));
 (await until(()=>app.document.querySelector('[data-home-manage]'))).click();
 await until(()=>app.document.querySelector('[data-view-outlet]').textContent.includes('gewone omgeving'));
 assert.equal(app.document.querySelector('[data-module-choice]'),null);assert.equal(app.document.querySelector('[data-app-connection]'),null);assert.equal(JSON.stringify(await app.store.get('settings','app')),before);
});
test('A completed delayed save updates Home after leaving management; Apps participates in navigation history',async t=>{
 const app=await appHarness({root:resolve('.')});t.after(()=>app.close());const saved=await app.store.get('settings','app');saved.value.home={modules:['environment','locations']};await app.store.put('settings',saved);
 await app.boot();(await until(()=>app.document.querySelector('[data-home-manage]'))).click();
 await until(()=>app.document.querySelector('[data-module-choice="cards"]'));assert.equal(app.window.history.state.__sharonNavigation,'apps');
 const {ObjectStore}=await app.load('./src/core/storage/ObjectStore.js?v=0.5.09');const original=ObjectStore.prototype.put;let finish;
 ObjectStore.prototype.put=async function(name,record){if(name==='settings')await new Promise(resolve=>finish=resolve);return original.call(this,name,record);};
 app.document.querySelector('[data-module-choice="cards"] [role=switch]').click();await until(()=>finish);app.document.querySelector('[data-brand-control]').click();await until(()=>app.document.querySelector('[data-home-manage]'));assert.equal(app.document.querySelector('[data-module="cards"]'),null);
 finish();await until(()=>app.document.querySelector('[data-module="cards"]'));ObjectStore.prototype.put=original;
 app.window.dispatchEvent(new app.window.PopStateEvent('popstate',{state:{__sharonNavigation:'apps'}}));await until(()=>app.document.querySelector('[data-module-choice="cards"]'));assert.deepEqual(app.errors,[]);
});

test('Repeated returns to Home consume the module history entry instead of leaving extra back steps',async t=>{
 const app=await appHarness({root:resolve('.')});t.after(()=>app.close());await app.boot();
 const history=app.window.history,initialLength=history.length;
 for(let i=0;i<3;i++){
  (await until(()=>app.document.querySelector('[data-home-manage]'))).click();
  await until(()=>app.document.querySelector('[data-module-choice]'));
  assert.equal(history.state.__sharonNavigation,'apps');
  if(i===1){
   const stage=app.document.querySelector('.app-stage');
   for(const [type,x] of [['touchstart',5],['touchmove',300],['touchend',300]]){
    const event=new app.window.Event(type,{bubbles:true,cancelable:true}),point={clientX:x,clientY:220};
    Object.assign(event,{touches:type==='touchend'?[]:[point],changedTouches:[point]});stage.dispatchEvent(event);
   }
  }else app.document.querySelector('[data-brand-control]').click();
  await until(()=>app.document.querySelector('[data-home-manage]'));
  assert.equal(history.state.__sharonNavigation,'home');
  assert.equal(history.length,initialLength+1);
  // Let the completed swipe's synthetic-click suppression expire before the next tap.
  if(i===1)await new Promise(resolve=>setTimeout(resolve,450));
 }
 history.forward();await until(()=>app.document.querySelector('[data-module-choice]'));
 assert.equal(history.state.__sharonNavigation,'apps');
 history.back();await until(()=>app.document.querySelector('[data-home-manage]'));
 assert.equal(history.state.__sharonNavigation,'home');assert.deepEqual(app.errors,[]);
});
