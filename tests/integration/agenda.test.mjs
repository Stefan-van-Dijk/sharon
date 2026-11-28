import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { appHarness, until } from '../helpers/app-harness.mjs';

test('Tijd koppelt een bestaande notitie aan een dag en Agenda toont die koppeling', async t => {
  const app = await appHarness({ root: resolve('.') });
  t.after(() => app.close());
  const note = { id: 'Agendanote12', type: 'note', name: 'Overleg voorbereiden' };
  await app.store.put('objects', note);
  const settings = await app.store.get('settings', 'app');
  settings.value.home = { modules: ['time', 'agenda'] };
  await app.store.put('settings', settings);
  await app.boot();
  (await until(() => app.document.querySelector('button[data-module="time"]'))).click();
  const form = await until(() => app.document.querySelector('[data-view-outlet] form'));
  form.elements.target.value = 'sharon:' + note.id;
  form.elements.start.value = '2026-11-26';
  form.elements.end.value = '2026-11-26';
  form.dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => app.document.querySelector('[data-agenda-list] li'));
  app.document.querySelector('[data-brand-control]').click();
  (await until(() => app.document.querySelector('button[data-module="agenda"]'))).click();
  const entry = await until(() => app.document.querySelector('[data-agenda-list] li'));
  assert.match(entry.textContent, /Overleg voorbereiden · 2026-11-26/);
  assert.equal(entry.querySelector('button'), null);
  assert.deepEqual(await app.store.get('objects', note.id), note);
  assert.deepEqual(app.errors, []);
});

test('Agenda volgt een openbaar evenement bij de bron, met behoud van persoonlijke koppelingen', async t => {
  const app = await appHarness({ root: resolve('.') });
  t.after(() => app.close());
  const settings = await app.store.get('settings', 'app');
  settings.value.home = { modules: ['agenda'] };
  await app.store.put('settings', settings);
  await app.store.put('meta', {key:'agenda.event-line.connected.v1',value:true});
  const selector = 'a'.repeat(32) + ':' + 'b'.repeat(32);
  await app.store.put('meta',{key:'account.session.v1',value:{token:'s'.repeat(43)}});
  const {ConnectionService}=await app.load('./src/core/connection/ConnectionService.js?v=0.5.29');
  const device=await new ConnectionService(app.store).device();
  let publicEvent = true;
  app.window.fetch = async (url, options) => {
    if(typeof url==='string' && url.endsWith('/connections.php'))return {ok:true,json:async()=>({account:{id:'TestAccount1',email:'test@example.test',personId:device.personId}})};
    assert.equal(url.searchParams.get('publicEvent'), selector);
    assert.equal(options.credentials, 'omit');
    if (!publicEvent) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ event: {
      ref: { source: 'event-line', id: 'EventAbcd123', class: 'event' },
      title: 'Testbeurs', location: 'Testlocatie',
      time: { kind: 'date-range', start: '2026-11-26', end: '2026-11-27' }
    } }) };
  };
  await app.boot();
  const openAgenda = async () => {
    (await until(() => app.document.querySelector('button[data-module="agenda"]'))).click();
    return until(() => app.document.querySelector('[data-view-outlet] form'));
  };
  const form = await openAgenda();
  form.elements.link.value = 'https://sharon.life/eventline/openbaar.html?event=' + selector;
  form.dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => app.document.querySelector('[data-view-outlet] a')?.textContent === 'Testbeurs');
  const connections = app.document.querySelector('[data-view-outlet] details form');
  connections.querySelector('select').options[0].selected = true;
  connections.dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  const saved = await until(async () => {
    const result = (await app.store.get('meta', 'agenda.event-line.bookmarks.v1'))?.value;
    return result?.[0]?.connections.length ? result : null;
  });
  assert.equal(saved[0].connections[0].id, 'TestPlace001');
  assert.equal(saved[0].title, undefined);
  publicEvent = false;
  app.document.querySelector('[data-brand-control]').click();
  await openAgenda();
  await until(() => app.document.querySelector('[data-view-outlet]').textContent.includes('niet meer openbaar'));
  assert.equal(app.document.querySelector('[data-view-outlet] a'), null);
  assert.deepEqual(await app.store.get('meta', 'agenda.event-line.bookmarks.v1'),
    { key: 'agenda.event-line.bookmarks.v1', value: saved });
  assert.deepEqual(app.errors, []);
});

test('Een ontkoppelde Event Line toont geen bewaarde evenementen of invoerveld', async t => {
  const app = await appHarness({ root: resolve('.') });
  t.after(() => app.close());
  const settings = await app.store.get('settings', 'app');
  settings.value.home = { modules: ['agenda'] };
  await app.store.put('settings', settings);
  await app.store.put('meta', {key:'agenda.event-line.connected.v1',value:false});
  await app.store.put('meta', {key:'agenda.event-line.bookmarks.v1',value:[{
    selector:'saved-event',ref:{source:'event-line',class:'event',id:'EventAbcd123'},connections:[]
  }]});
  await app.boot();
  (await until(() => app.document.querySelector('button[data-module="agenda"]'))).click();
  const outlet = app.document.querySelector('[data-view-outlet]');
  await until(() => Array.from(outlet.querySelectorAll('p')).some(
    paragraph => paragraph.textContent === 'Voeg tijdkoppelingen toe via Tijd.'
  ));
  assert.equal(app.document.querySelector('[data-view-outlet] form'),null);
  assert.equal(app.requests.some(url=>url.includes('publicEvent')),false);
});
