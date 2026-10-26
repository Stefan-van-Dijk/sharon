import test from 'node:test';
import assert from 'node:assert/strict';
import { appHarness, until, dismissCardBoard } from '../helpers/app-harness.mjs';

test('reeds wachtende update wordt na de intro getoond zonder herladen', async t => {
  const app = await appHarness(); t.after(() => app.close());
  let updates=0;
  const registration = { waiting:{}, installing:null, addEventListener(){}, async update(){updates++;} };
  Object.defineProperty(app.window.navigator,'serviceWorker',{value:{controller:{},async register(){return registration;}}});
  await app.boot();
  const notice=await until(()=>app.document.querySelector('[data-update-notice]'));
  assert.equal(notice.hidden,false);
  assert.match(notice.textContent,/Sluit alle Sharon-vensters/);
  assert.equal(updates,1);
  assert.deepEqual(app.errors,[]);
});

for (const demo of [false, true]) test(`Exact releasepakket start ${demo ? 'testomgeving' : 'reguliere omgeving'} offline en zonder GPS`, async t => {
  const app = await appHarness({ demo }); t.after(() => app.close());
  await app.boot();
  await until(() => app.document.querySelector('[data-module="cards"]'));
  assert.equal(app.document.querySelectorAll('.module-list [data-module]').length, demo ? 12 : 11);
  assert.equal(!!app.document.querySelector('.sh-skeleton-home-label'), demo);
  assert.equal(app.gps.length, 1);
  assert.equal(app.gps[0].enableHighAccuracy, false);
  assert.deepEqual(app.requests, []);
  assert.deepEqual(app.errors, []);
});

test('Testactie: eerst opslaan, daarna koppelen; persoonlijke objecten blijven gelijk', async t => {
  const app = await appHarness({ demo: true }); t.after(() => app.close());
  const before = JSON.stringify(await app.store.getAll('objects'));
  await app.boot();
  await until(() => app.document.querySelector('[data-module="actions"]'));
  app.document.querySelector('[data-module="actions"]').click();
  (await until(() => app.document.querySelector('[data-demo-add]'))).click();
  app.document.querySelector('[data-demo-form] input').value = 'Integratieactie';
  app.document.querySelector('[data-demo-form]').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  const dataset = async () => (await app.store.get('meta', 'skeleton.demo.dataset'))?.value;
  const action = await until(async () => (await dataset())?.objects.find(o => o.title === 'Integratieactie'));
  assert.equal((await dataset()).relations.filter(r => r.from === action.id || r.to === action.id).length, 0);
  await until(() => app.document.querySelector(`[data-swipe-row="${action.id}"] [data-swipe-edit]`));
  app.document.querySelector(`[data-swipe-row="${action.id}"] [data-swipe-edit]`).click();
  app.document.querySelector('[data-connect-target="DemoPerson01"]').click();
  app.document.querySelector('[data-graph-add]').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(async () => (await dataset()).relations.some(r => r.from === action.id && r.to === 'DemoPerson01'));
  assert.equal(JSON.stringify(await app.store.getAll('objects')), before);
  const { ObjectStore } = await app.load('./src/core/storage/ObjectStore.js?v=0.4.09');
  const reopened = await new ObjectStore().open();
  assert.ok((await reopened.get('meta', 'skeleton.demo.dataset')).value.objects.some(o => o.id === action.id));
  assert.deepEqual(app.errors, []);
});

test('Geblokkeerde opslag maakt de echte entry aantoonbaar onsuccesvol', async t => {
  const app = await appHarness({ storageFailure: true }); t.after(() => app.close());
  await assert.rejects(app.boot(), /Opslag geblokkeerd/);
  assert.equal(app.document.querySelector('[data-module="cards"]'), null);
});

test('Lege installatie bereikt de echte kennismaking', async t => {
  const app = await appHarness({ firstRun: true }); t.after(() => app.close());
  const boot = app.boot();
  // Attach rejection handling immediately, then inspect the still-running onboarding.
  let bootError;
  boot.catch(error => { bootError = error; });
  const next = await until(() => app.document.querySelector('.story-continue'));
  next.click();
  await until(() => app.document.querySelector('[data-sharon-intro-form] input'));
  assert.deepEqual(app.errors, []);
  // Onboarding is deliberately left waiting for user input; no fictitious profile saved.
  assert.equal(await app.store.get('settings', 'app'), undefined);
  assert.equal(bootError, undefined);
});

