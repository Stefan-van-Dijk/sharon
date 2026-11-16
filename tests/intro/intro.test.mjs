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

