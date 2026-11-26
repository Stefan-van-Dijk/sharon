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
