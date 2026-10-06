import test from 'node:test';
import assert from 'node:assert/strict';
import { locationPolicy } from '../src/core/location/LocationPolicy.js';

test('verborgen app doet geen locatiecontrole', () => {
  assert.equal(locationPolicy({ hidden: true, activeTrip: true }).mode, 'off');
});

test('actieve rit gebruikt één minuut', () => {
  const policy = locationPolicy({ activeTrip: true });
  assert.equal(policy.mode, 'periodic');
  assert.equal(policy.intervalMs, 60_000);
  assert.equal(policy.highAccuracy, true);
});

test('locatieacties veroorzaken geen idle poll-loop', () => {
  const policy = locationPolicy({ activeLocationActions: true });
  assert.equal(policy.mode, 'on-demand');
  assert.equal(policy.intervalMs, null);
});

test('handmatige check is eenmalig en nauwkeurig', () => {
  const policy = locationPolicy({ manual: true });
  assert.equal(policy.mode, 'one-shot');
  assert.equal(policy.highAccuracy, true);
});
