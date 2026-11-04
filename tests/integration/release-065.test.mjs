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
