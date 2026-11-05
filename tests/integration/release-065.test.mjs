import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;

test('shop menu opened before renderer readiness remembers enabled state',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  const {openEnvironmentView}=await app.load('./src/ui/EnvironmentMapLibre.js?v='+version);
  const root=app.document.createElement('main');app.document.body.append(root);
  const stop=openEnvironmentView(root,{store:app.store,location:{latest:null},events:{on:()=>()=>{}},loadRenderer:()=>new Promise(()=>{})});
  t.after(stop);
  const toggle=root.querySelector('[data-chain-toggle]');
  toggle.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  assert.equal(toggle.getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelector('[data-places-sheet]').getAttribute('aria-hidden'),'false');
  const category=root.querySelector('[data-chain-category="groceries"]');
  assert.ok(category,'categories are available while the map is pending');
  category.click();
  assert.equal(category.getAttribute('aria-pressed'),'true');
  assert.deepEqual(JSON.parse(app.window.localStorage.getItem('sharon.source.chains.filters.v1')).categories,['groceries']);
});

test('rotation preference persists through settings reopen without changing personal data',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  const {SettingsService}=await app.load('./src/core/settings/SettingsService.js?v='+version);
  const events={emit(){}};
  const before=JSON.stringify(await app.store.getAll('objects'));
  const settings=new SettingsService(app.store,events);await settings.load();
  assert.equal(settings.get().mapDisplay.allowRotation,false);
  await settings.update({mapDisplay:{allowRotation:true}});
  const reopened=new SettingsService(app.store,events);await reopened.load();
  assert.equal(reopened.get().mapDisplay.allowRotation,true);
  assert.equal(JSON.stringify(await app.store.getAll('objects')),before);
});

test('environment shop touch handles taps without click and swipe without toggling',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  const {openEnvironmentView}=await app.load('./src/ui/EnvironmentMapLibre.js?v='+version);
  const root=app.document.createElement('main');app.document.body.append(root);
  const stop=openEnvironmentView(root,{store:app.store,location:{latest:null},events:{on:()=>()=>{}},loadRenderer:()=>new Promise(()=>{})});t.after(stop);
  const button=root.querySelector('[data-chain-toggle]');
  const touch=(type,x,y)=>{const e=new app.window.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{touches:{value:type==='touchstart'?[{clientX:x,clientY:y}]:[]},changedTouches:{value:[{clientX:x,clientY:y}]}});button.dispatchEvent(e);};
  touch('touchstart',100,100);touch('touchend',100,100);
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelector('[data-places-sheet]').getAttribute('aria-hidden'),'true');
  button.dispatchEvent(new app.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
  assert.equal(button.getAttribute('aria-pressed'),'true','a touch-generated click must not toggle twice');
  touch('touchstart',100,100);touch('touchend',100,100);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  touch('touchstart',100,100);touch('touchend',100,50);
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelector('[data-places-sheet]').getAttribute('aria-hidden'),'false');
});

test('shop filters remain usable and explain a failed map',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  const {openEnvironmentView}=await app.load('./src/ui/EnvironmentMapLibre.js?v='+version);
  const root=app.document.createElement('main');app.document.body.append(root);
  const stop=openEnvironmentView(root,{store:app.store,location:{latest:null},events:{on:()=>()=>{}},loadRenderer:()=>Promise.reject(new Error('renderer failed'))});t.after(stop);
  await new Promise(resolve=>setTimeout(resolve,20));
  root.querySelector('[data-chain-toggle]').dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  assert.match(root.querySelector('[data-chain-status]').textContent,/kaart niet kon starten/);
  const category=root.querySelector('[data-chain-category="groceries"]');category.click();
  assert.equal(category.getAttribute('aria-pressed'),'true');
});

test('a shop-layer initialization error stays visible and does not prevent Wikipedia setup',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  await app.store.put('objects',{id:'PersonTest01',type:'person',data:{name:'Testpersoon',locationId:'TestPlace001'}});
  const savedObjects=JSON.stringify(await app.store.getAll('objects'));
  const {openEnvironmentView}=await app.load('./src/ui/EnvironmentMapLibre.js?v='+version);
  const root=app.document.createElement('main');app.document.body.append(root);
  let map;
  class FakeMap {
    constructor(options){map=this;this.container=options.container;this.sources=new Map();this.layers=new Map();this.handlers=new Map();
      this.touchZoomRotate={enable(){},disableRotation(){}};this.dragPan={enable(){}};this.doubleClickZoom={disable(){}};
      this.scrollZoom={setZoomRate(){},setWheelZoomRate(){}};this.keyboard={disableRotation(){}};}
    on(name,...args){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(args.at(-1));}
    off(name,...args){this.handlers.get(name)?.delete(args.at(-1));}
    emit(name){for(const fn of this.handlers.get(name)||[])fn();}
    addSource(id,options){if(id==='sharon-chain-branches')throw Error('shop layer failed');this.sources.set(id,{setData(){},...options});}
    addLayer(layer){this.layers.set(layer.id,layer);}
    getSource(id){return this.sources.get(id);} getLayer(id){return this.layers.get(id);}
    addControl(){} setBearing(){} getZoom(){return 14;} getCenter(){return {lat:52,lng:5};}
    getContainer(){return this.container;} getCanvas(){return this.container;} getMinZoom(){return 1;} getMaxZoom(){return 22;}
    getBounds(){return {getWest:()=>4.99,getEast:()=>5.01,getSouth:()=>51.99,getNorth:()=>52.01};}
    isStyleLoaded(){return true;} setPaintProperty(){} setLayoutProperty(){} setFilter(){} triggerRepaint(){} resize(){} remove(){}
  }
  const events={on:()=>()=>{},emit(){}};
  const stop=openEnvironmentView(root,{store:app.store,location:{latest:{lat:52,lng:5}},events,loadRenderer:async()=>({Map:FakeMap})});t.after(stop);
  await until(()=>map?.handlers.has('load'),'the environment must attach its map load handler');
  map.emit('load');
  const shop=root.querySelector('[data-chain-toggle]');shop.click();
  assert.equal(shop.getAttribute('aria-pressed'),'false','failed source must not appear enabled');
  assert.match(root.querySelector('[data-shop-inline-status]').textContent,/Winkels.*niet.*starten/i);
  root.querySelector('[data-wikipedia-toggle]').click();
  assert.ok(map.getSource('sharon-wikipedia'),'Wikipedia is still initialized when the shop source fails');
  assert.equal(JSON.stringify(await app.store.getAll('objects')),savedObjects,'personal objects and links stay intact');
});