test('Reguliere kaart opslaan en vanuit de lijst opnieuw openen', async t => {
  const app = await appHarness(); t.after(() => app.close());
  await app.boot();
  (await until(() => app.document.querySelector('[data-module="cards"]'))).click();
  (await until(() => app.document.querySelector('[aria-label="Kaart toevoegen"]'))).click();
  const form = await until(() => app.document.querySelector('[data-card-form]'));
  await until(() => form.querySelector('[data-code-icon] svg'));
  form.elements.name.value = 'Integratiepas';
  form.dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  const card = await until(async () => (await app.store.getAll('objects')).find(o => o.name === 'Integratiepas'));
  assert.match(card.id, /^[A-Za-z0-9_-]{12}$/);
  // Return through the real shell and reopen the persisted row.
  await dismissCardBoard(app);
  app.document.querySelector('[data-brand-control]').click();
  (await until(() => app.document.querySelector('.module-list [data-module="cards"]'))).click();
  const row = await until(() => app.document.querySelector(`[data-swipe-row="${card.id}"] [data-swipe-surface]`));
  row.click();
  await until(() => app.document.querySelector('[role="dialog"][aria-label="Kaart Integratiepas"]'));
  assert.deepEqual(app.errors, []);
});

test('Bestaande testworkspace wordt verrijkt zonder bewerkte gegevens te verliezen', async t => {
  const app = await appHarness({ demo: true }); t.after(() => app.close());
  const skeleton = await app.load('./src/core/skeleton/SkeletonCore.js?v=0.4.09');
  const old = skeleton.demoDataset();
  old.objects = old.objects.filter(o => o.module !== 'environment');
  old.objects.find(o => o.id === 'DemoPerson01').title = 'Bewaarde testnaam';
  await app.store.put('meta', { key: 'skeleton.demo.dataset', value: old });
  await app.boot();
  (await until(() => app.document.querySelector('[data-module="persons"]'))).click();
  await until(() => app.document.querySelector('.sh-skeleton-screen'));
  assert.ok(app.document.querySelector('.sh-skeleton-screen').textContent.includes('Bewaarde testnaam'));
  const restored = await skeleton.demoWorkspace(app.store);
  assert.equal(restored.data.objects.filter(o => o.module === 'environment').length, 1);
  assert.equal(restored.data.relations.length, old.relations.length);
  assert.deepEqual(app.errors, []);
});

test('Home biedt gekoppelde pas aan, sluit bij vertrek en ruimt listeners op', async t => {
  const app = await appHarness(); t.after(() => app.close());
  await app.store.put('objects',{id:'ShopPlace001',type:'location',data:{title:'Testwinkel',coordinates:{lat:52,lng:6},radiusM:100}});
  await app.store.put('objects',{id:'ShopCard0001',type:'card',name:'Mijn winkelpas',locationId:'ShopPlace001'});
  const { EventBus } = await app.load('./src/core/events/EventBus.js');
  const events = new EventBus();
  const location={latest:{lat:52,lng:6,accuracy:10,at:Date.now()}};
  const { mountHomeCardContext } = await app.load('./src/ui/HomeCardContext.js');
  const host=app.document.createElement('section');app.document.body.append(host);
  const cleanup=mountHomeCardContext(host,{store:app.store,location,events});t.after(cleanup);
  (await until(()=>host.querySelector('[data-context-card]'))).click();
  await until(()=>app.document.querySelector('[role="dialog"][aria-label="Kaart Mijn winkelpas"]'));
  location.latest={...location.latest,lat:53,at:Date.now()};events.emit('location.changed',location.latest);
  await until(()=>host.hidden && !app.document.querySelector('.sh-card-board-overlay'));
  location.latest={...location.latest,lat:52,at:Date.now()};events.emit('location.changed',location.latest);
  await until(()=>host.querySelector('[data-context-card]'));
  cleanup();events.emit('location.changed',location.latest);
  assert.equal(host.children.length,0);
  assert.equal(app.gps.length,0);
  assert.deepEqual(app.errors,[]);
});

