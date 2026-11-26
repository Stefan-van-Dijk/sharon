import test from 'node:test';
import assert from 'node:assert/strict';
import {appHarness,until} from '../helpers/app-harness.mjs';

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
  const initial=(await app.store.get('settings', 'app')).value;
  assert.equal(initial.profile.name,'');
  assert.equal(initial.onboarding.storySeen,false);
  assert.deepEqual(Array.from(initial.home.modules),['environment','locations']);
  assert.equal(bootError, undefined);
});

test('Onboarding toont dezelfde lokale Sharon-ID en laat je zonder account doorgaan', async t => {
  const app = await appHarness({ firstRun: true }); t.after(() => app.close());
  app.boot().catch(() => {});
  (await until(() => app.document.querySelector('.story-continue'))).click();
  const input = await until(() => app.document.querySelector('[data-sharon-intro-form] input'));
  input.value = 'Testpersoon';
  input.form.dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  (await until(() => app.document.querySelector('[data-intro-identity]'))).click();
  const status = await until(() => {
    const node = app.document.querySelector('[data-intro-person-id]');
    return node?.textContent ? node : null;
  });
  const { ConnectionService } = await app.load('./src/core/connection/ConnectionService.js?v=0.5.12');
  const device = await new ConnectionService(app.store).device();
  assert.equal(status.textContent, device.personId);
  assert.match(device.personId, /^[A-Za-z0-9_-]{12}$/);
  assert.equal(device.registered, false);
  app.document.querySelector('[data-intro-local]').click();
  await until(async () => (await app.store.get('settings', 'app')).value.profile.name === 'Testpersoon');
  assert.equal((await new ConnectionService(app.store).device()).personId, device.personId);
  assert.deepEqual(app.errors, []);
});
