import test from 'node:test';
import assert from 'node:assert/strict';
import { appHarness, until } from '../helpers/app-harness.mjs';

for (const demo of [false, true]) test(`Exact releasepakket start ${demo ? 'testomgeving' : 'reguliere omgeving'} offline en zonder GPS`, async t => {
  const app = await appHarness({ demo }); t.after(() => app.close());
  await app.boot();
  await until(() => app.document.querySelector('[data-module="cards"]'));
  assert.equal(app.document.querySelectorAll('.module-list [data-module]').length, 12);
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
  const { ObjectStore } = await app.load('./src/core/storage/ObjectStore.js?v=0.3.55');
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
  (await until(() => app.document.querySelector('.sh-card-board-overlay [data-close]'))).click();
  app.document.querySelector('[data-brand-control]').click();
  (await until(() => app.document.querySelector('.module-list [data-module="cards"]'))).click();
  const row = await until(() => app.document.querySelector(`[data-swipe-row="${card.id}"] [data-swipe-surface]`));
  row.click();
  await until(() => app.document.querySelector('[role="dialog"][aria-label="Kaart Integratiepas"]'));
  assert.deepEqual(app.errors, []);
});

test('Bestaande testworkspace wordt verrijkt zonder bewerkte gegevens te verliezen', async t => {
  const app = await appHarness({ demo: true }); t.after(() => app.close());
  const skeleton = await app.load('./src/core/skeleton/SkeletonCore.js?v=0.3.55');
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