test('Home toont het pasvoorstel vanuit de echte opstartketen', async t => {
  const app = await appHarness(); t.after(() => app.close());
  await app.store.put('objects',{id:'ShopPlace001',type:'location',data:{title:'Testwinkel',coordinates:{lat:52,lng:6},radiusM:100}});
  await app.store.put('objects',{id:'ShopCard0001',type:'card',name:'Mijn winkelpas',locationId:'ShopPlace001'});
  app.window.navigator.geolocation.getCurrentPosition = success => success({coords:{latitude:52,longitude:6,accuracy:10},timestamp:Date.now()});
  await app.boot();
  await until(()=>app.document.querySelector('[data-context-card]'));
  await dismissCardBoard(app);
  app.document.querySelector('[data-module="cards"]').click();
  await until(()=>app.document.querySelector('[data-card-list]'));
  app.document.querySelector('[data-brand-control]').click();
  await until(()=>app.document.querySelector('[data-context-card]'));
  assert.equal(app.document.querySelectorAll('[data-home-context]').length,1);
  assert.deepEqual(app.errors,[]);
});

test('Testomgeving toont geen persoonlijke pasvoorstellen', async t => {
  const app=await appHarness({demo:true});t.after(()=>app.close());
  await app.store.put('objects',{id:'ShopPlace001',type:'location',data:{title:'Privéwinkel',coordinates:{lat:52,lng:6},radiusM:100}});
  await app.store.put('objects',{id:'ShopCard0001',type:'card',name:'Privépas',locationId:'ShopPlace001'});
  app.window.navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:52,longitude:6,accuracy:10},timestamp:Date.now()});
  await app.boot();
  await until(()=>app.document.querySelector('.sh-skeleton-home-label'));
  assert.equal(app.document.querySelector('[data-context-card]'),null);
  assert.deepEqual(app.errors,[]);
});

test('Dichtbij sorteren gebruikt de centrale locatie en sluit een kaart bij verlaten module', async t => {
  const app=await appHarness();t.after(()=>app.close());
  await app.store.put('objects',{id:'ShopPlace001',type:'location',data:{title:'Winkel',coordinates:{lat:52,lng:6},radiusM:100}});
  await app.store.put('objects',{id:'ShopCard0001',type:'card',name:'Winkelpas',locationId:'ShopPlace001'});
  let checks=0;
  app.window.navigator.geolocation.getCurrentPosition=success=>{checks++;success({coords:{latitude:52,longitude:6,accuracy:10},timestamp:Date.now()});};
  await app.boot();
  await dismissCardBoard(app);
  (await until(()=>app.document.querySelector('[data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[data-card-sort="near"]'))).click();
  await until(()=>app.document.querySelector('[data-card-sort="near"][aria-pressed="true"]'));
  assert.equal(checks,1,'hergebruik de opstartmeting');
  app.document.querySelector('[data-card-list] [data-swipe-surface]').click();
  await until(()=>app.document.querySelector('.sh-card-board-overlay'));
  app.document.querySelector('[data-brand-control]').click();
  await until(()=>app.document.querySelector('.home-view'));
  assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
  assert.deepEqual(app.errors,[]);
});

