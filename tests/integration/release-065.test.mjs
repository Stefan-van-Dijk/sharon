import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness} from '../helpers/app-harness.mjs';
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