test('Testlocaties openen dezelfde editor als live en bewaren GPS, type en straal zonder privédata te wijzigen', async t => {
  const app=await appHarness({demo:true});t.after(()=>app.close());
  const before=JSON.stringify(await app.store.getAll('objects'));
  app.window.navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:52,longitude:6,accuracy:10},timestamp:Date.now()});
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="locations"]'))).click();
  (await until(()=>app.document.querySelector('[data-create-location]'))).click();
  const form=await until(()=>app.document.querySelector('[data-location-form]'));
  await until(()=>form.dataset.guided==='1');
  assert.ok(app.document.querySelector('.sh-location-reference-page'));
  assert.equal(app.document.querySelector('[data-demo-form]'),null);
  form.elements.title.value='Testlocatie Zwolle';
  form.elements.lat.value='52.1';form.elements.lng.value='6.1';
  form.elements.kind.value='shop';form.elements.radiusM.value='150';
  form.elements.address.value='Zwolle';
  form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
  const dataset=async()=>(await app.store.get('meta','skeleton.demo.dataset'))?.value;
  const saved=await until(async()=>(await dataset())?.objects.find(o=>o.title==='Testlocatie Zwolle'));
  assert.deepEqual(JSON.parse(JSON.stringify(saved.fields.locationRecord.data.coordinates)),{lat:52.1,lng:6.1});
  assert.equal(saved.fields.locationRecord.data.kind,'shop');
  assert.equal(saved.fields.locationRecord.data.radiusM,150);
  assert.equal(saved.fields.locationRecord.data.address.text,'Zwolle');
  assert.equal(JSON.stringify(await app.store.getAll('objects')),before);
  await until(()=>app.document.querySelector(`[data-swipe-row="${saved.id}"]`));
  app.document.querySelector('[data-brand-control]').click();
  (await until(()=>app.document.querySelector('.module-list [data-module="locations"]'))).click();
  await until(()=>app.document.querySelector(`[data-swipe-row="${saved.id}"]`));
  assert.deepEqual(app.errors,[]);
});

test('Testomgeving: locatie vastleggen, pas koppelen en dezelfde context op Home gebruiken', async t => {
  const app=await appHarness({demo:true});t.after(()=>app.close());
  await app.store.put('objects',{id:'PrivateShop1',type:'location',data:{title:'Eigen winkel',coordinates:{lat:52,lng:6},radiusM:100}});
  await app.store.put('objects',{id:'PrivateAct01',type:'location-action',data:{locationId:'PrivateShop1',enabled:true,event:'enter',state:{inside:false}}});
  const privateObjects=JSON.stringify(await app.store.getAll('objects'));
  const privateSettings=JSON.stringify(await app.store.getAll('settings'));
  app.window.navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:52,longitude:6,accuracy:10},timestamp:Date.now()});
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="locations"]'))).click();
  (await until(()=>app.document.querySelector('[data-create-location]'))).click();
  const locationForm=await until(()=>app.document.querySelector('[data-location-form]'));
  await until(()=>locationForm.dataset.guided==='1');
  locationForm.elements.title.value='Mijn testwinkel';
  locationForm.elements.lat.value='52';locationForm.elements.lng.value='6';
  locationForm.elements.kind.value='shop';locationForm.elements.radiusM.value='100';
  locationForm.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
  const data=async()=>(await app.store.get('meta','skeleton.demo.dataset'))?.value;
  const place=await until(async()=>(await data())?.objects.find(o=>o.title==='Mijn testwinkel'));
  await until(()=>app.document.querySelector(`[data-swipe-row="${place.id}"]`));
  app.document.querySelector('[data-brand-control]').click();
  (await until(()=>app.document.querySelector('.module-list [data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[aria-label="Kaart toevoegen"]'))).click();
  const cardForm=await until(()=>app.document.querySelector('[data-card-form]'));
  await until(()=>cardForm.querySelector('[data-code-icon] svg'));
  cardForm.elements.name.value='Mijn testpas';
  cardForm.elements.locationId.value=place.id;
  cardForm.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
  const card=await until(async()=>(await data())?.objects.find(o=>o.title==='Mijn testpas'));
  await dismissCardBoard(app);
  app.document.querySelector('[data-brand-control]').click();
  await until(()=>app.document.querySelector(`[data-context-card="${card.id}"]`));
  await until(()=>app.document.querySelector('[role="dialog"][aria-label="Kaart Mijn testpas"]'));
  assert.equal(app.document.querySelectorAll('.sh-card-board-overlay').length,1);
  assert.ok((await data()).relations.some(r=>r.from===card.id&&r.to===place.id&&r.type==='usable-at'));
  assert.equal(JSON.stringify(await app.store.getAll('objects')),privateObjects);
  assert.equal(JSON.stringify(await app.store.getAll('settings')),privateSettings);
  assert.deepEqual(app.errors,[]);
});
